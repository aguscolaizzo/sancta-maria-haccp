import { authorize } from "@/lib/access";
import {
  barcodeLookupCode,
  normalizeTradeItemCode,
  parseBarcode,
} from "@/lib/barcode";
import { ensureIngredientCatalog } from "@/lib/catalog-server";
import {
  barcodeProductFromRow,
  findOpenFoodFactsProduct,
  sanitizeBarcodeProduct,
  type BarcodeProduct,
} from "@/lib/open-food-facts";
import { ingredientFromRow } from "@/lib/quick-labels";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

const mappingSelect = `SELECT b.id AS barcode_id,b.code AS barcode_code,b.format AS barcode_format,b.revision AS barcode_revision,
  i.*,r.duration_hours,r.requires_source_lot,s.id AS mapped_supplier_id,s.name AS mapped_supplier_name
  FROM product_barcodes b
  JOIN ingredient_catalog i ON i.owner_id=b.owner_id AND i.id=b.ingredient_id AND i.deleted_at IS NULL AND i.active=1
  JOIN ingredient_operation_rules r ON r.owner_id=i.owner_id AND r.ingredient_id=i.id AND r.operation_type=i.default_operation AND r.active=1
  LEFT JOIN suppliers s ON s.owner_id=b.owner_id AND s.id=b.supplier_id AND s.deleted_at IS NULL`;

const requestsByOwner = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;

function externalRequestAllowed(ownerId: string) {
  const now = Date.now();
  const recent = (requestsByOwner.get(ownerId) ?? []).filter(
    (at) => now - at < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_MAX) {
    requestsByOwner.set(ownerId, recent);
    return false;
  }
  recent.push(now);
  requestsByOwner.set(ownerId, recent);
  return true;
}

async function localProduct(ownerId: string, normalized: string) {
  if (!normalized) return null;
  const row = await db()
    .prepare(
      "SELECT * FROM barcode_products WHERE owner_id=? AND barcode_normalized=?",
    )
    .bind(ownerId, normalized)
    .first<Record<string, unknown>>();
  return row ? barcodeProductFromRow(row) : null;
}

function internalProduct(
  row: Record<string, unknown>,
  barcode: string,
  normalized: string,
): BarcodeProduct {
  return {
    barcode,
    barcodeNormalized: normalized,
    productName: String(row.display_name),
    productNameFr: String(row.display_name),
    brand: "",
    quantity: "",
    imageUrl: "",
    ingredients: "",
    allergens: String(row.allergens ?? ""),
    categories: String(row.category ?? ""),
    countries: "",
    source: "internal",
    externalLastUpdate: null,
    ingredientId: String(row.id),
  };
}

async function resolve(
  ownerId: string,
  rawValue: string,
  format: string,
  allowExternal = true,
) {
  const parsed = parseBarcode(rawValue, format);
  const lookupCode = barcodeLookupCode(rawValue, format);
  const tradeCode = normalizeTradeItemCode(rawValue, format);
  const row = lookupCode
    ? await db()
        .prepare(`${mappingSelect} WHERE b.owner_id=? AND b.code=?`)
        .bind(ownerId, lookupCode)
        .first<Record<string, unknown>>()
    : null;
  const mapping = row
    ? {
        id: String(row.barcode_id),
        code: String(row.barcode_code),
        format: String(row.barcode_format),
        revision: Number(row.barcode_revision),
        ingredient: ingredientFromRow(row),
        supplier:
          row.mapped_supplier_id && row.mapped_supplier_name
            ? {
                id: String(row.mapped_supplier_id),
                name: String(row.mapped_supplier_name),
              }
            : null,
      }
    : null;

  if (parsed.internalUrl)
    return {
      parsed,
      lookupCode,
      mapping,
      product: null,
      lookupStatus: "internal_link" as const,
      message: "Fiche de traçabilité Sancta Maria reconnue.",
    };

  const saved = tradeCode
    ? await localProduct(ownerId, tradeCode.normalized)
    : null;
  if (mapping || saved) {
    const product =
      saved ??
      (row && tradeCode
        ? internalProduct(row, tradeCode.externalCode, tradeCode.normalized)
        : null);
    if (product && mapping) product.ingredientId = mapping.ingredient.id;
    return {
      parsed,
      lookupCode,
      mapping,
      product,
      lookupStatus: "internal" as const,
      message: product
        ? `Produit reconnu : ${product.productName}`
        : `Produit reconnu : ${mapping?.ingredient.displayName ?? "catalogue local"}`,
    };
  }

  if (!tradeCode)
    return {
      parsed,
      lookupCode,
      mapping: null,
      product: null,
      lookupStatus: "invalid" as const,
      message: "Code-barres non valide.",
    };

  if (!allowExternal)
    return {
      parsed,
      lookupCode,
      mapping: null,
      product: null,
      lookupStatus: "not_found" as const,
      message: "Produit introuvable. Vous pouvez le créer manuellement.",
    };

  if (!externalRequestAllowed(ownerId))
    return {
      parsed,
      lookupCode,
      mapping: null,
      product: null,
      lookupStatus: "rate_limited" as const,
      message:
        "Trop de recherches successives. Réessayez dans une minute ou continuez manuellement.",
    };

  const external = await findOpenFoodFactsProduct(
    tradeCode.externalCode,
    tradeCode.normalized,
  );
  if (external.status === "found")
    return {
      parsed,
      lookupCode,
      mapping: null,
      product: external.product,
      lookupStatus: "open_food_facts" as const,
      message: `Produit proposé : ${external.product.productName || tradeCode.externalCode}`,
    };
  if (external.status === "not_found")
    return {
      parsed,
      lookupCode,
      mapping: null,
      product: null,
      lookupStatus: "not_found" as const,
      message: "Produit introuvable. Vous pouvez le créer manuellement.",
    };

  console.warn("Open Food Facts lookup unavailable", {
    status: external.status,
    diagnostic: external.diagnostic,
  });
  return {
    parsed,
    lookupCode,
    mapping: null,
    product: null,
    lookupStatus:
      external.status === "offline" ? ("offline" as const) : ("unavailable" as const),
    message:
      external.status === "offline"
        ? "Connexion indisponible. Recherche effectuée uniquement dans le catalogue local."
        : "Le service externe ne répond pas. Réessayez ou continuez manuellement.",
  };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const rawValue = (url.searchParams.get("code") ?? "").trim();
  const format = url.searchParams.get("format") ?? "inconnu";
  if (!rawValue || rawValue.length > 512)
    return json({ error: "Code-barres non valide." }, 400);
  try {
    await ensureIngredientCatalog(auth.access.ownerId);
    return json(await resolve(auth.access.ownerId, rawValue, format));
  } catch (error) {
    console.error("barcode resolve failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return json(
      {
        error:
          "Le service externe ne répond pas. Réessayez ou continuez manuellement.",
      },
      503,
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const rawValue = String(payload.code ?? "").trim();
  const format = String(payload.format ?? "inconnu");
  const ingredientId = payload.ingredientId
    ? String(payload.ingredientId)
    : "";
  const supplierId = payload.supplierId ? String(payload.supplierId) : null;
  const lookupCode = barcodeLookupCode(rawValue, format);
  const tradeCode = normalizeTradeItemCode(rawValue, format);
  if (!rawValue || rawValue.length > 512 || !lookupCode)
    return json({ error: "Code-barres non valide." }, 400);
  if (
    (ingredientId && !validUuid(ingredientId)) ||
    (supplierId && !validUuid(supplierId))
  )
    return json({ error: "Produit ou fournisseur invalide." }, 400);

  const productValidation = payload.product
    ? tradeCode
      ? sanitizeBarcodeProduct(
          payload.product,
          tradeCode.externalCode,
          tradeCode.normalized,
        )
      : { error: "Code-barres non valide." }
    : null;
  if (productValidation?.error)
    return json({ error: productValidation.error }, 400);
  const product = productValidation?.product;
  if (product?.ingredientId && !validUuid(product.ingredientId))
    return json({ error: "Produit du catalogue invalide." }, 400);
  if (!ingredientId && !product)
    return json({ error: "Ajoutez ou sélectionnez un produit." }, 400);

  try {
    await ensureIngredientCatalog(auth.access.ownerId);
    const database = db();
    const ingredient = ingredientId
      ? await database
          .prepare(
            "SELECT id FROM ingredient_catalog WHERE owner_id=? AND id=? AND active=1 AND deleted_at IS NULL",
          )
          .bind(auth.access.ownerId, ingredientId)
          .first<Record<string, unknown>>()
      : null;
    const supplier = supplierId
      ? await database
          .prepare(
            "SELECT id FROM suppliers WHERE owner_id=? AND id=? AND deleted_at IS NULL",
          )
          .bind(auth.access.ownerId, supplierId)
          .first<Record<string, unknown>>()
      : null;
    const productIngredient =
      product?.ingredientId && product.ingredientId !== ingredientId
        ? await database
            .prepare(
              "SELECT id FROM ingredient_catalog WHERE owner_id=? AND id=? AND active=1 AND deleted_at IS NULL",
            )
            .bind(auth.access.ownerId, product.ingredientId)
            .first<Record<string, unknown>>()
        : ingredient;
    if (ingredientId && !ingredient)
      return json({ error: "Ingrédient introuvable." }, 404);
    if (supplierId && !supplier)
      return json({ error: "Fournisseur introuvable." }, 404);
    if (product?.ingredientId && !productIngredient)
      return json({ error: "Produit du catalogue introuvable." }, 404);

    const previousMapping = ingredientId
      ? await database
          .prepare(
            "SELECT id,ingredient_id,supplier_id,revision FROM product_barcodes WHERE owner_id=? AND code=?",
          )
          .bind(auth.access.ownerId, lookupCode)
          .first<Record<string, unknown>>()
      : null;
    const previousProduct = product
      ? await database
          .prepare(
            "SELECT id,product_name,source,revision FROM barcode_products WHERE owner_id=? AND barcode_normalized=?",
          )
          .bind(auth.access.ownerId, product.barcodeNormalized)
          .first<Record<string, unknown>>()
      : null;
    const now = new Date().toISOString();
    const sampleValue = rawValue
      .replace(/[\u0000-\u001c\u001e-\u001f\u007f]/g, "")
      .slice(0, 512);
    const parsedFormat = parseBarcode(rawValue, format).format;
    const statements = [];

    if (ingredientId) {
      const mappingId = previousMapping
        ? String(previousMapping.id)
        : crypto.randomUUID();
      statements.push(
        previousMapping
          ? database
              .prepare(
                `UPDATE product_barcodes SET sample_value=?,format=?,ingredient_id=?,supplier_id=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=?
                 WHERE owner_id=? AND id=?`,
              )
              .bind(
                sampleValue,
                parsedFormat,
                ingredientId,
                supplierId,
                now,
                auth.access.userId,
                auth.access.displayName,
                auth.access.ownerId,
                mappingId,
              )
          : database
              .prepare(
                `INSERT INTO product_barcodes(id,owner_id,code,sample_value,format,ingredient_id,supplier_id,revision,created_at,created_by_id,created_by_name)
                 VALUES(?,?,?,?,?,?,?,1,?,?,?)`,
              )
              .bind(
                mappingId,
                auth.access.ownerId,
                lookupCode,
                sampleValue,
                parsedFormat,
                ingredientId,
                supplierId,
                now,
                auth.access.userId,
                auth.access.displayName,
              ),
      );
      statements.push(
        database
          .prepare(
            `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            auth.access.ownerId,
            "barcode",
            mappingId,
            previousMapping ? "updated" : "created",
            "ingredient_id",
            previousMapping ? String(previousMapping.ingredient_id) : null,
            ingredientId,
            "Association confirmée après lecture du code-barres",
            now,
            auth.access.userId,
            auth.access.displayName,
          ),
      );
    }

    if (product) {
      const productId = previousProduct
        ? String(previousProduct.id)
        : crypto.randomUUID();
      if (previousProduct)
        statements.push(
          database
            .prepare(
              `UPDATE barcode_products SET barcode=?,product_name=?,product_name_fr=?,brand=?,quantity=?,image_url=?,ingredients=?,allergens=?,categories=?,countries=?,source=?,ingredient_id=?,external_last_update=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=?
               WHERE owner_id=? AND id=?`,
            )
            .bind(
              product.barcode,
              product.productName,
              product.productNameFr,
              product.brand,
              product.quantity,
              product.imageUrl,
              product.ingredients,
              product.allergens,
              product.categories,
              product.countries,
              product.source,
              ingredientId || product.ingredientId,
              product.externalLastUpdate,
              now,
              auth.access.userId,
              auth.access.displayName,
              auth.access.ownerId,
              productId,
            ),
        );
      else
        statements.push(
          database
            .prepare(
              `INSERT INTO barcode_products(id,owner_id,barcode,barcode_normalized,product_name,product_name_fr,brand,quantity,image_url,ingredients,allergens,categories,countries,source,ingredient_id,external_last_update,revision,created_at,created_by_id,created_by_name,updated_at,updated_by_id,updated_by_name)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)`,
            )
            .bind(
              productId,
              auth.access.ownerId,
              product.barcode,
              product.barcodeNormalized,
              product.productName,
              product.productNameFr,
              product.brand,
              product.quantity,
              product.imageUrl,
              product.ingredients,
              product.allergens,
              product.categories,
              product.countries,
              product.source,
              ingredientId || product.ingredientId,
              product.externalLastUpdate,
              now,
              auth.access.userId,
              auth.access.displayName,
              now,
              auth.access.userId,
              auth.access.displayName,
            ),
        );
      statements.push(
        database
          .prepare(
            `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            auth.access.ownerId,
            "barcode_product",
            productId,
            previousProduct ? "updated" : "created",
            "product_name",
            previousProduct ? String(previousProduct.product_name) : null,
            product.productName,
            product.source === "open_food_facts"
              ? "Données Open Food Facts vérifiées par l’utilisateur"
              : "Saisie manuelle vérifiée par l’utilisateur",
            now,
            auth.access.userId,
            auth.access.displayName,
          ),
      );
    }

    await database.batch(statements);
    return json(
      await resolve(auth.access.ownerId, rawValue, format, false),
      previousMapping || previousProduct ? 200 : 201,
    );
  } catch (error) {
    console.error("barcode save failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return json(
      { error: "Le produit associé au code-barres n’a pas pu être enregistré." },
      503,
    );
  }
}
