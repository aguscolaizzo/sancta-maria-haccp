export const OPEN_FOOD_FACTS_ORIGIN = "https://world.openfoodfacts.org";

const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_fr",
  "brands",
  "quantity",
  "image_front_url",
  "categories",
  "ingredients_text",
  "ingredients_text_fr",
  "allergens",
  "allergens_tags",
  "countries",
  "countries_tags",
  "last_modified_t",
].join(",");

export type ProductDataSource = "internal" | "open_food_facts" | "manual";

export type BarcodeProduct = {
  barcode: string;
  barcodeNormalized: string;
  productName: string;
  productNameFr: string;
  brand: string;
  quantity: string;
  imageUrl: string;
  ingredients: string;
  allergens: string;
  categories: string;
  countries: string;
  source: ProductDataSource;
  externalLastUpdate: string | null;
  ingredientId: string | null;
};

export type OpenFoodFactsResult =
  | { status: "found"; product: BarcodeProduct }
  | { status: "not_found" }
  | { status: "offline" | "timeout" | "unavailable"; diagnostic: string };

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function list(value: unknown, max: number) {
  if (Array.isArray(value))
    return clean(
      value
        .map((item) => String(item).replace(/^[a-z]{2}:/i, "").replaceAll("-", " "))
        .join(", "),
      max,
    );
  return clean(value, max);
}

function imageUrl(value: unknown) {
  const candidate = clean(value, 1200);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function externalUpdate(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function productFromPayload(
  payload: Record<string, unknown>,
  barcode: string,
  normalized: string,
): BarcodeProduct {
  const product =
    payload.product && typeof payload.product === "object"
      ? (payload.product as Record<string, unknown>)
      : {};
  const productNameFr = clean(product.product_name_fr, 240);
  const productName = productNameFr || clean(product.product_name, 240);
  return {
    barcode,
    barcodeNormalized: normalized,
    productName,
    productNameFr,
    brand: clean(product.brands, 200),
    quantity: clean(product.quantity, 120),
    imageUrl: imageUrl(product.image_front_url),
    ingredients:
      clean(product.ingredients_text_fr, 4000) ||
      clean(product.ingredients_text, 4000),
    allergens:
      clean(product.allergens, 1000) || list(product.allergens_tags, 1000),
    categories: clean(product.categories, 1200),
    countries:
      clean(product.countries, 1000) || list(product.countries_tags, 1000),
    source: "open_food_facts",
    externalLastUpdate: externalUpdate(product.last_modified_t),
    ingredientId: null,
  };
}

type CacheEntry = { expiresAt: number; result: OpenFoodFactsResult };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

function cached(code: string) {
  const entry = cache.get(code);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(code);
    return null;
  }
  return entry.result;
}

function remember(code: string, result: OpenFoodFactsResult) {
  if (result.status !== "found" && result.status !== "not_found") return;
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value ?? "");
  cache.set(code, { expiresAt: Date.now() + CACHE_MS, result });
}

export async function findOpenFoodFactsProduct(
  barcode: string,
  normalized: string,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<OpenFoodFactsResult> {
  const previous = cached(barcode);
  if (previous) return previous;
  const controller = new AbortController();
  const timeoutMs = Math.max(25, Math.min(options.timeoutMs ?? 6500, 12000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(`/api/v3/product/${encodeURIComponent(barcode)}`, OPEN_FOOD_FACTS_ORIGIN);
    url.searchParams.set("fields", PRODUCT_FIELDS);
    url.searchParams.set("lc", "fr");
    url.searchParams.set("cc", "fr");
    url.searchParams.set("tags_lc", "fr");
    const response = await (options.fetcher ?? fetch)(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SanctaMariaHACCP/1.0 (https://sancta-maria.fr)",
      },
      signal: controller.signal,
    });
    if (response.status === 404) {
      const result = { status: "not_found" } as const;
      remember(barcode, result);
      return result;
    }
    if (!response.ok)
      return {
        status: "unavailable",
        diagnostic: `HTTP ${response.status}`,
      };
    const payload = (await response.json()) as Record<string, unknown>;
    const product = productFromPayload(payload, barcode, normalized);
    const apiStatus = String(payload.status ?? "").toLowerCase();
    if (!payload.product || apiStatus === "not-found" || apiStatus === "not_found") {
      const result = { status: "not_found" } as const;
      remember(barcode, result);
      return result;
    }
    const result = { status: "found", product } as const;
    remember(barcode, result);
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      return { status: "timeout", diagnostic: "request timed out" };
    return {
      status: "offline",
      diagnostic: error instanceof Error ? error.name : "network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function barcodeProductFromRow(row: Record<string, unknown>): BarcodeProduct {
  return {
    barcode: String(row.barcode),
    barcodeNormalized: String(row.barcode_normalized),
    productName: String(row.product_name),
    productNameFr: String(row.product_name_fr ?? ""),
    brand: String(row.brand ?? ""),
    quantity: String(row.quantity ?? ""),
    imageUrl: String(row.image_url ?? ""),
    ingredients: String(row.ingredients ?? ""),
    allergens: String(row.allergens ?? ""),
    categories: String(row.categories ?? ""),
    countries: String(row.countries ?? ""),
    source: String(row.source ?? "manual") as ProductDataSource,
    externalLastUpdate: row.external_last_update
      ? String(row.external_last_update)
      : null,
    ingredientId: row.ingredient_id ? String(row.ingredient_id) : null,
  };
}

export function sanitizeBarcodeProduct(
  value: unknown,
  barcode: string,
  normalized: string,
): { product?: BarcodeProduct; error?: string } {
  if (!value || typeof value !== "object")
    return { error: "Informations produit manquantes." };
  const input = value as Record<string, unknown>;
  const source = String(input.source ?? "manual") as ProductDataSource;
  if (!(["internal", "open_food_facts", "manual"] as string[]).includes(source))
    return { error: "Origine du produit invalide." };
  const productName = clean(input.productName, 240);
  if (!productName) return { error: "Le nom du produit est obligatoire." };
  return {
    product: {
      barcode,
      barcodeNormalized: normalized,
      productName,
      productNameFr: clean(input.productNameFr, 240),
      brand: clean(input.brand, 200),
      quantity: clean(input.quantity, 120),
      imageUrl: imageUrl(input.imageUrl),
      ingredients: clean(input.ingredients, 4000),
      allergens: clean(input.allergens, 1000),
      categories: clean(input.categories, 1200),
      countries: clean(input.countries, 1000),
      source,
      externalLastUpdate:
        typeof input.externalLastUpdate === "string" &&
        !Number.isNaN(Date.parse(input.externalLastUpdate))
          ? new Date(input.externalLastUpdate).toISOString()
          : null,
      ingredientId:
        typeof input.ingredientId === "string" && input.ingredientId
          ? input.ingredientId
          : null,
    },
  };
}
