"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Barcode,
  Camera,
  Check,
  Flashlight,
  Keyboard,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  ScanLine,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { canAdministerRegister, type RegisterRole } from "@/lib/access-types";
import type { ParsedBarcode } from "@/lib/barcode";
import type { BarcodeProduct } from "@/lib/open-food-facts";
import { OPERATION_LABELS, type IngredientConfig, type OperationType } from "@/lib/quick-labels";
import type { Supplier } from "@/lib/supply";

type Mapping = {
  id: string;
  code: string;
  format: string;
  revision: number;
  ingredient: IngredientConfig;
  supplier: { id: string; name: string } | null;
};

type Resolution = {
  parsed: ParsedBarcode;
  lookupCode: string;
  mapping: Mapping | null;
  product: BarcodeProduct | null;
  lookupStatus:
    | "internal_link"
    | "internal"
    | "open_food_facts"
    | "not_found"
    | "invalid"
    | "offline"
    | "unavailable"
    | "rate_limited";
  message: string;
};

export type AppliedBarcode = {
  code: string;
  format: string;
  gtin: string;
  lot: string;
  deadlineDate: string;
  deadlineType: "dlc" | "ddm" | "";
  quantity: string;
  ingredient: IngredientConfig | null;
  supplier: { id: string; name: string } | null;
  product: BarcodeProduct | null;
};

type DetectedBarcode = { rawValue: string; format: string };
type NewIngredient = {
  displayName: string;
  shortName: string;
  category: string;
  productType: string;
  defaultOperation: OperationType;
  durationHours: string;
  storageMode: IngredientConfig["storageMode"];
  storageTemperature: string;
  quickEnabled: boolean;
};
const emptyIngredient = (name = ""): NewIngredient => ({
  displayName: name,
  shortName: name.slice(0, 32),
  category: "",
  productType: "",
  defaultOperation: "internal_preparation",
  durationHours: "",
  storageMode: "refrigerated",
  storageTemperature: "",
  quickEnabled: true,
});
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
type NativeDetector = {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
};
type NativeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La lecture a échoué.");
  return data;
}

const wantedFormats = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "data_matrix",
  "qr_code",
  "itf",
];

export default function BarcodeScanner({
  role,
  disabled = false,
  onApply,
  onCreatedIngredient,
  label = "Scanner un code-barres",
}: {
  role: RegisterRole;
  disabled?: boolean;
  onApply: (values: AppliedBarcode) => void;
  onCreatedIngredient?: (ingredient: IngredientConfig) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [ingredients, setIngredients] = useState<IngredientConfig[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [creatingIngredient, setCreatingIngredient] = useState(false);
  const [newIngredient, setNewIngredient] = useState<NewIngredient>(() => emptyIngredient());
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lot, setLot] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineType, setDeadlineType] = useState<"dlc" | "ddm" | "">("");
  const [quantity, setQuantity] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [remember, setRemember] = useState(true);
  const [productDraft, setProductDraft] = useState<BarcodeProduct | null>(null);
  const [editingProduct, setEditingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [torch, setTorch] = useState(false);
  const [scanAttempt, setScanAttempt] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopDecoderRef = useRef<(() => void) | null>(null);
  const detectedRef = useRef(false);

  const stopCamera = useCallback(() => {
    stopDecoderRef.current?.();
    stopDecoderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setTorch(false);
  }, []);

  function openScanner() {
    setResolution(null);
    setProductDraft(null);
    setEditingProduct(false);
    setIngredientQuery("");
    setCreatingIngredient(false);
    setCatalogError("");
    setError("");
    setStatus("Ouverture de la caméra…");
    setManualCode("");
    setReviewed(false);
    detectedRef.current = false;
    setOpen(true);
  }

  const resolveCode = useCallback(async (code: string, format = "inconnu") => {
    const clean = code.trim();
    if (!clean) return;
    stopCamera();
    setSaving(true);
    setError("");
    setStatus("Recherche dans la traçabilité…");
    try {
      const result = await api<Resolution>(
        `/api/barcodes?code=${encodeURIComponent(clean)}&format=${encodeURIComponent(format)}`,
      );
      setResolution(result);
      setIngredientId(
        result.mapping?.ingredient.id ?? result.product?.ingredientId ?? "",
      );
      setIngredientQuery("");
      setCreatingIngredient(false);
      setSupplierId(result.mapping?.supplier?.id ?? "");
      setLot(result.parsed.lot);
      setDeadlineDate(result.parsed.deadlineDate);
      setDeadlineType(result.parsed.deadlineType);
      setQuantity(result.parsed.quantity);
      const manualProduct =
        !result.product &&
        ["not_found", "offline", "unavailable", "rate_limited"].includes(
          result.lookupStatus,
        )
          ? {
              barcode: result.parsed.gtin || result.lookupCode,
              barcodeNormalized: result.lookupCode,
              productName: "",
              productNameFr: "",
              brand: "",
              quantity: "",
              imageUrl: "",
              ingredients: "",
              allergens: "",
              categories: "",
              countries: "",
              source: "manual" as const,
              externalLastUpdate: null,
              ingredientId: null,
            }
          : null;
      setProductDraft(result.product ?? manualProduct);
      setEditingProduct(Boolean(manualProduct));
      setReviewed(false);
      setStatus(result.message);
      navigator.vibrate?.(80);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Code illisible.");
      setStatus("");
    } finally {
      setSaving(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api<{ ingredients: IngredientConfig[] }>("/api/ingredients"),
      api<{ suppliers: Supplier[] }>("/api/suppliers"),
    ])
      .then(([catalog, supplierList]) => {
        setIngredients(catalog.ingredients);
        setSuppliers(supplierList.suppliers);
      })
      .catch(() => setCatalogError("Catalogue indisponible. Saisissez le nom du produit et réessayez plus tard pour l’ajouter à la checklist."));

    let cancelled = false;
    let frame = 0;
    const videoReady = (video: HTMLVideoElement) =>
      new Promise<void>((resolve, reject) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
          return;
        }
        const timeout = window.setTimeout(
          () => reject(new Error("La caméra met trop de temps à démarrer.")),
          7000,
        );
        video.addEventListener(
          "loadedmetadata",
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    const getCameraStream = async () => {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new DOMException("Caméra non disponible", "NotSupportedError");
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (caught) {
        if (
          caught instanceof DOMException &&
          ["OverconstrainedError", "NotFoundError"].includes(caught.name)
        )
          return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        throw caught;
      }
    };
    const start = async () => {
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const video = videoRef.current;
        if (!video) return;
        const stream = await getCameraStream();
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await videoReady(video);
        await video.play();
        setScanning(true);
        setStatus("Placez le code dans le cadre.");
        const Detector = (
          window as typeof window & { BarcodeDetector?: NativeDetectorConstructor }
        ).BarcodeDetector;
        if (Detector) {
          const supported = Detector.getSupportedFormats
            ? await Detector.getSupportedFormats()
            : wantedFormats;
          const formats = wantedFormats.filter((format) => supported.includes(format));
          const detector = new Detector(formats.length ? { formats } : undefined);
          const tick = async () => {
            if (cancelled || detectedRef.current || !videoRef.current) return;
            try {
              const results = await detector.detect(videoRef.current);
              if (results[0]?.rawValue) {
                detectedRef.current = true;
                void resolveCode(results[0].rawValue, results[0].format);
                return;
              }
            } catch {}
            frame = window.setTimeout(tick, 140);
          };
          void tick();
          stopDecoderRef.current = () => window.clearTimeout(frame);
          return;
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 500,
        });
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (!result || detectedRef.current) return;
          detectedRef.current = true;
          void resolveCode(result.getText(), String(result.getBarcodeFormat()));
        });
        stopDecoderRef.current = () => controls.stop();
      } catch (caught) {
        stopCamera();
        setScanning(false);
        setStatus("");
        setError(
          caught instanceof DOMException && caught.name === "NotAllowedError"
            ? "Caméra bloquée. Dans Chrome, ouvrez les autorisations du site, activez Caméra, puis appuyez sur Réessayer."
            : caught instanceof DOMException && caught.name === "NotFoundError"
              ? "Aucune caméra disponible. Vous pouvez photographier le code ou le saisir."
              : "La caméra en direct n’a pas démarré. Réessayez ou photographiez le code.",
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(frame);
      stopCamera();
    };
  }, [open, resolveCode, scanAttempt, stopCamera]);

  async function readPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    setStatus("Lecture de la photo…");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser"),
        reader = new BrowserMultiFormatReader(),
        result = await reader.decodeFromImageUrl(url);
      await resolveCode(result.getText(), String(result.getBarcodeFormat()));
    } catch {
      setStatus("");
      setError(
        "Aucun code lisible sur la photo. Approchez-vous, évitez les reflets et gardez tout le code dans l’image.",
      );
    } finally {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torch;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      toast.info("La lampe n’est pas disponible sur ce téléphone.");
    }
  }

  const selectedIngredient = ingredients.find((item) => item.id === ingredientId);
  const matchingIngredients = ingredients.filter((item) =>
    normalizeSearch(`${item.displayName} ${item.shortName} ${item.category}`).includes(normalizeSearch(ingredientQuery)),
  );
  const suggestedIngredients = ingredientQuery.trim() ? matchingIngredients : matchingIngredients.slice(0, 8);

  async function createIngredient() {
    if (!canAdministerRegister(role) || creatingBusy) return;
    const name = newIngredient.displayName.trim();
    if (!name || !newIngredient.shortName.trim() || !newIngredient.category.trim() || !newIngredient.productType.trim()) {
      setCatalogError("Renseignez le nom, le nom court, la famille et le type de produit.");
      return;
    }
    if (ingredients.some((item) => normalizeSearch(item.displayName) === normalizeSearch(name))) {
      setCatalogError("Ce produit existe déjà dans le catalogue. Recherchez-le et sélectionnez-le.");
      return;
    }
    if (!Number.isInteger(Number(newIngredient.durationHours)) || Number(newIngredient.durationHours) < 1 || Number(newIngredient.durationHours) > 8760 || !newIngredient.durationHours.trim()) {
      setCatalogError("Indiquez la durée interne validée, entre 1 et 8760 heures.");
      return;
    }
    if (newIngredient.storageMode !== "ambient" && !newIngredient.storageTemperature.trim()) {
      setCatalogError("Indiquez la température de conservation applicable.");
      return;
    }
    setCreatingBusy(true);
    setCatalogError("");
    try {
      const result = await api<{ ingredient: IngredientConfig }>("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newIngredient,
          durationHours: Number(newIngredient.durationHours),
          storageTemperature: newIngredient.storageTemperature.trim() === "" ? null : Number(newIngredient.storageTemperature),
          defaultBacs: 1,
          defaultLabels: 1,
          labelFormat: "50x30",
          favorite: false,
          preparationDays: [],
          requiresSourceLot: true,
          technicalDescription: "",
          allergens: "",
          preparationProcedure: "",
          handlingRules: "",
        }),
      });
      setIngredients((current) => [...current, result.ingredient]);
      onCreatedIngredient?.(result.ingredient);
      setIngredientId(result.ingredient.id);
      setIngredientQuery("");
      setCreatingIngredient(false);
      setReviewed(false);
      toast.success("Produit ajouté au catalogue et à la sélection.");
    } catch (caught) {
      setCatalogError(caught instanceof Error ? caught.message : "Création du produit impossible.");
    } finally {
      setCreatingBusy(false);
    }
  }

  async function confirm() {
    if (!resolution || !reviewed) return;
    const chosenIngredient = ingredients.find((item) => item.id === ingredientId) ?? null,
      chosenSupplier = suppliers.find((item) => item.id === supplierId) ?? null;
    const namedProduct = productDraft?.productName.trim() ? productDraft : null;
    if (!chosenIngredient && !namedProduct && !lot && !deadlineDate && !quantity) {
      setError("Choisissez ou nommez le produit avant de continuer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let effectiveMapping = resolution.mapping;
      let effectiveProduct = resolution.product;
      const mappingChanged =
        remember &&
        chosenIngredient &&
        (!effectiveMapping ||
          effectiveMapping.ingredient.id !== chosenIngredient.id ||
          (effectiveMapping.supplier?.id ?? "") !== supplierId);
      const productChanged = Boolean(
        namedProduct &&
          (resolution.lookupStatus !== "internal" || editingProduct),
      );
      if (mappingChanged || productChanged) {
        const linked = await api<Resolution>("/api/barcodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: resolution.parsed.rawValue,
            format: resolution.parsed.format,
            ingredientId: mappingChanged ? chosenIngredient?.id : null,
            supplierId: supplierId || null,
            product: productChanged
              ? {
                  ...namedProduct,
                  ingredientId: ingredientId || null,
                }
              : undefined,
          }),
        });
        effectiveMapping = linked.mapping;
        effectiveProduct = linked.product ?? namedProduct;
      }
      onApply({
        code: resolution.lookupCode,
        format: resolution.parsed.format,
        gtin: resolution.parsed.gtin,
        lot,
        deadlineDate,
        deadlineType,
        quantity,
        ingredient: chosenIngredient ?? effectiveMapping?.ingredient ?? null,
        supplier: chosenSupplier
          ? { id: chosenSupplier.id, name: chosenSupplier.name }
          : effectiveMapping?.supplier ?? null,
        product: effectiveProduct ?? namedProduct,
      });
      toast.success("Valeurs du code-barres ajoutées au formulaire.");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Association impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="button barcode-trigger"
        disabled={disabled}
        onClick={openScanner}
      >
        <ScanLine size={18} /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="barcode-dialog">
          <DialogHeader>
            <DialogTitle><Barcode size={20} /> Lecture code-barres</DialogTitle>
            <DialogDescription>
              EAN reconnaît le produit. Un code GS1 peut aussi proposer le lot,
              la DLC/DDM et la quantité.
            </DialogDescription>
          </DialogHeader>

          {!resolution && (
            <>
              <div className="barcode-camera">
                <video ref={videoRef} autoPlay playsInline muted aria-label="Caméra du lecteur de codes-barres" />
                <span className="barcode-target"><i /><i /><i /><i /></span>
                {scanning && (
                  <button type="button" className={torch ? "active" : ""} onClick={toggleTorch} aria-label="Activer ou désactiver la lampe">
                    <Flashlight size={20} />
                  </button>
                )}
              </div>
              {error && (
                <Button
                  type="button"
                  variant="outline"
                  className="button barcode-retry"
                  onClick={() => {
                    setError("");
                    setStatus("Ouverture de la caméra…");
                    detectedRef.current = false;
                    setScanAttempt((value) => value + 1);
                  }}
                >
                  <RefreshCcw size={17} /> Réessayer la caméra
                </Button>
              )}
              <label className="button barcode-photo">
                {photoBusy ? <LoaderCircle className="spin" size={18} /> : <Camera size={18} />}
                {photoBusy ? "Lecture…" : "Photographier le code"}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={photoBusy}
                  onChange={(event) => {
                    void readPhoto(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <div className="barcode-manual">
                <Keyboard size={18} />
                <Input
                  className="input"
                  inputMode="numeric"
                  placeholder="Saisir le numéro si nécessaire"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                />
                <Button type="button" variant="outline" className="button" disabled={!manualCode.trim() || saving} onClick={() => resolveCode(manualCode)}>
                  Lire
                </Button>
              </div>
            </>
          )}

          {status && <div className="barcode-status">{saving && <LoaderCircle className="spin" size={17} />} {status}</div>}
          {error && <div className="notice error barcode-error" role="alert">{error}</div>}

          {resolution?.parsed.internalUrl ? (
            <a className="button primary barcode-open-link" href={resolution.parsed.internalUrl} target="_blank" rel="noreferrer">
              <Link2 size={17} /> Ouvrir la fiche de traçabilité
            </a>
          ) : resolution ? (
            <div className="barcode-review">
              <div className="barcode-code">
                <small>{resolution.parsed.format.replaceAll("_", " ")}</small>
                <strong>{resolution.lookupCode}</strong>
              </div>
              {productDraft && (
                <section className="barcode-product-card" aria-label="Produit identifié">
                  <div className="barcode-product-heading">
                    {productDraft.imageUrl ? (
                      // Product imagery is remote, optional and cannot use a fixed Next image host.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={productDraft.imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="barcode-product-placeholder"><Barcode size={27} /></div>
                    )}
                    <div>
                      <span className={`barcode-source ${resolution.lookupStatus}`}>
                        {resolution.lookupStatus === "internal"
                          ? "Catalogue Sancta Maria"
                          : productDraft.source === "open_food_facts"
                            ? "Données Open Food Facts"
                            : "Saisie manuelle"}
                      </span>
                      <h3>{productDraft.productName || "Produit à compléter"}</h3>
                      {(productDraft.brand || productDraft.quantity) && (
                        <p>{[productDraft.brand, productDraft.quantity].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  </div>
                  {!editingProduct && (
                    <>
                      <dl className="barcode-product-details">
                        <div><dt>Code-barres</dt><dd>{productDraft.barcode}</dd></div>
                        {productDraft.ingredients && <div><dt>Ingrédients</dt><dd>{productDraft.ingredients}</dd></div>}
                        {productDraft.allergens && <div><dt>Allergènes</dt><dd>{productDraft.allergens}</dd></div>}
                        {productDraft.categories && <div><dt>Catégories</dt><dd>{productDraft.categories}</dd></div>}
                        {productDraft.countries && <div><dt>Pays</dt><dd>{productDraft.countries}</dd></div>}
                      </dl>
                      <Button type="button" variant="outline" className="button barcode-edit-product" onClick={() => { setEditingProduct(true); setReviewed(false); }}>
                        <Pencil size={16} /> Modifier les informations
                      </Button>
                    </>
                  )}
                  {editingProduct && (
                    <div className="barcode-product-form">
                      <label className="field">Nom du produit
                        <Input className="input" autoFocus value={productDraft.productName} maxLength={240} onChange={(event) => { setProductDraft({ ...productDraft, productName: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field">Nom en français
                        <Input className="input" value={productDraft.productNameFr} maxLength={240} onChange={(event) => { setProductDraft({ ...productDraft, productNameFr: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field">Marque
                        <Input className="input" value={productDraft.brand} maxLength={200} onChange={(event) => { setProductDraft({ ...productDraft, brand: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field">Quantité / format du produit
                        <Input className="input" value={productDraft.quantity} maxLength={120} onChange={(event) => { setProductDraft({ ...productDraft, quantity: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field barcode-wide-field">Ingrédients proposés
                        <textarea className="input" value={productDraft.ingredients} maxLength={4000} onChange={(event) => { setProductDraft({ ...productDraft, ingredients: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field barcode-wide-field">Allergènes proposés
                        <textarea className="input" value={productDraft.allergens} maxLength={1000} onChange={(event) => { setProductDraft({ ...productDraft, allergens: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field">Catégories
                        <Input className="input" value={productDraft.categories} maxLength={1200} onChange={(event) => { setProductDraft({ ...productDraft, categories: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field">Pays de commercialisation
                        <Input className="input" value={productDraft.countries} maxLength={1000} onChange={(event) => { setProductDraft({ ...productDraft, countries: event.target.value }); setReviewed(false); }} />
                      </label>
                      <label className="field barcode-wide-field">URL de l’image
                        <Input className="input" type="url" inputMode="url" value={productDraft.imageUrl} maxLength={1200} onChange={(event) => { setProductDraft({ ...productDraft, imageUrl: event.target.value }); setReviewed(false); }} />
                      </label>
                    </div>
                  )}
                  {productDraft.source === "open_food_facts" && (
                    <p className="barcode-off-note">
                      Identification proposée par <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>. Ingrédients et allergènes à confirmer sur l’emballage.
                    </p>
                  )}
                </section>
              )}
              <section className="barcode-ingredient-picker" aria-label="Produit ou préparation HACCP">
                <div className="barcode-picker-heading">
                  <strong>Produit / préparation HACCP</strong>
                  <span className="optional">Un produit par code-barres</span>
                </div>
                {selectedIngredient && (
                  <div className="barcode-picker-selected">
                    <Check size={17} /> <span>{selectedIngredient.displayName}</span>
                    <button type="button" onClick={() => { setIngredientId(""); setReviewed(false); }} aria-label="Retirer le produit sélectionné">Changer</button>
                  </div>
                )}
                <label className="barcode-picker-search">
                  <Search size={19} aria-hidden="true" />
                  <Input className="input" type="search" autoComplete="off" placeholder="Écrire ou rechercher un produit…" value={ingredientQuery} onChange={(event) => { setIngredientQuery(event.target.value); setCatalogError(""); }} />
                </label>
                {catalogError && <p className="notice error" role="alert">{catalogError}</p>}
                <div className="barcode-picker-results" role="radiogroup" aria-label="Produits du catalogue">
                  {suggestedIngredients.map((item) => (
                    <label className="barcode-picker-item" key={item.id}>
                      <input type="radio" name="barcode-ingredient" checked={ingredientId === item.id} onChange={() => { setIngredientId(item.id); setCreatingIngredient(false); setReviewed(false); }} />
                      <span>{item.displayName}<small>{item.category}</small></span>
                    </label>
                  ))}
                  {!suggestedIngredients.length && <p className="barcode-picker-empty">Aucun résultat dans le catalogue. Vous pouvez créer ce produit.</p>}
                </div>
                {!ingredientQuery.trim() && ingredients.length > 8 && <small className="barcode-picker-hint">Écrivez un nom pour retrouver les {ingredients.length} produits du catalogue.</small>}
                {canAdministerRegister(role) ? (
                  <>
                    <Button type="button" variant="outline" className="button barcode-new-product" onClick={() => { setNewIngredient(emptyIngredient(ingredientQuery.trim() || productDraft?.productNameFr || productDraft?.productName || "")); setCreatingIngredient((current) => !current); setCatalogError(""); setReviewed(false); }}>
                      <Plus size={18} /> {creatingIngredient ? "Fermer la création" : "Créer un nouveau produit ou plat"}
                    </Button>
                    {creatingIngredient && (
                      <div className="barcode-ingredient-form">
                        <p>Renseignez les règles validées de ce produit. Il sera disponible dans les étiquettes et la mise en place rapide.</p>
                        <label className="field">Nom du produit / plat<Input className="input" autoFocus maxLength={120} value={newIngredient.displayName} onChange={(event) => setNewIngredient((current) => ({ ...current, displayName: event.target.value, shortName: current.shortName === current.displayName.slice(0, 32) ? event.target.value.slice(0, 32) : current.shortName }))} /></label>
                        <label className="field">Nom court sur l’étiquette<Input className="input" maxLength={32} value={newIngredient.shortName} onChange={(event) => setNewIngredient((current) => ({ ...current, shortName: event.target.value }))} /></label>
                        <label className="field">Famille / catégorie<Input className="input" maxLength={80} placeholder="Pizza, burger, préparation cuite…" value={newIngredient.category} onChange={(event) => setNewIngredient((current) => ({ ...current, category: event.target.value }))} /></label>
                        <label className="field">Type de produit<Input className="input" maxLength={40} placeholder="Frais, cuit, ouvert…" value={newIngredient.productType} onChange={(event) => setNewIngredient((current) => ({ ...current, productType: event.target.value }))} /></label>
                        <label className="field">Opération par défaut<select className="input" value={newIngredient.defaultOperation} onChange={(event) => setNewIngredient((current) => ({ ...current, defaultOperation: event.target.value as OperationType }))}>{Object.entries(OPERATION_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
                        <label className="field">Durée interne validée (heures)<Input className="input" type="number" inputMode="numeric" min="1" max="8760" placeholder="À renseigner" value={newIngredient.durationHours} onChange={(event) => setNewIngredient((current) => ({ ...current, durationHours: event.target.value }))} /></label>
                        <label className="field">Conservation<select className="input" value={newIngredient.storageMode} onChange={(event) => setNewIngredient((current) => ({ ...current, storageMode: event.target.value as IngredientConfig["storageMode"], storageTemperature: "" }))}><option value="refrigerated">Réfrigéré</option><option value="frozen">Congelé</option><option value="ambient">Ambiant</option></select></label>
                        {newIngredient.storageMode !== "ambient" && <label className="field">Température de conservation (°C)<Input className="input" type="number" inputMode="decimal" step="0.1" placeholder="À renseigner" value={newIngredient.storageTemperature} onChange={(event) => setNewIngredient((current) => ({ ...current, storageTemperature: event.target.value }))} /></label>}
                        <label className="ocr-confirm"><input type="checkbox" checked={newIngredient.quickEnabled} onChange={(event) => setNewIngredient((current) => ({ ...current, quickEnabled: event.target.checked }))} /> Afficher dans « Impression rapide »</label>
                        <Button type="button" className="button primary" disabled={creatingBusy} onClick={createIngredient}>{creatingBusy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Ajouter au catalogue</Button>
                      </div>
                    )}
                  </>
                ) : (
                  <small className="barcode-picker-hint">Produit absent ? Saisissez son nom dans « Modifier les informations ». La création d’une fiche HACCP est réservée au responsable.</small>
                )}
              </section>
              <div className="label-form-grid">
                <label className="field">
                  Fournisseur <span className="optional">facultatif</span>
                  <select className="input" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setReviewed(false); }}>
                    <option value="">Non associé</option>
                    {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="field">Lot fournisseur
                  <Input className="input" value={lot} onChange={(event) => { setLot(event.target.value); setReviewed(false); }} maxLength={120} />
                </label>
                <label className="field">Type de date
                  <select className="input" value={deadlineType} onChange={(event) => { setDeadlineType(event.target.value as "dlc" | "ddm" | ""); setReviewed(false); }}>
                    <option value="">À préciser</option><option value="dlc">DLC</option><option value="ddm">DDM</option>
                  </select>
                </label>
                <label className="field">DLC / DDM
                  <Input className="input" type="date" value={deadlineDate} onChange={(event) => { setDeadlineDate(event.target.value); setReviewed(false); }} />
                </label>
                <label className="field">Quantité / poids de cette livraison
                  <Input className="input" value={quantity} onChange={(event) => { setQuantity(event.target.value); setReviewed(false); }} maxLength={40} />
                </label>
              </div>
              <p className="barcode-haccp-note">
                Le lot, la DLC/DDM, le fournisseur réel et la température ne sont jamais déduits d’Open Food Facts. Vérifiez-les sur cette livraison.
              </p>
              {ingredientId && (
                <label className="ocr-confirm">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  Mémoriser ce code pour reconnaître ce produit la prochaine fois.
                </label>
              )}
              <label className="ocr-confirm">
                <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
                J’ai vérifié le produit, le lot et la date sur l’emballage.
              </label>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" className="button" onClick={() => setOpen(false)}>Annuler</Button>
            {resolution && !resolution.parsed.internalUrl && (
              <Button type="button" className="button primary" disabled={!reviewed || saving || (!!deadlineDate && !deadlineType) || (Boolean(productDraft) && !productDraft?.productName.trim() && !ingredientId)} onClick={confirm}>
                {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Utiliser ce produit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
