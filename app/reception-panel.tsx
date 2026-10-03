"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  History,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Thermometer,
  Trash2,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canAdministerRegister, type RegisterSession } from "@/lib/access-types";
import type { Supplier } from "@/lib/supply";
import {
  DECISION_LABELS,
  probeNonCompliant,
  probeRequired,
  RECEPTION_PRODUCT_PRESETS,
  RECEPTION_STATUS_LABELS,
  type PhotoKind,
  type Reception,
  type ReceptionAuditEvent,
  type ReceptionPhoto,
  type ReceptionProduct,
  type ReceptionStatus,
  type ReceptionSummary,
  type TemperatureRegime,
} from "@/lib/receptions";
import SignaturePad from "./signature-pad";
import PhotoOcr from "./photo-ocr";
import BarcodeScanner from "./barcode-scanner";

type Detail = {
  reception: Reception;
  products: ReceptionProduct[];
  photos: ReceptionPhoto[];
  audits: ReceptionAuditEvent[];
};
type ProductDraft = Omit<
  ReceptionProduct,
  | "id"
  | "receptionId"
  | "supplierLotId"
  | "createdAt"
  | "createdByName"
  | "updatedAt"
  | "updatedByName"
>;
type Mode = "home" | "history" | "editor";

const steps = [
  "Fournisseur",
  "Produits",
  "Températures",
  "Anomalies",
  "Validation",
  "Livreur",
];
const blankProduct = (): ProductDraft => ({
  productName: "",
  category: "Autres",
  temperatureRegime: "refrigerated",
  quantity: "",
  unit: "kg",
  supplierLot: "",
  deadlineType: "dlc",
  deadlineDate: null,
  storageTemperature: 4,
  maxTemperature: 4,
  packagingCompliant: null,
  visualCompliant: null,
  cleanlinessCompliant: null,
  humidityAbsent: null,
  pestsAbsent: null,
  productCompliant: null,
  selectedForMeasurement: true,
  suggestedForMeasurement: true,
  riskLevel: "normal",
  irTemperature: null,
  probeTemperature: null,
  measurementMethod: "ir_surface",
  remeasureTemperature: null,
  observations: "",
  decisionType: null,
  concernedQuantity: "",
  nonConformityReason: "",
  nonConformityComment: "",
  correctiveAction: "",
  finalDecision: "",
  revision: 0,
});

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "La demande a échoué.");
  return result;
}
const formatDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(iso))
    : "—";
const tempText = (value: number | null) =>
  value === null
    ? "—"
    : `${value > 0 ? "+" : ""}${String(value).replace(".", ",")} °C`;
const parseTemp = (value: string) => {
  if (!value.trim()) return null;
  const result = Number(value.replace(",", ".").replace("+", ""));
  return Number.isFinite(result) ? result : null;
};
const statusClass = (status: ReceptionStatus) =>
  status === "compliant"
    ? "ok"
    : status === "compliant_after_probe"
      ? "warn"
      : status === "in_progress"
        ? ""
        : "danger";

async function compressPhoto(file: File) {
  const bitmap = await createImageBitmap(file),
    max = 1200,
    scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.72,
    data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 900_000 && quality > 0.42) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 1_000_000)
    throw new Error(
      "La photo reste trop volumineuse. Recadrez-la puis réessayez.",
    );
  return data;
}

function ToggleField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="reception-check">
      <span>{label}</span>
      <div>
        <button
          type="button"
          className={value === true ? "active yes" : ""}
          onClick={() => onChange(true)}
          disabled={disabled}
        >
          <Check size={15} />
          Oui
        </button>
        <button
          type="button"
          className={value === false ? "active no" : ""}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          <XCircle size={15} />
          Non
        </button>
      </div>
    </div>
  );
}

function TemperatureInput({
  value,
  onChange,
  disabled,
  placeholder,
  className = "input",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(
      value === null ? "" : String(value).replace(".", ","),
    ),
    ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== ref.current)
      setText(value === null ? "" : String(value).replace(".", ","));
  }, [value]);
  return (
    <input
      ref={ref}
      className={className}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      disabled={disabled}
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(/[^0-9,+.-]/g, "").slice(0, 8);
        setText(next);
        const parsed = parseTemp(next);
        if (!next.trim()) onChange(null);
        else if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        const parsed = parseTemp(text);
        if (parsed === null && text.trim())
          setText(value === null ? "" : String(value).replace(".", ","));
        else onChange(parsed);
      }}
    />
  );
}

export default function ReceptionPanel({
  session,
}: {
  session: RegisterSession;
}) {
  const [mode, setMode] = useState<Mode>("home"),
    [step, setStep] = useState(0),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [reception, setReception] = useState<Reception | null>(null);
  const [products, setProducts] = useState<ReceptionProduct[]>([]),
    [photos, setPhotos] = useState<ReceptionPhoto[]>([]),
    [audits, setAudits] = useState<ReceptionAuditEvent[]>([]);
  const [history, setHistory] = useState<ReceptionSummary[]>([]),
    [historyLoading, setHistoryLoading] = useState(false);
  const [filters, setFilters] = useState({
    date: "",
    supplier: "",
    product: "",
    category: "",
    status: "",
    user: "",
    lot: "",
  });
  const [productDraft, setProductDraft] = useState<ProductDraft>(blankProduct),
    [editingId, setEditingId] = useState<string | null>(null);
  const [photoKind, setPhotoKind] = useState<PhotoKind>("delivery_note"),
    [photoProductId, setPhotoProductId] = useState(""),
    [photoBusy, setPhotoBusy] = useState(false);
  const [pin, setPin] = useState(""),
    [signature, setSignature] = useState<string | null>(null),
    [driverCompany, setDriverCompany] = useState(""),
    [driverInitials, setDriverInitials] = useState("");
  const [driverRefused, setDriverRefused] = useState(false),
    [driverRefusalComment, setDriverRefusalComment] = useState("");

  useEffect(() => {
    api<{ suppliers: Supplier[] }>("/api/suppliers")
      .then((data) => setSuppliers(data.suppliers))
      .catch(() => {});
  }, []);
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value),
      );
      const data = await api<{ receptions: ReceptionSummary[] }>(
        `/api/receptions?${query}`,
      );
      setHistory(data.receptions);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Historique indisponible.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [filters]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "home" || mode === "history") void loadHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, loadHistory]);

  async function openReception(id: string, targetStep = 0) {
    setLoading(true);
    try {
      const data = await api<Detail>(`/api/receptions/${id}`);
      setReception(data.reception);
      setProducts(data.products);
      setPhotos(data.photos);
      setAudits(data.audits);
      setSignature(data.reception.driverSignature);
      setDriverCompany(data.reception.driverCompany);
      setDriverInitials(data.reception.driverInitials);
      setDriverRefused(data.reception.driverRefusedSign);
      setDriverRefusalComment(data.reception.driverRefusalComment);
      setStep(targetStep);
      setMode("editor");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Réception indisponible.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function createReception() {
    setLoading(true);
    try {
      const data = await api<{ reception: Reception }>("/api/receptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await openReception(data.reception.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible.",
      );
    } finally {
      setLoading(false);
    }
  }
  async function saveHeader(next = false) {
    if (!reception) return;
    setSaving(true);
    try {
      const data = await api<{ reception: Reception }>(
        `/api/receptions/${reception.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_header",
            revision: reception.revision,
            supplierId: reception.supplierId,
            supplierName: reception.supplierName,
            deliveryNote: reception.deliveryNote,
            orderNumber: reception.orderNumber,
            driverName: reception.driverName,
            generalNotes: reception.generalNotes,
          }),
        },
      );
      setReception(data.reception);
      if (next) setStep(1);
      toast.success("Informations de livraison enregistrées.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }
  function selectSupplier(id: string) {
    if (!reception) return;
    const supplier = suppliers.find((item) => item.id === id);
    setReception({
      ...reception,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? "",
    });
  }

  function applyPreset(index: string) {
    const preset = RECEPTION_PRODUCT_PRESETS[Number(index)];
    if (!preset) {
      setProductDraft(blankProduct());
      return;
    }
    setProductDraft({
      ...blankProduct(),
      productName: preset.name,
      category: preset.category,
      temperatureRegime: preset.regime,
      storageTemperature: preset.storageTemperature,
      maxTemperature: preset.maxTemperature,
      deadlineType: preset.deadlineType,
      riskLevel: preset.risk,
      selectedForMeasurement: preset.regime !== "ambient",
      suggestedForMeasurement: preset.regime !== "ambient",
      measurementMethod: preset.regime === "ambient" ? "" : "ir_surface",
    });
  }
  async function saveProduct() {
    if (!reception) return;
    setSaving(true);
    try {
      const url = editingId
        ? `/api/receptions/${reception.id}/products/${editingId}`
        : `/api/receptions/${reception.id}/products`;
      const data = await api<{ product: ReceptionProduct }>(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productDraft),
      });
      setProducts((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? data.product : item))
          : [...current, data.product],
      );
      setProductDraft(blankProduct());
      setEditingId(null);
      toast.success(
        editingId
          ? "Produit corrigé et modification tracée."
          : "Produit ajouté à la réception.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Produit non enregistré.",
      );
    } finally {
      setSaving(false);
    }
  }
  function editProduct(product: ReceptionProduct) {
    const omitted = new Set([
      "id",
      "receptionId",
      "supplierLotId",
      "createdAt",
      "createdByName",
      "updatedAt",
      "updatedByName",
    ]);
    const draft = Object.fromEntries(
      Object.entries(product).filter(([key]) => !omitted.has(key)),
    ) as ProductDraft;
    setProductDraft(draft);
    setEditingId(product.id);
    document
      .getElementById("reception-product-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function deleteProduct(product: ReceptionProduct) {
    if (
      !reception ||
      !confirm(
        `Retirer « ${product.productName} » de cette réception en cours ?`,
      )
    )
      return;
    try {
      await api(`/api/receptions/${reception.id}/products/${product.id}`, {
        method: "DELETE",
      });
      setProducts((items) => items.filter((item) => item.id !== product.id));
      toast.success("Produit retiré.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    }
  }
  const updateProduct = (id: string, patch: Partial<ReceptionProduct>) =>
    setProducts((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  async function saveAllProducts(nextStep?: number) {
    if (!reception) return false;
    setSaving(true);
    try {
      const saved: ReceptionProduct[] = [];
      for (const product of products) {
        const data = await api<{ product: ReceptionProduct }>(
          `/api/receptions/${reception.id}/products/${product.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(product),
          },
        );
        saved.push(data.product);
      }
      setProducts(saved);
      if (nextStep !== undefined) setStep(nextStep);
      toast.success("Contrôles enregistrés.");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Contrôles non enregistrés.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function uploadPhoto(
    event: ChangeEvent<HTMLInputElement>,
    forcedKind?: PhotoKind,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !reception) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressPhoto(file),
        data = await api<{ photo: ReceptionPhoto }>(
          `/api/receptions/${reception.id}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: forcedKind ?? photoKind,
              productId:
                forcedKind === "delivery_note" ? null : photoProductId || null,
              dataUrl,
            }),
          },
        );
      setPhotos((items) => [...items, data.photo]);
      toast.success("Photo enregistrée dans la réception.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Photo non enregistrée.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  async function validateReception() {
    if (!reception || !(await saveAllProducts())) return;
    setSaving(true);
    try {
      const data = await api<{ reception: Reception }>(
        `/api/receptions/${reception.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "validate",
            pin,
            device: `${navigator.userAgent} · ${screen.width}x${screen.height}`,
          }),
        },
      );
      setReception(data.reception);
      setStep(5);
      toast.success("Réception validée et horodatée.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Validation impossible.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveSignature() {
    if (!reception) return;
    setSaving(true);
    try {
      const data = await api<{ reception: Reception }>(
        `/api/receptions/${reception.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "signature",
            driverCompany,
            driverInitials,
            driverSignature: signature,
            driverRefusedSign: driverRefused,
            driverRefusalComment,
          }),
        },
      );
      setReception(data.reception);
      toast.success(
        driverRefused
          ? "Refus de signature enregistré."
          : signature
            ? "Signature du livreur enregistrée."
            : "Étape livreur enregistrée.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Signature non enregistrée.",
      );
    } finally {
      setSaving(false);
    }
  }

  const locked = Boolean(
    reception && reception.status !== "in_progress" && !canAdministerRegister(session.role),
  );
  const measured = products.filter(
    (p) => p.selectedForMeasurement && p.irTemperature !== null,
  ).length;
  const cold = products.filter((p) => p.temperatureRegime !== "ambient"),
    coldSelected = cold.filter((p) => p.selectedForMeasurement).length;
  const anomalies = products.filter(
    (p) =>
      probeNonCompliant(p) ||
      p.packagingCompliant === false ||
      p.visualCompliant === false ||
      p.productCompliant === false,
  );
  const deliveryPhotos = photos.filter(
    (photo) => photo.kind === "delivery_note",
  );

  if (loading)
    return (
      <div className="panel loading">
        <LoaderCircle className="spinner" size={24} /> Chargement des
        réceptions…
      </div>
    );
  if (mode === "home")
    return (
      <section className="receptions-view">
        <div className="labels-heading">
          <div>
            <p className="eyebrow">Contrôle à la livraison</p>
            <h2>Réception marchandises</h2>
            <p>
              Contrôlez une livraison en quelques minutes et reliez les lots
              reçus à vos futures préparations.
            </p>
          </div>
          <span className="label-format">
            <ShieldCheck size={16} />
            Traçabilité HACCP
          </span>
        </div>
        <div className="reception-home-grid">
          <button
            className="reception-action-card primary-card"
            onClick={createReception}
          >
            <span>
              <Plus size={26} />
            </span>
            <strong>Nouvelle réception</strong>
            <small>ID, date, heure et utilisateur créés automatiquement</small>
          </button>
          <button
            className="reception-action-card"
            onClick={() => setMode("history")}
          >
            <span>
              <History size={26} />
            </span>
            <strong>Historique</strong>
            <small>Rechercher par fournisseur, produit, lot ou statut</small>
          </button>
        </div>
        <div className="panel panel-pad reception-recent">
          <div className="reception-section-head">
            <h3>Réceptions récentes</h3>
            <Button
              variant="outline"
              className="button"
              onClick={() => setMode("history")}
            >
              <Search size={16} />
              Tous les filtres
            </Button>
          </div>
          {historyLoading ? (
            <p className="muted-note">Chargement…</p>
          ) : !history.length ? (
            <p className="muted-note">Aucune réception enregistrée.</p>
          ) : (
            history.slice(0, 6).map((item) => (
              <button
                key={item.id}
                className="reception-history-row"
                onClick={() =>
                  openReception(item.id, item.status === "in_progress" ? 0 : 4)
                }
              >
                <span>
                  <strong>{item.receptionCode}</strong>
                  <small>
                    {formatDateTime(item.createdAt)} ·{" "}
                    {item.supplierName || "Fournisseur à renseigner"}
                  </small>
                </span>
                <span className={`status-pill ${statusClass(item.status)}`}>
                  {RECEPTION_STATUS_LABELS[item.status]}
                </span>
                <ChevronRight size={18} />
              </button>
            ))
          )}
        </div>
      </section>
    );

  if (mode === "history")
    return (
      <section className="receptions-view">
        <div className="reception-title-row">
          <Button
            variant="outline"
            className="icon-button"
            onClick={() => setMode("home")}
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <p className="eyebrow">Réceptions</p>
            <h2>Historique</h2>
          </div>
        </div>
        <div className="panel panel-pad reception-filters">
          <label className="field">
            Date
            <Input
              className="input"
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
            />
          </label>
          <label className="field">
            Fournisseur
            <Input
              className="input"
              value={filters.supplier}
              onChange={(e) =>
                setFilters({ ...filters, supplier: e.target.value })
              }
            />
          </label>
          <label className="field">
            Produit
            <Input
              className="input"
              value={filters.product}
              onChange={(e) =>
                setFilters({ ...filters, product: e.target.value })
              }
            />
          </label>
          <label className="field">
            Catégorie
            <Input
              className="input"
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
            />
          </label>
          <label className="field">
            Lot
            <Input
              className="input"
              value={filters.lot}
              onChange={(e) => setFilters({ ...filters, lot: e.target.value })}
            />
          </label>
          <label className="field">
            Utilisateur
            <Input
              className="input"
              value={filters.user}
              onChange={(e) => setFilters({ ...filters, user: e.target.value })}
            />
          </label>
          <label className="field">
            Statut
            <select
              className="input"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">Tous</option>
              {Object.entries(RECEPTION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button className="button primary" onClick={loadHistory}>
            <Search size={16} />
            Rechercher
          </Button>
        </div>
        <div className="panel reception-history-list">
          {historyLoading ? (
            <div className="loading">Recherche…</div>
          ) : !history.length ? (
            <div className="loading">
              Aucune réception ne correspond aux filtres.
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                className="reception-history-row"
                onClick={() =>
                  openReception(item.id, item.status === "in_progress" ? 0 : 4)
                }
              >
                <span>
                  <strong>{item.receptionCode}</strong>
                  <small>
                    {formatDateTime(item.createdAt)} ·{" "}
                    {item.supplierName || "Sans fournisseur"}
                    <br />
                    {item.productCount} produit(s) · {item.measuredCount}{" "}
                    contrôle(s)
                  </small>
                </span>
                <span className={`status-pill ${statusClass(item.status)}`}>
                  {RECEPTION_STATUS_LABELS[item.status]}
                </span>
                <ChevronRight size={18} />
              </button>
            ))
          )}
        </div>
      </section>
    );

  if (!reception) return null;
  return (
    <section className="receptions-view">
      <div className="reception-title-row">
        <Button
          variant="outline"
          className="icon-button"
          onClick={() => setMode("home")}
          aria-label="Retour"
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <p className="eyebrow">{reception.receptionCode}</p>
          <h2>
            {reception.status === "in_progress"
              ? "Nouvelle réception"
              : "Fiche de réception"}
          </h2>
          <p>
            {formatDateTime(reception.createdAt)} · {reception.createdByName}
          </p>
        </div>
        <span className={`status-pill ${statusClass(reception.status)}`}>
          {RECEPTION_STATUS_LABELS[reception.status]}
        </span>
      </div>
      {reception.status !== "in_progress" && (
        <div className="notice success">
          <ShieldCheck size={18} />
          <span>
            Réception validée le {formatDateTime(reception.validatedAt)} par{" "}
            {reception.validatedByName}.{" "}
            {canAdministerRegister(session.role)
              ? "Toute correction est conservée dans l’historique des modifications."
              : "Consultation seule : les corrections sont réservées au responsable."}
          </span>
        </div>
      )}
      <nav className="reception-steps" aria-label="Étapes de la réception">
        {steps.map((label, index) => (
          <button
            key={label}
            className={index === step ? "active" : index < step ? "done" : ""}
            onClick={() => setStep(index)}
          >
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>

      {step === 0 && (
        <div className="panel panel-pad reception-form">
          <div className="reception-section-head">
            <div>
              <h3>
                <Truck size={19} />
                Livraison
              </h3>
              <p>Date, heure et utilisateur sont horodatés automatiquement.</p>
            </div>
          </div>
          <PhotoOcr disabled={locked} fields={["supplierName", "deliveryNote"]} onApply={v => setReception(c => c ? {...c,...(v.supplierName?{supplierId:null,supplierName:v.supplierName}:{}),...(v.deliveryNote?{deliveryNote:v.deliveryNote}:{})}:c)} />
          <div className="reception-form-grid">
            <label className="field">
              Fournisseur
              <select
                className="input"
                value={reception.supplierId ?? "other"}
                disabled={locked}
                onChange={(e) => selectSupplier(e.target.value)}
              >
                <option value="other">Autre / saisie libre</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            {!reception.supplierId && (
              <label className="field">
                Nom du fournisseur
                <Input
                  className="input"
                  disabled={locked}
                  value={reception.supplierName}
                  onChange={(e) =>
                    setReception({ ...reception, supplierName: e.target.value })
                  }
                />
              </label>
            )}
            <label className="field">
              Nº de bon de livraison
              <Input
                className="input"
                disabled={locked}
                value={reception.deliveryNote}
                onChange={(e) =>
                  setReception({ ...reception, deliveryNote: e.target.value })
                }
              />
            </label>
            <label className="field">
              Nº de commande <span className="optional">facultatif</span>
              <Input
                className="input"
                disabled={locked}
                value={reception.orderNumber}
                onChange={(e) =>
                  setReception({ ...reception, orderNumber: e.target.value })
                }
              />
            </label>
            <label className="field">
              Nom du livreur <span className="optional">facultatif</span>
              <Input
                className="input"
                disabled={locked}
                value={reception.driverName}
                onChange={(e) =>
                  setReception({ ...reception, driverName: e.target.value })
                }
              />
            </label>
            <label className="field field-span">
              Observations générales
              <Textarea
                className="input"
                disabled={locked}
                value={reception.generalNotes}
                onChange={(e) =>
                  setReception({ ...reception, generalNotes: e.target.value })
                }
              />
            </label>
          </div>
          <div className="photo-control">
            <label className="button primary">
              <Camera size={18} />
              {photoBusy
                ? "Enregistrement…"
                : "Photographier le bon de livraison"}
              <input
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                disabled={photoBusy}
                onChange={(event) => {
                  setPhotoKind("delivery_note");
                  setPhotoProductId("");
                  void uploadPhoto(event, "delivery_note");
                }}
              />
            </label>
            <span>
              {deliveryPhotos.length
                ? `${deliveryPhotos.length} photo(s) enregistrée(s)`
                : "Recommandée · non obligatoire"}
            </span>
          </div>
          {!!deliveryPhotos.length && (
            <div className="photo-strip">
              {deliveryPhotos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.dataUrl}
                  alt="Bon de livraison"
                />
              ))}
            </div>
          )}
          <div className="wizard-actions">
            <span />
            <Button
              className="button primary"
              onClick={() => saveHeader(true)}
              disabled={saving || locked}
            >
              {saving ? (
                <LoaderCircle className="spinner" size={17} />
              ) : (
                <Save size={17} />
              )}
              Enregistrer et continuer
              <ChevronRight size={17} />
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="reception-products-layout">
          <div
            id="reception-product-form"
            className="panel panel-pad reception-form"
          >
            <div className="reception-section-head">
              <div>
                <h3>
                  <PackageCheck size={19} />
                  {editingId ? "Modifier le produit" : "Ajouter un produit"}
                </h3>
                <p>
                  Les seuils proposés restent modifiables selon l’étiquette du
                  fabricant et votre PMS.
                </p>
              </div>
            </div>
            <PhotoOcr key={editingId??"new-product"} disabled={locked} fields={["productName","supplierLot","deadlineType","deadlineDate","quantity"]} onApply={v=>setProductDraft(c=>({...c,...(v.productName?{productName:v.productName}:{}),...(v.supplierLot?{supplierLot:v.supplierLot}:{}),...(v.deadlineDate&&v.deadlineType?{deadlineDate:v.deadlineDate,deadlineType:v.deadlineType}:{}),...(v.quantity?{quantity:v.quantity}:{})}))}/>
            <BarcodeScanner
              role={session.role}
              disabled={locked}
              onApply={(values) => {
                const ingredient = values.ingredient;
                setProductDraft((current) => ({
                  ...current,
                  ...(ingredient
                    ? {
                        productName: ingredient.displayName,
                        category: ingredient.category,
                        temperatureRegime: ingredient.storageMode,
                        storageTemperature: ingredient.storageTemperature,
                        maxTemperature: ingredient.storageTemperature,
                        selectedForMeasurement: ingredient.storageMode !== "ambient",
                        suggestedForMeasurement: ingredient.storageMode !== "ambient",
                        measurementMethod:
                          ingredient.storageMode === "ambient" ? "" : "ir_surface",
                      }
                    : values.product
                      ? {
                          productName: values.product.productName,
                          category:
                            values.product.categories || current.category,
                        }
                      : {}),
                  supplierLot: values.lot || current.supplierLot,
                  deadlineDate: values.deadlineDate || current.deadlineDate,
                  deadlineType:
                    values.deadlineDate && values.deadlineType
                      ? values.deadlineType
                      : current.deadlineType,
                  quantity: values.quantity || current.quantity,
                }));
                if (values.supplier && reception)
                  setReception({
                    ...reception,
                    supplierId: values.supplier.id,
                    supplierName: values.supplier.name,
                  });
              }}
            />
            <label className="field">
              Produit connu
              <select
                className="input"
                defaultValue=""
                disabled={locked}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="">Sélectionner ou saisir librement</option>
                {RECEPTION_PRODUCT_PRESETS.map((preset, index) => (
                  <option key={`${preset.name}-${index}`} value={index}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="reception-form-grid">
              <label className="field">
                Nom du produit
                <Input
                  className="input"
                  disabled={locked}
                  value={productDraft.productName}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      productName: e.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                Famille / catégorie
                <Input
                  className="input"
                  disabled={locked}
                  value={productDraft.category}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      category: e.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                Conservation
                <select
                  className="input"
                  disabled={locked}
                  value={productDraft.temperatureRegime}
                  onChange={(e) => {
                    const regime = e.target.value as TemperatureRegime;
                    setProductDraft({
                      ...productDraft,
                      temperatureRegime: regime,
                      selectedForMeasurement: regime !== "ambient",
                      storageTemperature:
                        regime === "frozen"
                          ? -18
                          : regime === "refrigerated"
                            ? 4
                            : null,
                      maxTemperature:
                        regime === "frozen"
                          ? -18
                          : regime === "refrigerated"
                            ? 4
                            : null,
                      deadlineType:
                        regime === "ambient"
                          ? "ddm"
                          : productDraft.deadlineType,
                    });
                  }}
                >
                  <option value="refrigerated">Réfrigéré</option>
                  <option value="frozen">Surgelé / congelé</option>
                  <option value="ambient">Température ambiante</option>
                </select>
              </label>
              <label className="field">
                Risque
                <select
                  className="input"
                  disabled={locked}
                  value={productDraft.riskLevel}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      riskLevel: e.target.value as "normal" | "high",
                    })
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="high">Élevé / très périssable</option>
                </select>
              </label>
              <label className="field">
                Quantité
                <Input
                  className="input"
                  disabled={locked}
                  inputMode="decimal"
                  value={productDraft.quantity}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      quantity: e.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                Unité
                <select
                  className="input"
                  disabled={locked}
                  value={productDraft.unit}
                  onChange={(e) =>
                    setProductDraft({ ...productDraft, unit: e.target.value })
                  }
                >
                  <option>kg</option>
                  <option>g</option>
                  <option>pièce(s)</option>
                  <option>carton(s)</option>
                  <option>litre(s)</option>
                  <option>palette(s)</option>
                </select>
              </label>
              <label className="field">
                Lot fournisseur
                <Input
                  className="input"
                  disabled={locked}
                  value={productDraft.supplierLot}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      supplierLot: e.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                Date
                <select
                  className="input"
                  disabled={locked}
                  value={productDraft.deadlineType}
                  onChange={(e) =>
                    setProductDraft({
                      ...productDraft,
                      deadlineType: e.target
                        .value as ProductDraft["deadlineType"],
                      deadlineDate:
                        e.target.value === "none"
                          ? null
                          : productDraft.deadlineDate,
                    })
                  }
                >
                  <option value="dlc">DLC</option>
                  <option value="ddm">DDM</option>
                  <option value="none">Sans date</option>
                </select>
              </label>
              {productDraft.deadlineType !== "none" && (
                <label className="field">
                  {productDraft.deadlineType.toUpperCase()}
                  <Input
                    className="input"
                    type="date"
                    disabled={locked}
                    value={productDraft.deadlineDate ?? ""}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        deadlineDate: e.target.value || null,
                      })
                    }
                  />
                </label>
              )}
              {productDraft.temperatureRegime !== "ambient" && (
                <>
                  <label className="field">
                    Température de conservation
                    <TemperatureInput
                      disabled={locked}
                      value={productDraft.storageTemperature}
                      onChange={(value) =>
                        setProductDraft({
                          ...productDraft,
                          storageTemperature: value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Température maximale autorisée
                    <TemperatureInput
                      disabled={locked}
                      value={productDraft.maxTemperature}
                      onChange={(value) =>
                        setProductDraft({
                          ...productDraft,
                          maxTemperature: value,
                        })
                      }
                    />
                  </label>
                </>
              )}
            </div>
            <div className="reception-check-grid">
              <ToggleField
                label="Emballage conforme"
                value={productDraft.packagingCompliant}
                disabled={locked}
                onChange={(value) =>
                  setProductDraft({
                    ...productDraft,
                    packagingCompliant: value,
                  })
                }
              />
              <ToggleField
                label="État visuel conforme"
                value={productDraft.visualCompliant}
                disabled={locked}
                onChange={(value) =>
                  setProductDraft({ ...productDraft, visualCompliant: value })
                }
              />
            </div>
            <label className="field">
              Observations
              <Textarea
                className="input"
                disabled={locked}
                value={productDraft.observations}
                onChange={(e) =>
                  setProductDraft({
                    ...productDraft,
                    observations: e.target.value,
                  })
                }
              />
            </label>
            <div className="button-row">
              <Button
                className="button primary"
                onClick={saveProduct}
                disabled={saving || locked}
              >
                {editingId ? <Pencil size={16} /> : <Plus size={16} />}
                {editingId ? "Enregistrer la correction" : "Ajouter ce produit"}
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  className="button"
                  onClick={() => {
                    setEditingId(null);
                    setProductDraft(blankProduct());
                  }}
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>
          <div className="panel reception-product-list">
            <div className="reception-section-head">
              <div>
                <h3>{products.length} produit(s) reçu(s)</h3>
                <p>Ajoutez tous les lots de la livraison.</p>
              </div>
            </div>
            {!products.length ? (
              <div className="loading">Aucun produit ajouté.</div>
            ) : (
              products.map((product) => (
                <article key={product.id} className="reception-product-row">
                  <div>
                    <strong>{product.productName}</strong>
                    <small>
                      {product.quantity} {product.unit} · Lot{" "}
                      {product.supplierLot || "—"}
                      <br />
                      {product.temperatureRegime === "ambient"
                        ? "Ambiant"
                        : product.temperatureRegime === "frozen"
                          ? "Surgelé"
                          : "Réfrigéré"}{" "}
                      {product.maxTemperature !== null
                        ? `· max ${tempText(product.maxTemperature)}`
                        : ""}
                    </small>
                  </div>
                  <div className="button-row">
                    <Button
                      variant="outline"
                      className="icon-button"
                      onClick={() => editProduct(product)}
                      aria-label="Modifier"
                    >
                      <Pencil size={16} />
                    </Button>
                    {reception.status === "in_progress" && (
                      <Button
                        variant="outline"
                        className="icon-button danger-button"
                        onClick={() => deleteProduct(product)}
                        aria-label="Retirer"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="wizard-actions">
            <Button
              variant="outline"
              className="button"
              onClick={() => setStep(0)}
            >
              <ChevronLeft size={17} />
              Retour
            </Button>
            <Button
              className="button primary"
              onClick={() =>
                products.length
                  ? setStep(2)
                  : toast.error("Ajoutez au moins un produit.")
              }
              disabled={saving}
            >
              Contrôler les températures
              <ChevronRight size={17} />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="panel panel-pad reception-form">
          <div className="reception-section-head">
            <div>
              <h3>
                <Thermometer size={19} />
                Contrôles recommandés
              </h3>
              <p>
                {cold.length
                  ? `${Math.min(3, products.filter((p) => p.temperatureRegime === "refrigerated").length)} réfrigéré(s) et ${Math.min(2, products.filter((p) => p.temperatureRegime === "frozen").length)} surgelé(s) selon la livraison.`
                  : "Aucun contrôle de température systématique pour les produits ambiants."}
              </p>
            </div>
            <span className="status-pill">
              {coldSelected} sélectionné(s) · {measured} mesuré(s)
            </span>
          </div>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              L’échantillonnage privilégie les viandes, poissons, produits très
              périssables, surgelés et produits signalés à risque. Vous pouvez
              adapter la sélection. Seuls les produits cochés comme réellement
              mesurés seront comptés.
            </span>
          </div>
          <div className="reception-control-list">
            {products.map((product) => {
              const needsProbe = probeRequired(product),
                badProbe = probeNonCompliant(product),
                irOk =
                  product.selectedForMeasurement &&
                  product.irTemperature !== null &&
                  !needsProbe;
              return (
                <article
                  key={product.id}
                  className={`reception-control-card ${needsProbe ? "alert" : irOk ? "ok" : ""}`}
                >
                  <div className="reception-control-title">
                    <div>
                      <strong>{product.productName}</strong>
                      <small>
                        {product.temperatureRegime === "ambient"
                          ? "Produit à température ambiante"
                          : `Tolérance configurée : ≤ ${tempText(product.maxTemperature)}`}
                      </small>
                    </div>
                    {product.suggestedForMeasurement &&
                      product.temperatureRegime !== "ambient" && (
                        <span className="status-pill warn">Recommandé</span>
                      )}
                  </div>
                  {product.temperatureRegime === "ambient" ? (
                    <div className="reception-check-grid ambient-checks">
                      <ToggleField
                        label="Emballage intact"
                        value={product.packagingCompliant}
                        disabled={locked}
                        onChange={(value) =>
                          updateProduct(product.id, {
                            packagingCompliant: value,
                          })
                        }
                      />
                      <ToggleField
                        label="État visuel"
                        value={product.visualCompliant}
                        disabled={locked}
                        onChange={(value) =>
                          updateProduct(product.id, { visualCompliant: value })
                        }
                      />
                      <ToggleField
                        label="Propreté"
                        value={product.cleanlinessCompliant}
                        disabled={locked}
                        onChange={(value) =>
                          updateProduct(product.id, {
                            cleanlinessCompliant: value,
                          })
                        }
                      />
                      <ToggleField
                        label="Absence d’humidité"
                        value={product.humidityAbsent}
                        disabled={locked}
                        onChange={(value) =>
                          updateProduct(product.id, { humidityAbsent: value })
                        }
                      />
                      <ToggleField
                        label="Absence de nuisibles"
                        value={product.pestsAbsent}
                        disabled={locked}
                        onChange={(value) =>
                          updateProduct(product.id, { pestsAbsent: value })
                        }
                      />
                      <ToggleField
                        label="Produit conforme"
                        value={product.productCompliant}
                        disabled={locked}
                        onChange={(value) =>
                          updateProduct(product.id, { productCompliant: value })
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <label className="sample-toggle">
                        <input
                          type="checkbox"
                          checked={product.selectedForMeasurement}
                          disabled={locked}
                          onChange={(e) =>
                            updateProduct(product.id, {
                              selectedForMeasurement: e.target.checked,
                            })
                          }
                        />
                        <span>Produit réellement mesuré</span>
                      </label>
                      {product.selectedForMeasurement && (
                        <div className="temperature-control-grid">
                          <label className="field big-temperature">
                            Température IR
                            <TemperatureInput
                              placeholder="ex. -18,4"
                              disabled={locked}
                              value={product.irTemperature}
                              onChange={(value) =>
                                updateProduct(product.id, {
                                  irTemperature: value,
                                  measurementMethod: "ir_surface",
                                })
                              }
                            />
                            <span>°C</span>
                          </label>
                          <div
                            className={`control-result ${needsProbe ? "danger" : irOk ? "success" : ""}`}
                          >
                            {needsProbe ? (
                              <>
                                <AlertTriangle size={18} />
                                <strong>
                                  Température hors tolérance — contrôle par
                                  sonde requis
                                </strong>
                              </>
                            ) : irOk ? (
                              <>
                                <CheckCircle2 size={18} />
                                <strong>Contrôle initial conforme</strong>
                              </>
                            ) : (
                              <span>Saisissez la lecture IR de surface.</span>
                            )}
                          </div>
                        </div>
                      )}
                      {needsProbe && (
                        <div className="probe-box">
                          <div className="temperature-control-grid">
                            <label className="field big-temperature">
                              Température sonde
                              <TemperatureInput
                                placeholder="ex. +3,9"
                                disabled={locked}
                                value={product.probeTemperature}
                                onChange={(value) =>
                                  updateProduct(product.id, {
                                    probeTemperature: value,
                                  })
                                }
                              />
                              <span>°C</span>
                            </label>
                            <label className="field">
                              Méthode de mesure
                              <select
                                className="input"
                                disabled={locked}
                                value={
                                  product.measurementMethod === "ir_surface"
                                    ? ""
                                    : product.measurementMethod
                                }
                                onChange={(e) =>
                                  updateProduct(product.id, {
                                    measurementMethod: e.target.value,
                                  })
                                }
                              >
                                <option value="">Sélectionner</option>
                                <option value="between_packages">
                                  Sonde entre emballages
                                </option>
                                <option value="contact">
                                  Sonde au contact
                                </option>
                                <option value="core">Sonde à cœur</option>
                              </select>
                            </label>
                          </div>
                          {product.probeTemperature !== null && (
                            <div
                              className={`notice ${badProbe ? "error" : "success"}`}
                            >
                              {badProbe ? (
                                <>
                                  <XCircle size={18} />
                                  <span>
                                    <strong>NON-CONFORMITÉ TEMPÉRATURE</strong>
                                    <br />
                                    Une action corrective et une décision seront
                                    obligatoires.
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={18} />
                                  <span>
                                    <strong>
                                      Contrôle complémentaire conforme
                                    </strong>
                                    <br />
                                    La lecture IR initiale reste enregistrée.
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
          <div className="wizard-actions">
            <Button
              variant="outline"
              className="button"
              onClick={() => setStep(1)}
            >
              <ChevronLeft size={17} />
              Retour
            </Button>
            <Button
              className="button primary"
              onClick={() => saveAllProducts(3)}
              disabled={saving || locked}
            >
              {saving ? (
                <LoaderCircle className="spinner" size={17} />
              ) : (
                <Save size={17} />
              )}
              Enregistrer et continuer
              <ChevronRight size={17} />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="panel panel-pad reception-form">
          <div className="reception-section-head">
            <div>
              <h3>
                <AlertTriangle size={19} />
                Anomalies et preuves
              </h3>
              <p>
                Une lecture IR superficielle douteuse ne suffit pas à conclure :
                la décision s’appuie sur la sonde et le contexte.
              </p>
            </div>
            <span
              className={`status-pill ${anomalies.length ? "danger" : "ok"}`}
            >
              {anomalies.length} anomalie(s)
            </span>
          </div>
          {!anomalies.length && (
            <div className="notice success">
              <CheckCircle2 size={18} />
              <span>
                Aucune non-conformité confirmée. Vous pouvez ajouter des photos
                facultatives puis valider.
              </span>
            </div>
          )}
          {anomalies.map((product) => (
            <article className="nonconformity-card" key={product.id}>
              <h4>❌ NON-CONFORMITÉ · {product.productName}</h4>
              <p>
                IR {tempText(product.irTemperature)} · Sonde{" "}
                {tempText(product.probeTemperature)} · max{" "}
                {tempText(product.maxTemperature)}
              </p>
              <div className="reception-form-grid">
                <label className="field">
                  Action / décision
                  <select
                    className="input"
                    disabled={locked}
                    value={product.decisionType ?? ""}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        decisionType: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Sélectionner</option>
                    {Object.entries(DECISION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Quantité concernée
                  <Input
                    className="input"
                    disabled={locked}
                    value={product.concernedQuantity}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        concernedQuantity: e.target.value,
                      })
                    }
                  />
                </label>
                {product.decisionType === "new_measure" && (
                  <label className="field">
                    Nouvelle mesure
                    <TemperatureInput
                      disabled={locked}
                      value={product.remeasureTemperature}
                      onChange={(value) =>
                        updateProduct(product.id, {
                          remeasureTemperature: value,
                        })
                      }
                    />
                  </label>
                )}
                <label className="field field-span">
                  Motif
                  <Textarea
                    className="input"
                    disabled={locked}
                    value={product.nonConformityReason}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        nonConformityReason: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="field field-span">
                  Action corrective
                  <Textarea
                    className="input"
                    disabled={locked}
                    value={product.correctiveAction}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        correctiveAction: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="field field-span">
                  Décision finale
                  <Textarea
                    className="input"
                    disabled={locked}
                    value={product.finalDecision}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        finalDecision: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="field field-span">
                  Commentaire complémentaire
                  <Textarea
                    className="input"
                    disabled={locked}
                    value={product.nonConformityComment}
                    onChange={(e) =>
                      updateProduct(product.id, {
                        nonConformityComment: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </article>
          ))}
          <div className="photo-upload-box">
            <div>
              <strong>
                <Camera size={18} />
                Ajouter une photo
              </strong>
              <p>
                En conformité : facultative. En anomalie : produit, thermomètre
                et étiquette/lot recommandés pour renforcer la preuve.
              </p>
            </div>
            <div className="reception-form-grid">
              <label className="field">
                Type
                <select
                  className="input"
                  value={photoKind}
                  onChange={(e) => setPhotoKind(e.target.value as PhotoKind)}
                >
                  <option value="delivery_note">Bon de livraison</option>
                  <option value="product">Produit</option>
                  <option value="thermometer">Thermomètre</option>
                  <option value="label">Étiquette / lot</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="field">
                Produit lié
                <select
                  className="input"
                  value={photoProductId}
                  onChange={(e) => setPhotoProductId(e.target.value)}
                >
                  <option value="">Réception générale</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.productName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="button primary">
              <Camera size={17} />
              {photoBusy ? "Enregistrement…" : "Prendre ou choisir une photo"}
              <input
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                disabled={photoBusy}
                onChange={uploadPhoto}
              />
            </label>
          </div>
          {!!photos.length && (
            <div className="photo-strip">
              {photos.map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.dataUrl} alt={photo.kind} />
                  <figcaption>{photo.kind.replaceAll("_", " ")}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className="muted-note">
            Les photos renforcent les éléments de preuve. L’autocontrôle HACCP
            reste le relevé saisi et validé par l’utilisateur connecté.
          </p>
          <div className="wizard-actions">
            <Button
              variant="outline"
              className="button"
              onClick={() => setStep(2)}
            >
              <ChevronLeft size={17} />
              Retour
            </Button>
            <Button
              className="button primary"
              onClick={() => saveAllProducts(4)}
              disabled={saving || locked}
            >
              Enregistrer et récapituler
              <ChevronRight size={17} />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="panel panel-pad reception-form">
          <div className="reception-section-head">
            <div>
              <h3>
                <ClipboardCheck size={19} />
                Validation du responsable
              </h3>
              <p>
                L’utilisateur connecté et le bouton de validation constituent la
                validation numérique de l’autocontrôle.
              </p>
            </div>
          </div>
          <div className="reception-summary-grid">
            <div>
              <span>Fournisseur</span>
              <strong>{reception.supplierName || "À renseigner"}</strong>
            </div>
            <div>
              <span>Bon de livraison</span>
              <strong>{reception.deliveryNote || "À renseigner"}</strong>
            </div>
            <div>
              <span>Produits</span>
              <strong>{products.length}</strong>
            </div>
            <div>
              <span>Mesures IR</span>
              <strong>{measured}</strong>
            </div>
            <div>
              <span>Contrôles sonde</span>
              <strong>
                {products.filter((p) => p.probeTemperature !== null).length}
              </strong>
            </div>
            <div>
              <span>Anomalies</span>
              <strong>{anomalies.length}</strong>
            </div>
          </div>
          {products.map((product) => (
            <div className="reception-validation-row" key={product.id}>
              <span>
                <strong>{product.productName}</strong>
                <small>
                  Lot {product.supplierLot} ·{" "}
                  {product.selectedForMeasurement
                    ? `IR ${tempText(product.irTemperature)}${product.probeTemperature !== null ? ` · Sonde ${tempText(product.probeTemperature)}` : ""}`
                    : "Non mesuré (échantillonnage)"}
                </small>
              </span>
              {probeNonCompliant(product) ? (
                <span className="status-pill danger">Non conforme</span>
              ) : (
                <span className="status-pill ok">Conforme</span>
              )}
            </div>
          ))}
          <label className="field reception-pin">
            Validation par PIN{" "}
            <span className="optional">facultative · 4 à 8 chiffres</span>
            <Input
              className="input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <div className="notice">
            <UserCheck size={18} />
            <span>
              Responsable : <strong>{session.displayName}</strong>. La date,
              l’heure, l’appareil, toutes les températures et toutes les
              modifications seront conservés.
            </span>
          </div>
          <div className="wizard-actions">
            <Button
              variant="outline"
              className="button"
              onClick={() => setStep(3)}
            >
              <ChevronLeft size={17} />
              Retour
            </Button>
            {reception.status === "in_progress" || canAdministerRegister(session.role) ? (
              <Button
                className="button primary validate-reception"
                onClick={validateReception}
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle className="spinner" size={19} />
                ) : (
                  <CheckCircle2 size={20} />
                )}
                ✅{" "}
                {reception.status === "in_progress"
                  ? "Valider la réception"
                  : "Revalider la correction"}
              </Button>
            ) : (
              <Button className="button primary" onClick={() => setStep(5)}>
                Validation du livreur
                <ChevronRight size={17} />
              </Button>
            )}
          </div>
          {reception.validatedAt && (
            <div className="report-link-row">
              <Link
                className="button"
                href={`/receptions/${reception.id}`}
                target="_blank"
              >
                <FileDown size={17} />
                Rapport HACCP / PDF
              </Link>
              <button className="button" onClick={() => setStep(5)}>
                Validation du livreur
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="panel panel-pad reception-form">
          <div className="reception-section-head">
            <div>
              <h3>
                <UserCheck size={19} />
                Validation du livreur
              </h3>
              <p>
                {anomalies.length
                  ? "Recommandée en cas de réserve, refus ou non-conformité."
                  : "Facultative pour une réception conforme."}
              </p>
            </div>
          </div>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              La signature confirme la présence ou la prise de connaissance de
              la livraison, d’une réserve ou d’une non-conformité. Elle ne
              certifie pas l’exactitude technique de la température.
            </span>
          </div>
          <div className="reception-form-grid">
            <label className="field">
              Nom du livreur
              <Input className="input" value={reception.driverName} readOnly />
            </label>
            <label className="field">
              Société
              <Input
                className="input"
                value={driverCompany}
                onChange={(e) => setDriverCompany(e.target.value)}
              />
            </label>
            <label className="field">
              Initiales
              <Input
                className="input"
                maxLength={20}
                value={driverInitials}
                onChange={(e) => setDriverInitials(e.target.value)}
              />
            </label>
          </div>
          <label className="sample-toggle refusal-toggle">
            <input
              type="checkbox"
              checked={driverRefused}
              onChange={(e) => {
                setDriverRefused(e.target.checked);
                if (e.target.checked) setSignature(null);
              }}
            />
            <span>Le livreur refuse de signer</span>
          </label>
          {driverRefused ? (
            <label className="field">
              Commentaire sur le refus
              <Textarea
                className="input"
                value={driverRefusalComment}
                onChange={(e) => setDriverRefusalComment(e.target.value)}
              />
            </label>
          ) : (
            <SignaturePad value={signature} onChange={setSignature} />
          )}
          <div className="wizard-actions">
            <Button
              variant="outline"
              className="button"
              onClick={() => setStep(4)}
            >
              <ChevronLeft size={17} />
              Retour
            </Button>
            <Button
              className="button primary"
              onClick={saveSignature}
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle className="spinner" size={17} />
              ) : (
                <Save size={17} />
              )}
              Enregistrer l’étape livreur
            </Button>
          </div>
          <div className="reception-finish">
            <Link
              className="button"
              href={`/receptions/${reception.id}`}
              target="_blank"
            >
              <FileDown size={17} />
              Ouvrir le rapport HACCP
            </Link>
            <Button className="button primary" onClick={() => setMode("home")}>
              Terminer
            </Button>
          </div>
          {!!audits.length && (
            <details className="audit-details">
              <summary>Historique des modifications ({audits.length})</summary>
              {audits.slice(0, 50).map((event) => (
                <div key={event.id}>
                  <strong>
                    {formatDateTime(event.changedAt)} · {event.changedByName}
                  </strong>
                  <span>
                    {event.action} · {event.fieldName || event.entityType}
                    {event.oldValue !== null
                      ? ` · « ${event.oldValue} » → « ${event.newValue ?? ""} »`
                      : ""}
                  </span>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
