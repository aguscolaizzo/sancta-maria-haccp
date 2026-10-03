"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  LoaderCircle,
  PackagePlus,
  Pencil,
  Save,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAdministerRegister, type RegisterSession } from "@/lib/access-types";
import type { Supplier, SupplierLot } from "@/lib/supply";
import { toast } from "sonner";

type Props = {
  session: RegisterSession;
  lots: SupplierLot[];
  onLotsChange: (lots: SupplierLot[]) => void;
};
type SupplierForm = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
};
type LotForm = {
  supplierId: string;
  ingredientName: string;
  supplierLot: string;
  receivedAt: string;
  supplierDeadline: string;
  quantity: string;
  storageMode: SupplierLot["storageMode"];
  storageTemperature: string;
  documentRef: string;
  notes: string;
};

const emptySupplier: SupplierForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
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
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}
const emptyLot = (supplierId = ""): LotForm => ({
  supplierId,
  ingredientName: "",
  supplierLot: "",
  receivedAt: nowParis(),
  supplierDeadline: "",
  quantity: "",
  storageMode: "refrigerated",
  storageTemperature: "4",
  documentRef: "",
  notes: "",
});
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La demande a échoué.");
  return data;
}

export default function SupplierLotsPanel({
  session,
  lots,
  onLotsChange,
}: Props) {
  const canAdminister = canAdministerRegister(session.role);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [supplierForm, setSupplierForm] = useState(emptySupplier),
    [lotForm, setLotForm] = useState<LotForm>(() => emptyLot());
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null),
    [editingLot, setEditingLot] = useState<SupplierLot | null>(null);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    api<{ suppliers: Supplier[] }>("/api/suppliers")
      .then(({ suppliers }) => {
        if (!active) return;
        setSuppliers(suppliers);
        setLotForm((form) =>
          form.supplierId || !suppliers[0]
            ? form
            : { ...form, supplierId: suppliers[0].id },
        );
      })
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Chargement impossible.",
        ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  const visibleLots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? lots.filter((lot) =>
          `${lot.ingredientName} ${lot.supplierLot} ${lot.supplierName} ${lot.documentRef}`
            .toLowerCase()
            .includes(query),
        )
      : lots;
  }, [lots, search]);

  function startSupplier(supplier: Supplier) {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      notes: supplier.notes,
    });
  }
  function cancelSupplier() {
    setEditingSupplier(null);
    setSupplierForm(emptySupplier);
  }
  function startLot(lot: SupplierLot) {
    setEditingLot(lot);
    setLotForm({
      supplierId: lot.supplierId,
      ingredientName: lot.ingredientName,
      supplierLot: lot.supplierLot,
      receivedAt: lot.receivedAt,
      supplierDeadline: lot.supplierDeadline ?? "",
      quantity: lot.quantity,
      storageMode: lot.storageMode,
      storageTemperature:
        lot.storageTemperature === null ? "" : String(lot.storageTemperature),
      documentRef: lot.documentRef,
      notes: lot.notes,
    });
  }
  function cancelLot() {
    setEditingLot(null);
    setLotForm(emptyLot(suppliers[0]?.id ?? ""));
  }

  async function saveSupplier(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api<{ supplier: Supplier }>(
        editingSupplier
          ? `/api/suppliers/${editingSupplier.id}`
          : "/api/suppliers",
        {
          method: editingSupplier ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...supplierForm,
            revision: editingSupplier?.revision,
          }),
        },
      );
      setSuppliers((all) =>
        editingSupplier
          ? all.map((item) =>
              item.id === result.supplier.id ? result.supplier : item,
            )
          : [...all, result.supplier].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      if (!lotForm.supplierId)
        setLotForm((form) => ({ ...form, supplierId: result.supplier.id }));
      cancelSupplier();
      toast.success("Fournisseur enregistré.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveLot(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api<{ lot: SupplierLot }>(
        editingLot
          ? `/api/supplier-lots/${editingLot.id}`
          : "/api/supplier-lots",
        {
          method: editingLot ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...lotForm, revision: editingLot?.revision }),
        },
      );
      onLotsChange(
        editingLot
          ? lots.map((item) => (item.id === result.lot.id ? result.lot : item))
          : [result.lot, ...lots],
      );
      cancelLot();
      toast.success("Lot de matière première enregistré.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeSupplier(supplier: Supplier) {
    if (!confirm(`Supprimer le fournisseur « ${supplier.name} » ?`)) return;
    try {
      await api(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: supplier.revision }),
      });
      setSuppliers((all) => all.filter((item) => item.id !== supplier.id));
      toast.success("Fournisseur supprimé.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    }
  }
  async function removeLot(lot: SupplierLot) {
    if (!confirm(`Supprimer le lot « ${lot.supplierLot} » ?`)) return;
    try {
      await api(`/api/supplier-lots/${lot.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: lot.revision }),
      });
      onLotsChange(lots.filter((item) => item.id !== lot.id));
      toast.success("Lot supprimé.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    }
  }

  return (
    <div className="label-register">
      <div className="labels-heading">
        <div>
          <p className="eyebrow">Origine des matières premières</p>
          <h2>Fournisseurs et lots reçus</h2>
          <p>
            Enregistrez le lot à la réception, puis sélectionnez-le dans chaque
            fiche de préparation concernée.
          </p>
        </div>
        <span className="label-format">
          <Truck size={16} /> Traçabilité amont
        </span>
      </div>
      {canAdminister && (
        <form className="panel panel-pad trace-form" onSubmit={saveSupplier}>
          <div className="trace-section-title">
            <span>
              <Building2 size={18} />
            </span>
            <div>
              <h3>
                {editingSupplier
                  ? "Modifier le fournisseur"
                  : "Ajouter un fournisseur"}
              </h3>
              <p>Le responsable gère le répertoire permanent.</p>
            </div>
          </div>
          <div className="label-form-grid">
            <label className="field">
              Nom
              <Input
                className="input"
                required
                value={supplierForm.name}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              Contact
              <Input
                className="input"
                value={supplierForm.contactName}
                onChange={(e) =>
                  setSupplierForm({
                    ...supplierForm,
                    contactName: e.target.value,
                  })
                }
              />
            </label>
            <label className="field">
              Téléphone
              <Input
                className="input"
                value={supplierForm.phone}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, phone: e.target.value })
                }
              />
            </label>
            <label className="field">
              E-mail
              <Input
                className="input"
                type="email"
                value={supplierForm.email}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, email: e.target.value })
                }
              />
            </label>
          </div>
          <label className="field">
            Notes <span className="optional">facultatif</span>
            <Textarea
              className="input"
              value={supplierForm.notes}
              onChange={(e) =>
                setSupplierForm({ ...supplierForm, notes: e.target.value })
              }
            />
          </label>
          <div className="label-row-actions">
            <Button className="button primary" disabled={saving}>
              {saving ? (
                <LoaderCircle className="spinner" size={17} />
              ) : (
                <Save size={17} />
              )}{" "}
              Enregistrer
            </Button>
            {editingSupplier && (
              <Button
                type="button"
                variant="outline"
                className="button"
                onClick={cancelSupplier}
              >
                <X size={16} />
                Annuler
              </Button>
            )}
          </div>
          {!!suppliers.length && (
            <div className="label-row-actions">
              {suppliers.map((supplier) => (
                <span className="status-pill warn" key={supplier.id}>
                  {supplier.name}
                  <button
                    type="button"
                    aria-label={`Modifier ${supplier.name}`}
                    onClick={() => startSupplier(supplier)}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${supplier.name}`}
                    onClick={() => void removeSupplier(supplier)}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>
      )}
      <form className="panel panel-pad trace-form" onSubmit={saveLot}>
        <div className="trace-section-title">
          <span>
            <PackagePlus size={18} />
          </span>
          <div>
            <h3>
              {editingLot ? "Modifier le lot reçu" : "Enregistrer un lot reçu"}
            </h3>
            <p>Recopiez le lot et la DLC/DDM avant de jeter l’emballage.</p>
          </div>
        </div>
        {!suppliers.length && !loading ? (
          <div className="notice warning">
            Le responsable doit d’abord ajouter un fournisseur.
          </div>
        ) : (
          <>
            <div className="label-form-grid">
              <label className="field">
                Fournisseur
                <Select
                  value={lotForm.supplierId}
                  onValueChange={(supplierId) =>
                    setLotForm({ ...lotForm, supplierId })
                  }
                >
                  <SelectTrigger className="label-select">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="field">
                Matière première
                <Input
                  className="input"
                  required
                  placeholder="Jambon blanc"
                  value={lotForm.ingredientName}
                  onChange={(e) =>
                    setLotForm({ ...lotForm, ingredientName: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Lot fournisseur
                <Input
                  className="input"
                  required
                  value={lotForm.supplierLot}
                  onChange={(e) =>
                    setLotForm({ ...lotForm, supplierLot: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Réception
                <Input
                  className="input"
                  type="datetime-local"
                  required
                  value={lotForm.receivedAt}
                  onChange={(e) =>
                    setLotForm({ ...lotForm, receivedAt: e.target.value })
                  }
                />
              </label>
              <label className="field">
                DLC / DDM fournisseur
                <Input
                  className="input"
                  type="date"
                  value={lotForm.supplierDeadline}
                  onChange={(e) =>
                    setLotForm({ ...lotForm, supplierDeadline: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Quantité
                <Input
                  className="input"
                  placeholder="2 × 5 kg"
                  value={lotForm.quantity}
                  onChange={(e) =>
                    setLotForm({ ...lotForm, quantity: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Stockage
                <Select
                  value={lotForm.storageMode}
                  onValueChange={(storageMode) =>
                    setLotForm({
                      ...lotForm,
                      storageMode: storageMode as SupplierLot["storageMode"],
                      storageTemperature:
                        storageMode === "frozen"
                          ? "-18"
                          : storageMode === "ambient"
                            ? ""
                            : "4",
                    })
                  }
                >
                  <SelectTrigger className="label-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refrigerated">Réfrigéré</SelectItem>
                    <SelectItem value="frozen">Surgelé</SelectItem>
                    <SelectItem value="ambient">Ambiant</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="field">
                T° à réception
                <Input
                  className="input"
                  type="number"
                  step="0.1"
                  value={lotForm.storageTemperature}
                  onChange={(e) =>
                    setLotForm({
                      ...lotForm,
                      storageTemperature: e.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                Bon de livraison / référence
                <Input
                  className="input"
                  value={lotForm.documentRef}
                  onChange={(e) =>
                    setLotForm({ ...lotForm, documentRef: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              Notes <span className="optional">facultatif</span>
              <Textarea
                className="input"
                value={lotForm.notes}
                onChange={(e) =>
                  setLotForm({ ...lotForm, notes: e.target.value })
                }
              />
            </label>
            <div className="label-row-actions">
              <Button className="button primary" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spinner" size={17} />
                ) : (
                  <Save size={17} />
                )}{" "}
                Enregistrer le lot
              </Button>
              {editingLot && (
                <Button
                  type="button"
                  variant="outline"
                  className="button"
                  onClick={cancelLot}
                >
                  <X size={16} />
                  Annuler
                </Button>
              )}
            </div>
          </>
        )}
      </form>
      <section>
        <div className="month-heading">
          <div>
            <p className="eyebrow">Base fournisseurs</p>
            <h2>Lots disponibles</h2>
          </div>
          <span>
            {lots.length} lot{lots.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="register-filter">
          <Search size={17} />
          <Input
            className="input"
            type="search"
            placeholder="Produit, fournisseur, lot…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="panel">
          {loading ? (
            <div className="loading">
              <LoaderCircle className="spinner" size={22} /> Chargement…
            </div>
          ) : (
            <Table className="labels-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Matière / lot</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead>Stockage</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>
                      <strong>{lot.ingredientName}</strong>
                      <small>
                        Lot {lot.supplierLot}
                        {lot.supplierDeadline
                          ? ` · limite ${lot.supplierDeadline}`
                          : ""}
                      </small>
                    </TableCell>
                    <TableCell>
                      {lot.supplierName}
                      <small>{lot.documentRef}</small>
                    </TableCell>
                    <TableCell>{lot.receivedAt.replace("T", " ")}</TableCell>
                    <TableCell>
                      {lot.storageMode === "frozen"
                        ? "Surgelé"
                        : lot.storageMode === "ambient"
                          ? "Ambiant"
                          : "Réfrigéré"}
                      <small>
                        {lot.storageTemperature === null
                          ? ""
                          : `${lot.storageTemperature > 0 ? "+" : ""}${lot.storageTemperature} °C`}
                      </small>
                    </TableCell>
                    <TableCell>
                      {canAdminister && (
                        <div className="label-row-actions">
                          <Button
                            variant="outline"
                            className="button table-action"
                            onClick={() => startLot(lot)}
                          >
                            <Pencil size={14} />
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            className="button table-action table-action-danger"
                            onClick={() => void removeLot(lot)}
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
