"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ChefHat,
  Download,
  FileDown,
  Bluetooth,
  Building2,
  Info,
  Link2,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Save,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Tag,
  Thermometer,
  Timer,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  addHoursLocal,
  CUSTOM_PREPARATION_CATEGORY,
  CUSTOM_PREPARATION_CODE,
  customPreparationPreset,
  durationText,
  labelStartAt,
  minutesBetween,
  PREPARATION_PRESETS,
  PRESET_CATEGORIES,
  PROCESS_LABELS,
  SOURCE_STATE_LABELS,
  presetFor,
  presetFromLabel,
  shortDateTime,
  temperatureText,
  type PreparationLabel,
  type PreparationPreset,
  type ProcessType,
} from "@/lib/labels";
import { canAdministerRegister, type RegisterSession } from "@/lib/access-types";
import { COOLING_TARGET_MAX_C } from "@/lib/label-payload";
import {
  freezeSourceProblem,
  type PreparationKind,
  type PreviousPreparation,
} from "@/lib/preparation-history";
import { drawCrispQr } from "@/lib/qr-renderer";
import type { SupplierLot } from "@/lib/supply";
import { supportsT50DirectPrint, T50MPrinter } from "@/lib/t50m-printer";
import SupplierLotsPanel from "./supplier-lots-panel";
import QuickLabelsPanel from "./quick-labels-panel";
import PhotoOcr, { type EvidencePhotoDraft } from "./photo-ocr";
import BarcodeScanner from "./barcode-scanner";
import PreviousPreparations from "./previous-preparations";
import WastePanel from "./waste-panel";
import UnifiedLabelRegister from "./unified-label-register";

type FormState = {
  productCode: string;
  productName: string;
  customCategory: string;
  customProcessType: ProcessType;
  customStorageTemperature: string;
  durationHours: string;
  preparedAt: string;
  frozenAt: string;
  operatorInitials: string;
  lotCode: string;
  quantity: string;
  packaging: string;
  note: string;
  supplierName: string;
  supplierLot: string;
  supplierDeadline: string;
  receivedAt: string;
  openedAt: string;
  sourceLabelId: string;
  sourceLotIds: string[];
  cookingEndedAt: string;
  cookingTemperature: string;
  coolingStartedAt: string;
  coolingStartTemperature: string;
  coolingEndedAt: string;
  coolingEndTemperature: string;
  coolingMethod: string;
  thawingStartedAt: string;
  thawingMethod: string;
  freezeMethod: string;
  freezerTemperature: string;
  correctiveAction: string;
};
function nowParis() {
  const parts = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date()),
    v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return v.year + "-" + v.month + "-" + v.day + "T" + v.hour + ":" + v.minute;
}
function newForm(p: PreparationPreset, initials = ""): FormState {
  const n = nowParis(),
    opened = p.processType === "opened" || p.processType === "supplier_frozen",
    cooked = p.processType === "cooked_cooled",
    thawed = p.processType === "thawed",
    frozen = p.processType === "frozen_in_house";
  return {
    productCode: p.code,
    productName: p.name,
    customCategory: presetFor(p.code) ? "" : p.category,
    customProcessType: p.processType,
    customStorageTemperature: String(p.storageTemperature),
    durationHours: String(p.durationHours),
    preparedAt: n,
    frozenAt: frozen ? n : "",
    operatorInitials: initials,
    lotCode: "",
    quantity: "",
    packaging: "Bac fermé",
    note: "",
    supplierName: "",
    supplierLot: "",
    supplierDeadline: "",
    receivedAt: "",
    openedAt: opened ? n : "",
    sourceLabelId: "",
    sourceLotIds: [],
    cookingEndedAt: cooked ? n : "",
    cookingTemperature: cooked ? "63" : "",
    coolingStartedAt: cooked ? n : "",
    coolingStartTemperature: cooked ? "63" : "",
    coolingEndedAt: cooked ? n : "",
    coolingEndTemperature: "",
    coolingMethod: cooked ? "petits_volumes" : "",
    thawingStartedAt: thawed ? n : "",
    thawingMethod: thawed ? "chambre_froide" : "",
    freezeMethod: frozen ? "Congélateur à −18 °C" : "",
    freezerTemperature: frozen ? "-18" : "",
    correctiveAction: "",
  };
}
function editForm(l: PreparationLabel): FormState {
  const opened =
      l.processType === "opened" || l.processType === "supplier_frozen",
    cooked = l.processType === "cooked_cooled",
    thawed = l.processType === "thawed",
    frozen = l.processType === "frozen_in_house";
  return {
    productCode: l.productCode,
    productName: l.productName,
    customCategory: presetFor(l.productCode) ? "" : l.category,
    customProcessType: l.processType,
    customStorageTemperature: String(l.storageTemperature),
    durationHours: String(l.durationHours),
    preparedAt: l.preparedAt,
    frozenAt: frozen ? (l.frozenAt ?? "") : "",
    operatorInitials: l.operatorInitials,
    lotCode: l.lotCode,
    quantity: l.quantity,
    packaging: l.packaging,
    note: l.note,
    supplierName: l.supplierName,
    supplierLot: l.supplierLot,
    supplierDeadline: l.supplierDeadline ?? "",
    receivedAt: l.receivedAt ?? "",
    openedAt: opened ? (l.openedAt ?? "") : "",
    sourceLabelId: l.sourceLabelId ?? "",
    sourceLotIds: l.sourceLotIds,
    cookingEndedAt: cooked ? (l.cookingEndedAt ?? "") : "",
    cookingTemperature:
      cooked && l.cookingTemperature !== null
        ? String(l.cookingTemperature)
        : "",
    coolingStartedAt: cooked ? (l.coolingStartedAt ?? "") : "",
    coolingStartTemperature:
      cooked && l.coolingStartTemperature !== null
        ? String(l.coolingStartTemperature)
        : "",
    coolingEndedAt: cooked ? (l.coolingEndedAt ?? "") : "",
    coolingEndTemperature:
      cooked && l.coolingEndTemperature !== null
        ? String(l.coolingEndTemperature)
        : "",
    coolingMethod:
      cooked && l.coolingMethod !== "cellule" ? l.coolingMethod : "",
    thawingStartedAt: thawed ? (l.thawingStartedAt ?? "") : "",
    thawingMethod: thawed ? l.thawingMethod : "",
    freezeMethod: frozen ? l.freezeMethod : "",
    freezerTemperature:
      frozen && l.freezerTemperature !== null
        ? String(l.freezerTemperature)
        : "",
    correctiveAction: l.correctiveAction,
  };
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...options, cache: "no-store" }),
    type = r.headers.get("content-type") ?? "";
  if (!type.includes("application/json"))
    throw new Error("Votre session a expiré. Rouvrez l’application.");
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "La demande a échoué.");
  return data;
}
const safe = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let size = 27,
    lines: string[] = [];
  while (size >= 18) {
    ctx.font = "700 " + size + "px Arial";
    lines = [];
    let current = "";
    for (const word of text.split(/\s+/)) {
      const next = current ? current + " " + word : word;
      if (ctx.measureText(next).width <= max) current = next;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (lines.length <= 2) return { size, lines };
    size--;
  }
  return { size: 18, lines: [text.slice(0, 22), text.slice(22, 43)] };
}
async function draw(
  canvas: HTMLCanvasElement,
  l: PreparationLabel,
  url: string,
) {
  canvas.width = 384;
  canvas.height = 240;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Aperçu indisponible.");
  c.fillStyle = "#fff";
  c.fillRect(0, 0, 384, 240);
  c.fillStyle = "#000";
  c.fillText("SANCTA MARIA 1187", 15, 21);
  c.font = "12px Arial";
  c.textAlign = "right";
  c.fillText("HACCP · 50 × 30 mm", 370, 21);
  c.textAlign = "left";
  c.fillRect(14, 29, 356, 2);
  const product = fit(c, l.productName, 214);
  c.font = "700 " + product.size + "px Arial";
  product.lines
    .slice(0, 2)
    .forEach((line, i) => c.fillText(line, 15, 59 + i * (product.size + 2)));
  const p = presetFromLabel(l);
  c.font = "700 18px Arial";
  c.fillText(
    (p?.startLabel ?? "PRÉP.") + " " + shortDateTime(labelStartAt(l, p)),
    15,
    130,
  );
  c.fillText(
    (l.storageMode === "frozen" ? "LIM. " : "DLC  ") +
      shortDateTime(l.expiresAt),
    15,
    156,
  );
  c.font = "700 16px Arial";
  c.fillText(
    "OP. " + l.operatorInitials + " · " + temperatureText(l.storageTemperature),
    15,
    184,
  );
  c.font = "12px Arial";
  c.fillText("LOT " + l.lotCode.slice(0, 24), 15, 207);
  c.fillText("ID " + l.id.slice(0, 8).toUpperCase(), 15, 228);
  drawCrispQr(c, url, 236, 36, 144);
  c.font = "700 12px Arial";
  c.textAlign = "center";
  c.fillText("SCANNER LA FICHE", 310, 197);
}
function title(icon: ReactNode, name: string, help: string) {
  return (
    <div className="trace-section-title">
      <span>{icon}</span>
      <div>
        <h3>{name}</h3>
        <p>{help}</p>
      </div>
    </div>
  );
}

export default function LabelsPanel({ session }: { session: RegisterSession }) {
  const initial = PREPARATION_PRESETS[0],
    [form, setForm] = useState<FormState>(() => {
      let i = "";
      try {
        i = localStorage.getItem("sancta-initials") ?? "";
      } catch {}
      return newForm(initial, i);
    }),
    [productSearch, setProductSearch] = useState(""),
    [labels, setLabels] = useState<PreparationLabel[]>([]),
    [supplierLots, setSupplierLots] = useState<SupplierLot[]>([]),
    [section, setSection] = useState<"labels" | "suppliers" | "quick" | "waste">("labels"),
    [saved, setSaved] = useState<PreparationLabel | null>(null),
    [editing, setEditing] = useState<PreparationLabel | null>(null),
    [previous, setPrevious] = useState<PreviousPreparation | null>(null),
    [freezeDraft, setFreezeDraft] = useState<{
      scope: "all" | "partial";
      reason: string;
      confirmed: boolean;
    } | null>(null),
    [pendingDelete, setPendingDelete] = useState<PreparationLabel | null>(null),
    [saving, setSaving] = useState(false),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState(""),
    [previewReady, setPreviewReady] = useState(false),
    [directSupported] = useState(() => supportsT50DirectPrint()),
    [printerConnected, setPrinterConnected] = useState(false),
    [printerBusy, setPrinterBusy] = useState(false),
    [printerMessage, setPrinterMessage] = useState(""),
    [printCopies, setPrintCopies] = useState(1),
    [printProgress, setPrintProgress] = useState(0),
    [sourcePhoto, setSourcePhoto] = useState<EvidencePhotoDraft | null>(null),
    [photoResetKey, setPhotoResetKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null),
    printerRef = useRef<T50MPrinter | null>(null),
    formRef = useRef<HTMLFormElement>(null);
  const rememberedItems = new Map<string, PreparationPreset>();
  for (const label of labels)
    if (!presetFor(label.productCode) && !rememberedItems.has(label.productCode))
      rememberedItems.set(label.productCode, presetFromLabel(label));
  const rememberedPresets = [...rememberedItems.values()],
    availablePresets = [...PREPARATION_PRESETS, ...rememberedPresets],
    categories = [
      ...PRESET_CATEGORIES,
      ...availablePresets
        .map((item) => item.category)
        .filter((category) => !PRESET_CATEGORIES.includes(category)),
    ].filter((category, index, all) => all.indexOf(category) === index),
    isCustomPreparation = !presetFor(form.productCode),
    preset =
      presetFor(form.productCode) ??
      customPreparationPreset({
        code: form.productCode,
        name: form.productName,
        category: form.customCategory,
        durationHours: Number(form.durationHours),
        processType: form.customProcessType,
        storageTemperature: Number(form.customStorageTemperature),
      }),
    productQuery = productSearch.trim().toLowerCase(),
    filtered = productQuery
      ? availablePresets.filter((item) =>
          (item.name + " " + item.category).toLowerCase().includes(productQuery),
        )
      : availablePresets;
  const starts =
      preset.dateBasis === "opened"
        ? form.openedAt
        : preset.dateBasis === "thawed"
          ? form.thawingStartedAt
          : preset.dateBasis === "frozen"
            ? form.frozenAt
            : preset.dateBasis === "cooled"
              ? form.coolingEndedAt
              : form.preparedAt,
    expires =
      preset.supplierExpiry && form.supplierDeadline
        ? form.supplierDeadline + "T23:59"
        : addHoursLocal(starts, Number(form.durationHours)),
    coolMinutes = minutesBetween(form.coolingStartedAt, form.coolingEndedAt),
    coolOK =
      preset.processType === "cooked_cooled" &&
      form.cookingTemperature !== "" &&
      form.coolingStartTemperature !== "" &&
      form.coolingEndTemperature !== "" &&
      coolMinutes !== null &&
      coolMinutes >= 0 &&
      coolMinutes <= 120 &&
      Number(form.cookingTemperature) >= 63 &&
      Number(form.coolingStartTemperature) >= 63 &&
      Number(form.coolingEndTemperature) <= COOLING_TARGET_MAX_C,
    freezeOK =
      preset.processType === "frozen_in_house" &&
      form.freezerTemperature !== "" &&
      Number(form.freezerTemperature) <= -18,
    nonconform =
      (preset.processType === "cooked_cooled" && !coolOK) ||
      (preset.processType === "frozen_in_house" && !freezeOK);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ labels: PreparationLabel[] }>("/api/labels"),
      api<{ lots: SupplierLot[] }>("/api/supplier-lots"),
    ])
      .then(([labelResult, lotResult]) => {
        if (active) {
          setLabels(labelResult.labels);
          setSupplierLots(lotResult.lots);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Impossible de charger les étiquettes.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const refresh = () => {
      void api<{ labels: PreparationLabel[] }>("/api/labels")
        .then((result) => setLabels(result.labels))
        .catch(() => {});
    };
    window.addEventListener("haccp-labels-changed", refresh);
    return () => window.removeEventListener("haccp-labels-changed", refresh);
  }, []);
  useEffect(() => {
    return () => {
      void printerRef.current?.disconnect();
    };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      freezeId = params.get("freezeId"),
      kind = params.get("freezeKind") as PreparationKind | null;
    if (!freezeId || (kind !== "classic" && kind !== "quick")) return;
    void openFreezing(kind, freezeId);
    params.delete("freezeId");
    params.delete("freezeKind");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
  }, []);
  useEffect(() => {
    if (!saved || !canvasRef.current) return;
    let active = true;
    setPreviewReady(false);
    draw(
      canvasRef.current,
      saved,
      location.origin + "/preparations/" + saved.id,
    )
      .then(() => {
        if (active) setPreviewReady(true);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Impossible de générer l’image.",
          );
      });
    return () => {
      active = false;
    };
  }, [saved]);
  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(null);
    setPreviewReady(false);
    setError("");
  }
  function resetSourcePhoto() {
    setSourcePhoto(null);
    setPhotoResetKey((value) => value + 1);
  }
  function choose(code: string) {
    if (code === CUSTOM_PREPARATION_CODE) {
      const p = customPreparationPreset({
        code,
        name: "Nouvelle préparation",
        category: CUSTOM_PREPARATION_CATEGORY,
        durationHours: 48,
        processType: "cold_preparation",
        storageTemperature: 3,
      });
      setForm((current) => ({
        ...newForm(p, current.operatorInitials),
        productCode: CUSTOM_PREPARATION_CODE,
        productName: "",
        customCategory: CUSTOM_PREPARATION_CATEGORY,
      }));
    } else {
      const p = availablePresets.find((item) => item.code === code);
      if (!p) return;
      setForm((current) => newForm(p, current.operatorInitials));
    }
    setEditing(null);
    setPrevious(null);
    setFreezeDraft(null);
    setSaved(null);
    setPreviewReady(false);
    setError("");
    resetSourcePhoto();
  }
  function useSearchAsCustomPreparation() {
    const name = productSearch.trim().slice(0, 80);
    if (!name) return;
    setForm((current) => {
      const currentPreset =
        presetFor(current.productCode) ??
        customPreparationPreset({
          code: current.productCode,
          name: current.productName,
          category: current.customCategory,
          durationHours: Number(current.durationHours),
          processType: current.customProcessType,
          storageTemperature: Number(current.customStorageTemperature),
        });
      return {
        ...current,
        productCode: CUSTOM_PREPARATION_CODE,
        productName: name,
        customCategory: current.customCategory || currentPreset.category,
        customProcessType: currentPreset.processType,
        customStorageTemperature: String(currentPreset.storageTemperature),
      };
    });
    setProductSearch("");
    setSaved(null);
    setPreviewReady(false);
    setError("");
  }
  function chooseCustomProcess(value: string) {
    const processType = value as ProcessType,
      nextPreset = customPreparationPreset({
        code: form.productCode,
        name: form.productName,
        category: form.customCategory,
        durationHours: Number(form.durationHours),
        processType,
      }),
      next = newForm(nextPreset, form.operatorInitials);
    setForm({
      ...next,
      productCode: form.productCode,
      productName: form.productName,
      customCategory: form.customCategory,
      customProcessType: processType,
      customStorageTemperature: String(nextPreset.storageTemperature),
      durationHours: form.durationHours || String(nextPreset.durationHours),
      preparedAt: form.preparedAt,
      lotCode: form.lotCode,
      quantity: form.quantity,
      packaging: form.packaging,
      note: form.note,
      supplierName: form.supplierName,
      supplierLot: form.supplierLot,
      supplierDeadline: form.supplierDeadline,
      receivedAt: form.receivedAt,
      sourceLabelId: form.sourceLabelId,
      sourceLotIds: form.sourceLotIds,
    });
    setSaved(null);
    setPreviewReady(false);
    setError("");
  }
  function toggleSourceLot(lot: SupplierLot) {
    setForm((current) => {
      const selected = current.sourceLotIds.includes(lot.id);
      return {
        ...current,
        sourceLotIds: selected
          ? current.sourceLotIds.filter((id) => id !== lot.id)
          : [...current.sourceLotIds, lot.id],
        supplierName:
          !selected && !current.supplierName
            ? lot.supplierName
            : current.supplierName,
        supplierLot:
          !selected && !current.supplierLot
            ? lot.supplierLot
            : current.supplierLot,
        supplierDeadline:
          !selected && !current.supplierDeadline
            ? (lot.supplierDeadline ?? "")
            : current.supplierDeadline,
        receivedAt:
          !selected && !current.receivedAt
            ? lot.receivedAt
            : current.receivedAt,
      };
    });
    setSaved(null);
    setPreviewReady(false);
  }
  function beginEdit(l: PreparationLabel) {
    setEditing(l);
    setPrevious(null);
    setFreezeDraft(null);
    setForm(editForm(l));
    setSaved(l);
    resetSourcePhoto();
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }
  function cancel() {
    setEditing(null);
    setPrevious(null);
    setFreezeDraft(null);
    setForm((f) => newForm(initial, f.operatorInitials));
    setSaved(null);
    setError("");
    resetSourcePhoto();
  }
  function beginFreezing(source: PreviousPreparation) {
    const problem = freezeSourceProblem(source, nowParis());
    if (problem) {
      toast.error(problem);
      return;
    }
    const frozenPreset = customPreparationPreset({
        code: CUSTOM_PREPARATION_CODE,
        name: source.name,
        category: "Congélation maison",
        processType: "frozen_in_house",
        durationHours: 1,
        storageTemperature: -18,
      }),
      next = newForm(frozenPreset, form.operatorInitials);
    setSection("labels");
    setEditing(null);
    setSaved(null);
    setPrevious(source);
    setFreezeDraft({ scope: "all", reason: "", confirmed: false });
    setProductSearch("");
    resetSourcePhoto();
    setForm({
      ...next,
      productCode: CUSTOM_PREPARATION_CODE,
      productName: source.name,
      customCategory: "Congélation maison",
      customProcessType: "frozen_in_house",
      customStorageTemperature: "-18",
      durationHours: "",
      quantity: source.quantity,
      sourceLabelId: source.kind === "classic" ? source.id : "",
      sourceLotIds: source.sourceLotIds,
      supplierName: source.supplierName,
      supplierLot: source.supplierLot,
      supplierDeadline: source.supplierDeadline,
      receivedAt: source.receivedAt,
    });
    setError("");
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }
  async function openFreezing(kind: PreparationKind, id: string) {
    try {
      const result = await api<{ item: PreviousPreparation }>(
        `/api/preparation-history?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
      );
      beginFreezing(result.item);
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "La préparation d’origine est indisponible.",
      );
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api<{
        label: PreparationLabel;
        warnings?: string[];
      }>(
        editing ? "/api/labels/" + editing.id : "/api/labels",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            revision: editing?.revision,
            previousPreparationId:
              previous?.id || form.sourceLabelId || undefined,
            previousPreparationKind: previous?.kind ?? "classic",
            transformSource: Boolean(freezeDraft),
            transformationScope: freezeDraft?.scope,
            transformationReason: freezeDraft?.reason,
            freezingConfirmed: freezeDraft?.confirmed,
          }),
        },
      );
      setLabels((all) =>
        editing
          ? all.map((l) => (l.id === result.label.id ? result.label : l))
          : [result.label, ...all],
      );
      setSaved(result.label);
      if (editing || freezeDraft) setEditing(result.label);
      if (freezeDraft) {
        setFreezeDraft(null);
        setPrevious(null);
      }
      let photoArchived = false;
      if (sourcePhoto) {
        const photoForm = new FormData();
        photoForm.append(
          "photo",
          new File([sourcePhoto.blob], sourcePhoto.name, {
            type: sourcePhoto.mimeType,
          }),
        );
        photoForm.append(
          "caption",
          [
            "Produit d’origine",
            form.supplierLot.trim() ? `lot ${form.supplierLot.trim()}` : "",
            form.supplierDeadline
              ? `DLC / DDM ${form.supplierDeadline.split("-").reverse().join("/")}`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
        try {
          await api(`/api/labels/${result.label.id}/photos`, {
            method: "POST",
            body: photoForm,
          });
          photoArchived = true;
          resetSourcePhoto();
        } catch (photoError) {
          setEditing(result.label);
          const message =
            photoError instanceof Error
              ? photoError.message
              : "La photo n’a pas pu être archivée.";
          setError(
            `La fiche est bien enregistrée. ${message} La photo reste prête : appuyez de nouveau sur « Enregistrer les modifications » pour réessayer.`,
          );
          toast.warning("Fiche enregistrée · photo à réessayer.");
        }
      }
      window.dispatchEvent(new Event("haccp-labels-changed"));
      try {
        localStorage.setItem(
          "sancta-initials",
          form.operatorInitials.trim().toUpperCase(),
        );
      } catch {}
      if (!sourcePhoto || photoArchived)
        toast.success(
          editing
            ? sourcePhoto
              ? "Fiche modifiée et photo archivée."
              : "Fiche modifiée et étiquette régénérée."
            : sourcePhoto
              ? "Fiche et photo de traçabilité enregistrées."
              : "Fiche de traçabilité enregistrée.",
        );
      if (result.warnings?.length)
        toast.warning(result.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "L’enregistrement a échoué.");
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api("/api/labels/" + pendingDelete.id, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: pendingDelete.revision }),
      });
      setLabels((all) => all.filter((l) => l.id !== pendingDelete.id));
      if (saved?.id === pendingDelete.id) setSaved(null);
      if (editing?.id === pendingDelete.id) cancel();
      setPendingDelete(null);
      toast.success("Fiche supprimée du registre.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La suppression a échoué.");
    } finally {
      setDeleting(false);
    }
  }
  function download() {
    if (!saved || !canvasRef.current || !previewReady) return;
    const a = document.createElement("a");
    a.download =
      safe(saved.productName) +
      "_" +
      saved.preparedAt.slice(0, 10) +
      "_50x30.png";
    a.href = canvasRef.current.toDataURL("image/png");
    a.click();
  }
  async function connectPrinter() {
    setPrinterBusy(true);
    setPrinterMessage("Connexion Bluetooth…");
    try {
      const printer = printerRef.current ?? new T50MPrinter();
      printerRef.current = printer;
      await printer.connect();
      setPrinterConnected(true);
      setPrinterMessage("T50M Pro connectée");
      toast.success("T50M Pro connectée.");
    } catch (error) {
      setPrinterConnected(false);
      setPrinterMessage(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
      toast.error(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
    } finally {
      setPrinterBusy(false);
    }
  }
  async function printDirect() {
    if (!saved || !canvasRef.current || !previewReady || !printerRef.current)
      return;
    const requestedCopies = Math.max(1, Math.min(50, Math.trunc(printCopies))),
      printer = printerRef.current;
    let completedCopies = 0;
    setPrinterBusy(true);
    setPrintProgress(0);
    setPrinterMessage(`Impression 0/${requestedCopies}…`);
    try {
      await printer.print(
        canvasRef.current,
        requestedCopies,
        4,
        (completed, total) => {
          completedCopies = completed;
          setPrintProgress(completed);
          setPrinterMessage(`Impression ${completed}/${total}…`);
        },
      );
      setPrinterMessage(
        requestedCopies === 1
          ? "1 exemplaire imprimé et horodaté"
          : `${requestedCopies} exemplaires imprimés et horodatés`,
      );
      try {
        await api(`/api/labels/${saved.id}/prints`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ copies: requestedCopies }),
        });
        toast.success(
          requestedCopies === 1
            ? "Étiquette imprimée et ajoutée à l’historique."
            : `${requestedCopies} exemplaires imprimés et ajoutés à l’historique.`,
        );
      } catch {
        toast.warning(
          "Impression terminée, mais l’historique n’a pas pu être enregistré.",
        );
      }
    } catch (error) {
      const cause =
        error instanceof Error ? error.message : "Erreur de communication.";
      let recovered = false;
      try {
        await printer.recoverConnection("après l’échec d’impression");
        recovered = true;
      } catch {}
      setPrinterConnected(recovered);
      const recoveryMessage = recovered
        ? " La connexion a été rétablie automatiquement; vérifiez la sortie avant de relancer."
        : " Reconnectez l’imprimante, puis relancez uniquement les exemplaires manquants.";
      if (completedCopies > 0) {
        const remaining = requestedCopies - completedCopies;
        setPrintProgress(completedCopies);
        try {
          await api(`/api/labels/${saved.id}/prints`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ copies: completedCopies }),
          });
        } catch {}
        if (remaining > 0) setPrintCopies(remaining);
        const partialMessage = `${completedCopies}/${requestedCopies} exemplaires confirmés. Vérifiez la sortie; ${remaining} reste${remaining > 1 ? "nt" : ""} à imprimer. Détail : ${cause}.${recoveryMessage}`;
        setPrinterMessage(partialMessage);
        toast.warning(partialMessage);
      } else {
        const message = `${cause}${recoveryMessage}`;
        setPrinterMessage(message);
        toast.error(message);
      }
    } finally {
      setPrinterBusy(false);
    }
  }
  const supplierRequired = ["opened", "supplier_frozen", "thawed"].includes(
    preset.processType,
  ),
    missingSupplierTrace =
      supplierRequired &&
      !form.sourceLotIds.length &&
      !form.supplierLot.trim();
  if (section === "quick")
    return (
      <div className="labels-view">
        <QuickLabelsPanel
          session={session}
          onBack={() => setSection("labels")}
          onFreeze={(kind, id) => void openFreezing(kind, id)}
          onWaste={() => setSection("waste")}
          onEditClassic={(id) => {
            const label = labels.find((item) => item.id === id);
            if (!label) return;
            setSection("labels");
            beginEdit(label);
          }}
          onPreviewClassic={(id) => {
            const label = labels.find((item) => item.id === id);
            if (!label) return;
            setSection("labels");
            setSaved(label);
          }}
          onDeleteClassic={(id) => {
            const label = labels.find((item) => item.id === id);
            if (!label) return;
            setSection("labels");
            setPendingDelete(label);
          }}
        />
      </div>
    );
  if (section === "waste")
    return (
      <div className="labels-view">
        <WastePanel onBack={() => setSection("labels")} />
      </div>
    );
  if (section === "suppliers")
    return (
      <div className="labels-view">
        <div className="label-row-actions">
          <Button
            variant="outline"
            className="button"
            onClick={() => setSection("labels")}
          >
            <Tag size={16} /> Préparations & étiquettes
          </Button>
          <Button className="button primary">
            <Building2 size={16} /> Fournisseurs & lots
          </Button>
          {canAdministerRegister(session.role) && (
            <Button
              variant="outline"
              className="button"
              onClick={() => setSection("quick")}
            >
              <Printer size={16} /> Impression rapide
            </Button>
          )}
        </div>
        <SupplierLotsPanel
          session={session}
          lots={supplierLots}
          onLotsChange={setSupplierLots}
        />
      </div>
    );
  return (
    <div className="labels-view">
      <div className="labels-heading">
        <div>
          <p className="eyebrow">Traçabilité des préparations</p>
          <h2>Créer une fiche et son étiquette</h2>
          <p>
            Choisissez l’étape réelle, complétez les contrôles, puis imprimez
            directement en 50 × 30 mm ou gardez le PNG de secours.
          </p>
        </div>
        <span className="label-format">
          <Tag size={16} />
          50 × 30 mm · QR
        </span>
      </div>
      <div className="label-row-actions">
        <Button className="button primary">
          <Tag size={16} /> Préparations & étiquettes
        </Button>
        <Button
          variant="outline"
          className="button"
          onClick={() => setSection("suppliers")}
        >
          <Building2 size={16} /> Fournisseurs & lots
        </Button>
        {canAdministerRegister(session.role) && (
          <Button
            variant="outline"
            className="button"
            onClick={() => setSection("quick")}
          >
            <Printer size={16} /> Impression rapide
          </Button>
        )}
        <Button
          variant="outline"
          className="button"
          onClick={() => setSection("waste")}
        >
          <Trash2 size={16} /> Registre des produits jetés
        </Button>
      </div>
      <div className="label-workspace">
        <form
          ref={formRef}
          className="panel panel-pad label-form trace-form"
          onSubmit={submit}
        >
          {editing && (
            <div className="edit-banner">
              <div>
                <Pencil size={17} />
                <span>
                  <strong>Modification en cours</strong>
                  <small>
                    {editing.productName} ·{" "}
                    {editing.id.slice(0, 8).toUpperCase()}
                  </small>
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="button"
                onClick={cancel}
              >
                <X size={15} />
                Annuler
              </Button>
            </div>
          )}
          <section className="trace-section">
            {title(
              <ChefHat size={18} />,
              "1. Produit et opération",
              "Sélectionnez ce qui est réellement fait aujourd’hui.",
            )}
            <label className="field">
              Rechercher dans le catalogue{" "}
              <span className="optional">filtre uniquement</span>
              <Input
                className="input"
                type="search"
                placeholder="Ex. tomate, mozzarella, seiche…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </label>
            {!!productSearch.trim() && filtered.length === 0 && (
              <Button
                type="button"
                variant="outline"
                className="button wide create-from-search"
                onClick={useSearchAsCustomPreparation}
              >
                <Plus size={16} />
                Créer « {productSearch.trim().slice(0, 80)} »
              </Button>
            )}
            <label className="field">
              Produit / préparation
              <Select value={form.productCode} onValueChange={choose}>
                <SelectTrigger className="label-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="catalog-select">
                  <SelectGroup>
                    <SelectLabel>Choix libre</SelectLabel>
                    <SelectItem value={CUSTOM_PREPARATION_CODE}>
                      <Plus size={15} /> Écrire une nouvelle préparation
                    </SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  {categories.map((cat, i) => {
                    const items = filtered.filter((p) => p.category === cat);
                    return items.length ? (
                      <SelectGroup key={cat}>
                        {i > 0 && <SelectSeparator />}
                        <SelectLabel>{cat}</SelectLabel>
                        {items.map((p) => (
                          <SelectItem key={p.code} value={p.code}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </label>
            <label className="field">
              Nom imprimé sur l’étiquette
              <Input
                className="input"
                maxLength={80}
                required
                autoFocus={form.productCode === CUSTOM_PREPARATION_CODE}
                value={form.productName}
                onChange={(event) => change("productName", event.target.value)}
                placeholder="Ex. Saucisse Macaronade"
              />
              <span className="field-help">
                Ce texte exact apparaîtra en grand sur l’étiquette et dans le
                rapport HACCP.
              </span>
            </label>
            {isCustomPreparation && (
              <div className="custom-preparation-card">
                <div className="custom-preparation-heading">
                  <Plus size={18} />
                  <div>
                    <strong>Préparation libre</strong>
                    <span>
                      Après le premier enregistrement, elle restera proposée
                      ici et sera automatiquement disponible dans « Impression
                      rapide ». Sa DLC et ses réglages pourront ensuite être
                      modifiés dans la configuration du catalogue.
                    </span>
                  </div>
                </div>
                <div className="label-form-grid">
                  <label className="field">
                    Famille / catégorie
                    <Input
                      className="input"
                      maxLength={80}
                      required
                      value={form.customCategory}
                      onChange={(event) =>
                        change("customCategory", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    Opération réalisée
                    <Select
                      value={form.customProcessType}
                      onValueChange={chooseCustomProcess}
                    >
                      <SelectTrigger className="label-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROCESS_LABELS).map(([code, label]) => (
                          <SelectItem key={code} value={code}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="field">
                    Température de conservation (°C)
                    <Input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="-50"
                      max="15"
                      required
                      value={form.customStorageTemperature}
                      onChange={(event) =>
                        change("customStorageTemperature", event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>
            )}
            <div className="rule-card">
              {preset.storageMode === "frozen" ? (
                <Snowflake size={18} />
              ) : (
                <Thermometer size={18} />
              )}
              <div>
                <strong>
                  {PROCESS_LABELS[preset.processType]} ·{" "}
                  {SOURCE_STATE_LABELS[preset.sourceState]}
                </strong>
                <span>{preset.rule}</span>
              </div>
            </div>
            <div className="label-form-grid">
              <label className="field">
                {freezeDraft
                  ? "Date / heure de l’opération de congélation"
                  : "Date / heure de préparation"}
                <Input
                  className="input"
                  type="datetime-local"
                  value={form.preparedAt}
                  onChange={(e) => change("preparedAt", e.target.value)}
                />
              </label>
              <label className="field">
                Initiales opérateur
                <Input
                  className="input"
                  maxLength={12}
                  value={form.operatorInitials}
                  onChange={(e) => change("operatorInitials", e.target.value)}
                  placeholder="AG"
                />
              </label>
              <label className="field">
                Lot interne{" "}
                <span className="optional">automatique si vide</span>
                <Input
                  className="input"
                  maxLength={50}
                  value={form.lotCode}
                  onChange={(e) => change("lotCode", e.target.value)}
                />
              </label>
              <label className="field">
                Quantité <span className="optional">facultatif</span>
                <Input
                  className="input"
                  maxLength={40}
                  value={form.quantity}
                  onChange={(e) => change("quantity", e.target.value)}
                  placeholder="6 portions"
                />
              </label>
              <label className="field">
                Conditionnement
                <Input
                  className="input"
                  maxLength={60}
                  value={form.packaging}
                  onChange={(e) => change("packaging", e.target.value)}
                />
              </label>
            </div>
            {!editing && (
              <PreviousPreparations
                selected={previous}
                disabled={saving}
                onFreeze={beginFreezing}
                onSelect={(source) => {
                  setPrevious(source);
                  setFreezeDraft(null);
                  setForm((current) => ({
                    ...current,
                    sourceLabelId:
                      source?.kind === "classic" ? source.id : "",
                  }));
                  setSaved(null);
                }}
              />
            )}
            {editing?.sourceLabelId && (
              <p className="ocr-help">
                <Link2 size={15} /> Fiche source conservée :{" "}
                <a href={`/preparations/${editing.sourceLabelId}`} target="_blank" rel="noreferrer">
                  {editing.sourceLabelId.slice(0, 8).toUpperCase()}
                </a>
              </p>
            )}
            {freezeDraft && previous && (
              <div className="freeze-confirmation">
                <h3><Snowflake size={18} /> Nouvelle congélation liée</h3>
                <p>
                  Source : <strong>{previous.name}</strong> · {previous.reference} ·
                  DLC initiale {shortDateTime(previous.expiresAt)}.
                </p>
                <div className="notice warning">
                  La proximité de la DLC ne suffit pas à autoriser la congélation.
                  Vérifiez la fraîcheur, la chaîne du froid, le matériel et votre
                  procédure PMS. La durée congelée doit être renseignée ci-dessous.
                </div>
                <label className="field">
                  Portée de la transformation
                  <select
                    className="input"
                    value={freezeDraft.scope}
                    onChange={(event) =>
                      setFreezeDraft((current) =>
                        current
                          ? { ...current, scope: event.target.value as "all" | "partial" }
                          : current,
                      )
                    }
                  >
                    <option value="all">Tout le lot restant est congelé</option>
                    <option value="partial">Une partie seulement est congelée</option>
                  </select>
                </label>
                <label className="field">
                  Justification / procédure appliquée
                  <Textarea
                    className="input"
                    required
                    maxLength={500}
                    value={freezeDraft.reason}
                    onChange={(event) =>
                      setFreezeDraft((current) =>
                        current ? { ...current, reason: event.target.value } : current,
                      )
                    }
                    placeholder="Ex. Produit conforme, jamais décongelé, congélateur adapté, procédure PMS vérifiée…"
                  />
                </label>
                <label className="ocr-confirm">
                  <input
                    type="checkbox"
                    required
                    checked={freezeDraft.confirmed}
                    onChange={(event) =>
                      setFreezeDraft((current) =>
                        current ? { ...current, confirmed: event.target.checked } : current,
                      )
                    }
                  />
                  Je confirme la quantité réellement congelée, l’aptitude du
                  produit et l’application de la procédure PMS.
                </label>
              </div>
            )}
          </section>
          <section className="trace-section">
            {title(
              <Truck size={18} />,
              "2. Origine fournisseur",
              "Recopiez les informations avant de jeter l’emballage.",
            )}
            <PhotoOcr
              key={photoResetKey}
              archivePhoto
              onPhotoChange={setSourcePhoto}
              fields={[
                "productName",
                "supplierName",
                "supplierLot",
                "deadlineType",
                "deadlineDate",
                "quantity",
              ]}
              onApply={(values) => {
                setForm((current) => ({
                  ...current,
                  productName: values.productName || current.productName,
                  supplierName: values.supplierName || current.supplierName,
                  supplierLot: values.supplierLot || current.supplierLot,
                  supplierDeadline:
                    values.deadlineDate || current.supplierDeadline,
                  quantity: values.quantity || current.quantity,
                }));
                setSaved(null);
              }}
            />
            <BarcodeScanner
              role={session.role}
              onApply={(values) => {
                setForm((current) => {
                  let next = current;
                  if (values.ingredient) {
                    const ingredient = values.ingredient,
                      known = PREPARATION_PRESETS.find(
                        (item) => item.code === ingredient.legacyCode,
                      );
                    if (known) next = newForm(known, current.operatorInitials);
                    else {
                      const processType: ProcessType =
                          ingredient.defaultOperation === "opened"
                            ? "opened"
                            : ingredient.defaultOperation === "thawed"
                              ? "thawed"
                              : "cold_preparation",
                        custom = customPreparationPreset({
                          code: ingredient.legacyCode,
                          name: ingredient.displayName,
                          category: ingredient.category,
                          durationHours: ingredient.durationHours,
                          processType,
                          storageTemperature:
                            ingredient.storageTemperature ??
                            (ingredient.storageMode === "frozen" ? -18 : 3),
                        });
                      next = {
                        ...newForm(custom, current.operatorInitials),
                        productCode: ingredient.legacyCode,
                        productName: ingredient.displayName,
                        customCategory: ingredient.category,
                        customProcessType: processType,
                        customStorageTemperature: String(
                          ingredient.storageTemperature ??
                            (ingredient.storageMode === "frozen" ? -18 : 3),
                        ),
                        durationHours: String(ingredient.durationHours),
                      };
                    }
                  } else if (values.product?.productName) {
                    next = {
                      ...current,
                      productCode: "__custom__",
                      productName: values.product.productName,
                      customCategory:
                        values.product.categories || current.customCategory,
                    };
                  }
                  return {
                    ...next,
                    supplierName:
                      values.supplier?.name || current.supplierName,
                    supplierLot: values.lot || current.supplierLot,
                    supplierDeadline:
                      values.deadlineDate || current.supplierDeadline,
                    quantity: values.quantity || current.quantity,
                  };
                });
                setSaved(null);
                setPreviewReady(false);
                setEditing(null);
                setError("");
              }}
            />
            {!!supplierLots.length && (
              <div className="field">
                Lots reçus utilisés{" "}
                <span className="optional">sélection multiple</span>
                <div className="source-lot-picker">
                  {supplierLots.slice(0, 120).map((lot) => (
                    <label className="source-lot-option" key={lot.id}>
                      <input
                        type="checkbox"
                        checked={form.sourceLotIds.includes(lot.id)}
                        onChange={() => toggleSourceLot(lot)}
                      />
                      <span>
                        <strong>{lot.ingredientName}</strong>
                        <small>
                          {lot.supplierName} · lot {lot.supplierLot} · reçu{" "}
                          {lot.receivedAt.replace("T", " ")}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {!supplierLots.length && (
              <div className="notice warning">
                <Truck size={16} />
                <span>
                  Aucun lot reçu n’est encore enregistré. Utilisez «
                  Fournisseurs & lots » pour créer la traçabilité amont.
                </span>
              </div>
            )}
            <div className="label-form-grid">
              <label className="field">
                Fournisseur <span className="optional">recommandé</span>
                <Input
                  className="input"
                  maxLength={80}
                  value={form.supplierName}
                  onChange={(e) => change("supplierName", e.target.value)}
                />
              </label>
              <label className="field">
                Lot fournisseur{" "}
                <span className="optional">
                  {supplierRequired ? "recommandé" : "facultatif"}
                </span>
                <Input
                  className="input"
                  maxLength={80}
                  value={form.supplierLot}
                  onChange={(e) => change("supplierLot", e.target.value)}
                />
              </label>
              <label className="field">
                DLC / DDM fournisseur{" "}
                {!preset.supplierExpiry && (
                  <span className="optional">facultatif</span>
                )}
                <Input
                  className="input"
                  type="date"
                  value={form.supplierDeadline}
                  onChange={(e) => change("supplierDeadline", e.target.value)}
                />
              </label>
              <label className="field">
                Réception <span className="optional">facultatif</span>
                <Input
                  className="input"
                  type="datetime-local"
                  value={form.receivedAt}
                  onChange={(e) => change("receivedAt", e.target.value)}
                />
              </label>
            </div>
            {missingSupplierTrace && (
              <div className="notice warning" role="status">
                <Info size={16} />
                <span>
                  Aucun lot fournisseur n’est renseigné. Vous pouvez créer
                  l’étiquette ; la fiche sera marquée « lot à compléter » dans
                  l’historique d’audit HACCP.
                </span>
              </div>
            )}
          </section>
          {(preset.processType === "opened" ||
            preset.processType === "supplier_frozen") && (
            <section className="trace-section">
              {title(
                <PackageOpen size={18} />,
                "3. Ouverture / découpe / transvasement",
                "Le lot et la date d’origine restent liés au nouveau bac.",
              )}
              <label className="field">
                Ouvert, découpé ou transvasé le
                <Input
                  className="input"
                  type="datetime-local"
                  value={form.openedAt}
                  onChange={(e) => change("openedAt", e.target.value)}
                />
              </label>
            </section>
          )}
          {preset.processType === "thawed" && (
            <section className="trace-section">
              {title(
                <Snowflake size={18} />,
                "3. Décongélation",
                "Au froid positif ; ne jamais recongeler en l’état.",
              )}
              <div className="label-form-grid">
                <label className="field">
                  Début de décongélation
                  <Input
                    className="input"
                    type="datetime-local"
                    value={form.thawingStartedAt}
                    onChange={(e) => change("thawingStartedAt", e.target.value)}
                  />
                </label>
                <label className="field">
                  Méthode
                  <Select
                    value={form.thawingMethod}
                    onValueChange={(v) => change("thawingMethod", v)}
                  >
                    <SelectTrigger className="label-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chambre_froide">
                        Chambre froide 0/+4 °C
                      </SelectItem>
                      <SelectItem value="micro_ondes_immediat">
                        Micro-ondes · usage immédiat
                      </SelectItem>
                      <SelectItem value="autre_controlee">
                        Autre méthode contrôlée
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="notice warning">
                <Info size={17} />
                <span>
                  Pour une cuisson directe depuis surgelé, conservez le lot
                  fournisseur et créez ensuite la fiche de la préparation cuite.
                </span>
              </div>
            </section>
          )}
          {preset.processType === "cooked_cooled" && (
            <section className="trace-section">
              {title(
                <Timer size={18} />,
                "3. Cuisson et refroidissement",
                "Objectif : passer de +63 °C à +10 °C à cœur en 2 h maximum.",
              )}
              <div className="label-form-grid">
                <label className="field">
                  Fin de cuisson
                  <Input
                    className="input"
                    type="datetime-local"
                    value={form.cookingEndedAt}
                    onChange={(e) => change("cookingEndedAt", e.target.value)}
                  />
                </label>
                <label className="field">
                  T° à cœur fin de cuisson
                  <Input
                    className="input"
                    type="number"
                    step="0.1"
                    value={form.cookingTemperature}
                    onChange={(e) =>
                      change("cookingTemperature", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  Début refroidissement
                  <Input
                    className="input"
                    type="datetime-local"
                    value={form.coolingStartedAt}
                    onChange={(e) => change("coolingStartedAt", e.target.value)}
                  />
                </label>
                <label className="field">
                  T° initiale refroidissement
                  <Input
                    className="input"
                    type="number"
                    step="0.1"
                    value={form.coolingStartTemperature}
                    onChange={(e) =>
                      change("coolingStartTemperature", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  Fin refroidissement
                  <Input
                    className="input"
                    type="datetime-local"
                    value={form.coolingEndedAt}
                    onChange={(e) => change("coolingEndedAt", e.target.value)}
                  />
                </label>
                <label className="field">
                  T° finale à cœur
                  <Input
                    className="input"
                    type="number"
                    step="0.1"
                    value={form.coolingEndTemperature}
                    onChange={(e) =>
                      change("coolingEndTemperature", e.target.value)
                    }
                    placeholder="10"
                  />
                </label>
                <label className="field">
                  Méthode
                  <Select
                    value={form.coolingMethod}
                    onValueChange={(v) => change("coolingMethod", v)}
                  >
                    <SelectTrigger className="label-select">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bain_glace">
                        Bain d’eau glacée
                      </SelectItem>
                      <SelectItem value="petits_volumes">
                        Petits volumes / bacs peu profonds
                      </SelectItem>
                      <SelectItem value="autre">
                        Autre méthode maîtrisée
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <div
                  className={
                    "control-card " + (coolOK ? "control-ok" : "control-alert")
                  }
                >
                  {coolOK ? (
                    <ShieldCheck size={20} />
                  ) : (
                    <ShieldAlert size={20} />
                  )}
                  <div>
                    <strong>
                      {coolOK
                        ? "Objectif atteint"
                        : "À vérifier / hors objectif"}
                    </strong>
                    <span>
                      {coolMinutes === null
                        ? "Complétez les contrôles."
                        : coolMinutes +
                          " min · " +
                          temperatureText(
                            form.coolingEndTemperature === ""
                              ? null
                              : Number(form.coolingEndTemperature),
                          )}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}
          {preset.processType === "frozen_in_house" && (
            <section className="trace-section">
              {title(
                <Snowflake size={18} />,
                "3. Congélation maison",
                "Préparation et congélation tracées le même jour.",
              )}
              <div className="label-form-grid">
                <label className="field">
                  Congelé le
                  <Input
                    className="input"
                    type="datetime-local"
                    value={form.frozenAt}
                    onChange={(e) => change("frozenAt", e.target.value)}
                  />
                </label>
                <label className="field">
                  T° du congélateur
                  <Input
                    className="input"
                    type="number"
                    step="0.1"
                    value={form.freezerTemperature}
                    onChange={(e) =>
                      change("freezerTemperature", e.target.value)
                    }
                  />
                </label>
                <label className="field field-span">
                  Équipement / méthode
                  <Input
                    className="input"
                    maxLength={60}
                    value={form.freezeMethod}
                    onChange={(e) => change("freezeMethod", e.target.value)}
                  />
                </label>
              </div>
              <div
                className={
                  "control-card " + (freezeOK ? "control-ok" : "control-alert")
                }
              >
                {freezeOK ? (
                  <ShieldCheck size={20} />
                ) : (
                  <ShieldAlert size={20} />
                )}
                <div>
                  <strong>
                    {freezeOK
                      ? "Température cible renseignée"
                      : "Température supérieure à −18 °C"}
                  </strong>
                  <span>DDM interne proposée : 90 jours.</span>
                </div>
              </div>
            </section>
          )}
          <section className="trace-section">
            {title(
              <Tag size={18} />,
              "4. Conservation et date limite",
              "La proposition reste un réglage PMS à valider par le responsable.",
            )}
            <div className="rule-card">
              {preset.storageMode === "frozen" ? (
                <Snowflake size={18} />
              ) : (
                <Thermometer size={18} />
              )}
              <div>
                <strong>
                  {preset.storageMode === "frozen" ? "Congelé" : "Réfrigéré"} ·{" "}
                  {temperatureText(preset.storageTemperature)}
                </strong>
                <span>
                  {preset.supplierExpiry
                    ? "Date limite recopiée de la DDM fournisseur."
                    : durationText(Number(form.durationHours) || 0) +
                      " à partir de " +
                      preset.startLabel}
                </span>
              </div>
            </div>
            {!preset.supplierExpiry && (
              <label className="field">
                Durée appliquée (heures)
                <Input
                  className="input"
                  type="number"
                  min="1"
                  max="8760"
                  required
                  value={form.durationHours}
                  onChange={(e) => change("durationHours", e.target.value)}
                />
                <span className="field-help">
                  24 = 1 jour · 48 = 2 jours · 72 = 3 jours. Pour un produit
                  ouvert, suivez d’abord le fabricant.
                </span>
              </label>
            )}
            <div className="expiry-summary">
              <span>
                {preset.storageMode === "frozen"
                  ? "DDM / limite"
                  : "DLC interne calculée"}
              </span>
              <strong>{shortDateTime(expires)}</strong>
              <small>Départ : {shortDateTime(starts)}</small>
            </div>
          </section>
          {(nonconform || form.correctiveAction) && (
            <section className="trace-section trace-alert-section">
              {title(
                <ShieldAlert size={18} />,
                "5. Action corrective",
                "Obligatoire lorsque le contrôle est hors objectif.",
              )}
              <label className="field">
                Action réellement réalisée
                <Textarea
                  className="input"
                  maxLength={1200}
                  value={form.correctiveAction}
                  onChange={(e) => change("correctiveAction", e.target.value)}
                  placeholder="Produit écarté, refroidissement poursuivi, responsable informé…"
                />
              </label>
            </section>
          )}
          <label className="field">
            Observation <span className="optional">facultatif</span>
            <Textarea
              className="input"
              maxLength={1500}
              value={form.note}
              onChange={(e) => change("note", e.target.value)}
              placeholder="Ingrédients, anomalies, information de service…"
            />
          </label>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="button primary wide"
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle className="spinner" size={18} />
            ) : (
              <Save size={18} />
            )}{" "}
            {saving
              ? "Enregistrement…"
              : editing
                ? "Enregistrer les modifications"
                : "Enregistrer et générer"}
          </Button>
          <p className="form-footnote">
            <Info size={14} />
            Ces durées sont des réglages PMS internes proposés. Validez-les avec
            vos procédés réels et les instructions fournisseur.
          </p>
        </form>
        <aside className="label-preview-column">
          <div className="panel label-preview-panel">
            <div className="preview-title">
              <div>
                <QrCode size={18} />
                <strong>Image prête à imprimer</strong>
              </div>
              {previewReady && (
                <span className="status-pill ok">
                  <Check size={12} />
                  Générée
                </span>
              )}
            </div>
            <div className="thermal-preview">
              {saved ? (
                <canvas
                  ref={canvasRef}
                  width="384"
                  height="240"
                  aria-label={"Étiquette de " + saved.productName}
                />
              ) : (
                <div className="empty-label">
                  <QrCode size={42} />
                  <strong>Aperçu après enregistrement</strong>
                  <span>Le QR ouvrira toute la fiche de traçabilité.</span>
                </div>
              )}
            </div>
            <Button
              className="button primary wide"
              onClick={download}
              disabled={!previewReady}
            >
              <Download size={17} />
              Télécharger le PNG
            </Button>
            <div className="direct-print-box">
              <strong>
                <Bluetooth size={16} /> Impression directe T50M Pro{" "}
                <span className="optional">bêta</span>
              </strong>
              {directSupported ? (
                <>
                  <Button
                    variant="outline"
                    className="button wide"
                    onClick={() => void connectPrinter()}
                    disabled={printerBusy || printerConnected}
                  >
                    <Bluetooth size={16} />
                    {printerConnected
                      ? "Imprimante connectée"
                      : "Connecter la T50M Pro"}
                  </Button>
                  <label className="print-copy-control">
                    <span>Copies identiques</span>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Retirer une copie"
                        onClick={() =>
                          setPrintCopies((value) => Math.max(1, value - 1))
                        }
                        disabled={printerBusy || printCopies <= 1}
                      >
                        −
                      </Button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={50}
                        step={1}
                        value={printCopies}
                        aria-label="Nombre de copies identiques"
                        onChange={(event) =>
                          setPrintCopies(
                            Math.max(
                              1,
                              Math.min(
                                50,
                                Math.trunc(Number(event.target.value) || 1),
                              ),
                            ),
                          )
                        }
                        disabled={printerBusy}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Ajouter une copie"
                        onClick={() =>
                          setPrintCopies((value) => Math.min(50, value + 1))
                        }
                        disabled={printerBusy || printCopies >= 50}
                      >
                        +
                      </Button>
                    </div>
                    <small>
                      Même QR et même ID. Pour identifier plusieurs bacs
                      séparément, utilisez « Impression rapide ». La connexion
                      reste ouverte pendant toute la série.
                    </small>
                  </label>
                  <Button
                    className="button primary wide"
                    onClick={() => void printDirect()}
                    disabled={!printerConnected || !previewReady || printerBusy}
                  >
                    <Printer size={17} />
                    {printerBusy && printerConnected
                      ? `Impression ${printProgress}/${printCopies}`
                      : printCopies === 1
                        ? "Imprimer 1 exemplaire"
                        : `Imprimer ${printCopies} exemplaires`}
                  </Button>
                  {printerMessage && <small>{printerMessage}</small>}
                </>
              ) : (
                <small>
                  Ouvrez le site dans Google Chrome 138 ou plus récent sur
                  Android. L’impression directe n’est pas disponible dans le
                  navigateur intégré de ChatGPT.
                </small>
              )}
            </div>
            <ol className="print-steps">
              <li>Ouvrez ce site directement dans Google Chrome sur Android.</li>
              <li>Connectez la T50M Pro depuis la fenêtre de Chrome.</li>
              <li>Gardez cette page ouverte pendant toute l’impression.</li>
              <li>Le PNG reste disponible comme solution de secours.</li>
            </ol>
            {saved && (
              <div className="saved-report-actions">
                <a
                  className="button wide trace-link"
                  href={"/preparations/" + saved.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Link2 size={16} />
                  Ouvrir la fiche QR
                </a>
                <a
                  className="button wide trace-link"
                  href={"/preparations/" + saved.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileDown size={16} />
                  Rapport HACCP A4 / PDF
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
      <UnifiedLabelRegister
        session={session}
        onEditClassic={(id) => {
          const label = labels.find((item) => item.id === id);
          if (label) beginEdit(label);
        }}
        onPreviewClassic={(id) => {
          const label = labels.find((item) => item.id === id);
          if (label) setSaved(label);
        }}
        onDeleteClassic={(id) => {
          const label = labels.find((item) => item.id === id);
          if (label) setPendingDelete(label);
        }}
        onFreeze={(kind, id) => void openFreezing(kind, id)}
      />
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
            <AlertDialogDescription>
              L’étiquette « {pendingDelete?.productName} » disparaîtra du
              registre et son QR code n’ouvrira plus la fiche. Une trace
              technique restera conservée pour l’audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? (
                <LoaderCircle className="spinner" size={16} />
              ) : (
                <Trash2 size={16} />
              )}{" "}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
