"use client";

import React, { useMemo, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { BILLABLE_INVOICE_ITEMS, formatCatalogCharge } from "../lib/invoice-pricing";
import { INVOICE_FILTER_COLORS, tabColorStyle } from "../lib/shipment-colors";

// Este tipo refleja el tipo Package definido en GestionAlmacen,
// pero solo con los campos que necesitamos para facturas.
type PackageForInvoice = {
  id: string;
  tracking: string;
  remitente?: string | null;
  destinatario?: string | null;
  carrier?: string | null;
  type: "BOX" | "PACKAGE";
  numeroCliente?: number | null;
  numeroClienteId?: string | null;
  estado?: string | null;
  clienteNombre?: string | null;
  billing_subtotal?: number | null;
  billing_tax?: number | null;
  billing_total?: number | null;
  approval_status?: string | null;
  invoice_status?: string | null;
  issue_status?: string | null;
  containerCode?: string | null;
};

type InvoicesStageProps = {
  isEs: boolean;
  packages: PackageForInvoice[];
  onView: (pkg: PackageForInvoice) => void;
  onBulkGenerate?: () => void | Promise<void>;
  onChangeApproval?: (pkg: PackageForInvoice, status: "APPROVED" | "REJECTED") => void | Promise<void>;
  onChangeInvoiceStatus?: (
    pkg: PackageForInvoice,
    status: "PENDING" | "SENT" | "PAID" | "OVERDUE",
  ) => void | Promise<void>;
  onDeleteInvoice?: (pkg: PackageForInvoice) => void | Promise<void>;
  onCreateManualInvoice?: (input: { customer_id: string; tracking: string; description: string; additional_charges: string | null; tax_enabled: boolean }) => void | Promise<void>;
};

const getClientName = (pkg: PackageForInvoice): string => {
  // Preferimos el nombre del cliente proveniente de numero_cliente.
  if (pkg.clienteNombre && pkg.clienteNombre.trim().length > 0) {
    return pkg.clienteNombre.trim();
  }
  // Como respaldo, usamos destinatario o remitente si existen.
  const name = (pkg.destinatario || pkg.remitente || "").toString().trim();
  return name || "-";
};

const formatCurrency = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
};

const getApprovalLabel = (status: string | null | undefined, isEs: boolean): string => {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return isEs ? "Aprobado" : "Approved";
  if (s === "REJECTED") return isEs ? "Rechazado" : "Rejected";
  return isEs ? "Pendiente" : "Pending";
};

const getInvoiceStatusLabel = (status: string | null | undefined, isEs: boolean): string => {
  const s = (status || "").toUpperCase();
  if (s === "PAID") return isEs ? "Pagada" : "Paid";
  if (s === "SENT") return isEs ? "Enviada" : "Sent";
  if (s === "OVERDUE") return isEs ? "Vencida" : "Overdue";
  return isEs ? "Pendiente" : "Pending";
};

const InvoicesStage: React.FC<InvoicesStageProps> = ({
  isEs,
  packages,
  onView,
  onBulkGenerate,
  onChangeApproval,
  onChangeInvoiceStatus,
  onDeleteInvoice,
  onCreateManualInvoice,
}) => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"pending" | "approved" | "all" | "problems" | "sent" | "paid">("pending");
  const [containerFilter, setContainerFilter] = useState("ALL");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ customer_id: "", tracking: "", description: "", charges: [] as string[], catalogLines: [] as { itemId: string; quantity: number }[], catalogItem: "", catalogQuantity: "1", taxEnabled: true });
  const customerOptions = useMemo(() => Array.from(new Map(packages.filter((p) => p.numeroClienteId).map((p) => [p.numeroClienteId, { id: p.numeroClienteId as string, label: `${p.clienteNombre || "Customer"} · ${p.numeroCliente || ""}` }])).values()), [packages]);
  const operationalCharges = ["Handling fees", "Forklift charge ($100)", "Miscellaneous fee ($10)", "Consolidation fee ($2.5)"];
  const addCatalogLine = () => {
    const quantity = Math.floor(Number(manual.catalogQuantity));
    if (!manual.catalogItem || !Number.isFinite(quantity) || quantity < 1) return;
    setManual((previous) => {
      const existing = previous.catalogLines.find((line) => line.itemId === previous.catalogItem);
      const catalogLines = existing
        ? previous.catalogLines.map((line) => line.itemId === previous.catalogItem ? { ...line, quantity: line.quantity + quantity } : line)
        : [...previous.catalogLines, { itemId: previous.catalogItem, quantity }];
      return { ...previous, catalogLines, catalogItem: "", catalogQuantity: "1" };
    });
  };
  const submitManualInvoice = () => {
    const selectedQuantity = Math.floor(Number(manual.catalogQuantity));
    const pendingCatalogLines = manual.catalogItem && Number.isFinite(selectedQuantity) && selectedQuantity >= 1
      ? [...manual.catalogLines.filter((line) => line.itemId !== manual.catalogItem), { itemId: manual.catalogItem, quantity: selectedQuantity }]
      : manual.catalogLines;
    if (!manual.customer_id) {
      window.alert(isEs ? "Seleccione un cliente." : "Select a customer.");
      return;
    }
    if (!manual.charges.length && !pendingCatalogLines.length) {
      window.alert(isEs ? "Seleccione un artículo del catálogo o un cargo operativo." : "Select a catalog item or operational extra.");
      return;
    }
    const catalogCharges = pendingCatalogLines.map((line) => {
      const item = BILLABLE_INVOICE_ITEMS.find((candidate) => candidate.id === line.itemId);
      return item ? formatCatalogCharge(item, line.quantity) : null;
    }).filter((charge): charge is string => Boolean(charge));
    void onCreateManualInvoice?.({ customer_id: manual.customer_id, tracking: manual.tracking, description: manual.description, additional_charges: [...manual.charges, ...catalogCharges].join(", ") || null, tax_enabled: manual.taxEnabled });
  };

  const invoiceReady = useMemo(
    () => packages.filter((p) => {
      const raw = (p.estado || "").toLowerCase();
      return raw.includes("descargado") || raw.includes("entregado");
    }),
    [packages],
  );
  const containerOptions = useMemo(
    () => Array.from(new Set(invoiceReady.map((p) => p.containerCode?.trim()).filter((code): code is string => Boolean(code)))).sort((a, b) => a.localeCompare(b)),
    [invoiceReady],
  );
  const filtered = useMemo(() => {
    const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const term = normalize(search);
    return invoiceReady.filter((p) => {
      const approval = (p.approval_status || "").toUpperCase();
      const invoice = (p.invoice_status || "").toUpperCase();
      const hasProblem = approval === "REJECTED" || invoice === "OVERDUE" || (p.issue_status || "").toUpperCase() === "OPEN";
      const matchesSearch = !term || [p.tracking, p.clienteNombre, p.numeroCliente, p.carrier].some((value) => normalize(value).includes(term));
      const matchesContainer = containerFilter === "ALL" || p.containerCode === containerFilter;
      let matchesStatus = true;
      if (activeFilter === "pending") matchesStatus = !approval || approval === "PENDING";
      else if (activeFilter === "approved") matchesStatus = approval === "APPROVED";
      else if (activeFilter === "sent") matchesStatus = invoice === "SENT";
      else if (activeFilter === "paid") matchesStatus = invoice === "PAID";
      else if (activeFilter === "problems") matchesStatus = hasProblem;
      return matchesSearch && matchesContainer && matchesStatus;
    });
  }, [invoiceReady, search, containerFilter, activeFilter]);

  const invoiceTabs = [
    { id: "pending", label: isEs ? "Por aprobar" : "Pending approval" },
    { id: "approved", label: isEs ? "Aprobadas" : "Approved" },
    { id: "all", label: isEs ? "Todas" : "All" },
    { id: "problems", label: isEs ? "Problemas" : "Problems" },
    { id: "sent", label: isEs ? "Enviadas" : "Sent" },
    { id: "paid", label: isEs ? "Pagadas" : "Paid" },
  ] as const;

  const hasPackages = filtered.length > 0;

  return (
    <>
      <style>{`
        .staff-invoice-modal-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1.5rem; background: rgba(15, 23, 42, .45); }
        .staff-invoice-modal { width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; box-sizing: border-box; background: #fff; border: 1.25px solid #e2e8f0; border-radius: 1.25rem; box-shadow: 0 24px 60px rgba(15, 23, 42, .25); padding: 1.75rem 1.75rem 1.5rem; }
        .staff-invoice-modal-header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1rem; }
        .staff-invoice-modal-title { margin: 0; color: #0f172a; font-size: 1.1rem; font-weight: 700; }
        .staff-invoice-modal-close { border: none; background: transparent; cursor: pointer; font-size: 1.25rem; color: #94a3b8; }
        .staff-invoice-modal-field { display: grid; gap: .3rem; margin-bottom: .9rem; }
        .staff-invoice-modal-field label { color: #475569; font-size: .8rem; font-weight: 600; }
        .staff-invoice-modal-field input, .staff-invoice-modal-field select { width: 100%; box-sizing: border-box; padding: .6rem .75rem; border: 1px solid #e2e8f0; border-radius: .6rem; background: #fff; color: #0f172a; font-size: .9rem; }
        .staff-invoice-modal-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1.1rem; }
        .staff-invoice-catalog-grid { display: grid; grid-template-columns: minmax(220px, 1fr) 100px auto; gap: .5rem; align-items: end; }
        .staff-invoice-catalog-grid .staff-invoice-modal-field { margin-bottom: 0; }
        @media (max-width: 600px) { .staff-invoice-catalog-grid { grid-template-columns: 1fr; align-items: stretch; } .staff-invoice-catalog-grid .ga-secondary-button { width: 100%; } }
      `}</style>
      <header className="invoice-panel-header">
        <div className="invoice-panel-heading">
          <span className="ga-state-header-icon" aria-hidden="true">
            <FileText size={18} />
          </span>
          <div>
            <h2>
              {isEs ? "Facturas" : "Invoices"}
            </h2>
            <p>
              {isEs
                ? `${filtered.length} de ${invoiceReady.length} facturas`
                : `${filtered.length} of ${invoiceReady.length} invoices`}
            </p>
          </div>
        </div>
        <div className="invoice-panel-actions">
          {onBulkGenerate && (
            <button
              type="button"
              className="ga-secondary-button"
              onClick={() => onBulkGenerate()}
            >
              {isEs
                ? "Generar facturas descargadas"
                : "Generate unloaded invoices"}
            </button>
          )}
          {onCreateManualInvoice && (
            <button type="button" className="ga-primary-button" onClick={() => setManualOpen((open) => !open)}>
              <Plus size={16} />
              {isEs ? "Crear factura" : "Create invoice"}
            </button>
          )}
        </div>
      </header>

      {invoiceReady.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.85rem" }}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isEs ? "Buscar nombre, cuenta, email o tracking..." : "Search customer name, account, email, or tracking..."}
              aria-label={isEs ? "Buscar facturas por cliente o cuenta" : "Search invoices by customer or account"}
              style={{ flex: "1 1 300px", minHeight: 40, padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.65rem" }}
            />
            <select
              value={containerFilter}
              onChange={(event) => setContainerFilter(event.target.value)}
              aria-label={isEs ? "Filtrar facturas por contenedor" : "Filter invoices by container"}
              style={{ minHeight: 40, minWidth: 240, padding: "0.6rem 0.75rem", border: "1px solid #cbd5e1", borderRadius: "0.65rem", background: "#fff" }}
            >
              <option value="ALL">{isEs ? "Todos los contenedores" : "All containers"}</option>
              {containerOptions.map((code) => <option key={code} value={code}>{isEs ? `Contenedor: ${code}` : `Container: ${code}`}</option>)}
            </select>
            {(search || containerFilter !== "ALL") && <button type="button" className="ga-secondary-button" onClick={() => { setSearch(""); setContainerFilter("ALL"); }}>{isEs ? "Limpiar filtros" : "Clear filters"}</button>}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
            {invoiceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-pill ${activeFilter === tab.id ? "active" : ""}`}
                style={{ ...tabColorStyle(INVOICE_FILTER_COLORS[tab.id]), minWidth: tab.id === "pending" || tab.id === "approved" || tab.id === "sent" || tab.id === "paid" ? 120 : tab.id === "problems" ? 110 : 100, fontSize: "0.8rem" }}
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={activeFilter === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}

      {manualOpen && onCreateManualInvoice && (
        <div className="staff-invoice-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="staff-manual-invoice-title">
          <div className="staff-invoice-modal">
            <div className="staff-invoice-modal-header">
              <h3 id="staff-manual-invoice-title" className="staff-invoice-modal-title">{isEs ? "Crear factura manual" : "Create manual invoice"}</h3>
              <button type="button" className="staff-invoice-modal-close" onClick={() => setManualOpen(false)} aria-label={isEs ? "Cerrar" : "Close"}>×</button>
            </div>
            <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: ".86rem" }}>{isEs ? "Crea una factura pendiente usando las mismas reglas de facturación del panel Admin." : "Create a pending invoice using the same billing rules as the Admin panel."}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".75rem" }}>
              <div className="staff-invoice-modal-field"><label htmlFor="staff-manual-invoice-customer">Customer</label><select id="staff-manual-invoice-customer" value={manual.customer_id} onChange={(e) => setManual({ ...manual, customer_id: e.target.value })}><option value="">No customer selected</option>{customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></div>
              <div className="staff-invoice-modal-field"><label htmlFor="staff-manual-invoice-tracking">Tracking (optional)</label><input id="staff-manual-invoice-tracking" value={manual.tracking} onChange={(e) => setManual({ ...manual, tracking: e.target.value })} placeholder="Auto-generated if blank" /></div>
              <div className="staff-invoice-modal-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="staff-manual-invoice-description">Notes (optional)</label><input id="staff-manual-invoice-description" value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} placeholder="Optional notes about this invoice" /></div>
            </div>
            <div style={{ marginTop: ".85rem" }}><strong style={{ display: "block", marginBottom: ".45rem", color: "#334155", fontSize: ".85rem" }}>Additional charges</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".4rem .75rem" }}>{operationalCharges.map((charge) => <label key={charge} style={{ display: "flex", gap: ".45rem", alignItems: "center", color: "#475569", fontSize: ".84rem" }}><input type="checkbox" checked={manual.charges.includes(charge)} onChange={(e) => setManual({ ...manual, charges: e.target.checked ? [...manual.charges, charge] : manual.charges.filter((item) => item !== charge) })} />{charge}</label>)}</div></div>
            <div style={{ marginTop: "1rem", paddingTop: ".85rem", borderTop: "1px solid #e2e8f0" }}><strong style={{ display: "block", marginBottom: ".45rem", color: "#334155", fontSize: ".85rem" }}>Catalog items</strong><div className="staff-invoice-catalog-grid"><div className="staff-invoice-modal-field"><label htmlFor="staff-manual-invoice-catalog-item">Catalog item</label><select id="staff-manual-invoice-catalog-item" value={manual.catalogItem} onChange={(e) => setManual({ ...manual, catalogItem: e.target.value })}><option value="">Select an item</option>{BILLABLE_INVOICE_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.label} — ${item.unitPrice.toFixed(2)} / {item.unit}</option>)}</select></div><div className="staff-invoice-modal-field"><label htmlFor="staff-manual-invoice-catalog-quantity">Qty</label><input id="staff-manual-invoice-catalog-quantity" type="number" min="1" step="1" value={manual.catalogQuantity} onChange={(e) => setManual({ ...manual, catalogQuantity: e.target.value })} /></div><button type="button" className="ga-secondary-button" disabled={!manual.catalogItem} onClick={addCatalogLine}>Add item</button></div>{manual.catalogLines.length > 0 && <div style={{ display: "grid", gap: ".35rem", marginTop: ".6rem" }}>{manual.catalogLines.map((line) => { const item = BILLABLE_INVOICE_ITEMS.find((candidate) => candidate.id === line.itemId); if (!item) return null; return <div key={line.itemId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".75rem", padding: ".45rem .6rem", borderRadius: ".5rem", background: "#f8fafc", color: "#475569", fontSize: ".82rem" }}><span>{formatCatalogCharge(item, line.quantity)}</span><button type="button" className="staff-invoice-modal-close" style={{ fontSize: "1rem" }} onClick={() => setManual({ ...manual, catalogLines: manual.catalogLines.filter((candidate) => candidate.itemId !== line.itemId) })} aria-label={`Remove ${item.label}`}>×</button></div>; })}</div>}</div>
            <label style={{ display: "flex", gap: ".45rem", alignItems: "center", marginTop: ".9rem", color: "#475569", fontSize: ".84rem" }}><input type="checkbox" checked={manual.taxEnabled} onChange={(e) => setManual({ ...manual, taxEnabled: e.target.checked })} />Apply 15% handling fee</label>
            <div className="staff-invoice-modal-actions"><button type="button" className="ga-secondary-button" onClick={() => setManualOpen(false)}>Cancel</button><button type="button" className="ga-primary-button" onClick={submitManualInvoice}>Create invoice</button></div>
          </div>
        </div>
      )}

      {hasPackages ? (
        <div className="invoice-table-scroll">
          <div className="invoice-table-header">
            <span>Tracking</span>
            <span>{isEs ? "Cliente / cuenta" : "Customer / account"}</span>
            <span>{isEs ? "Paquetería" : "Carrier"}</span>
            <span>Total</span>
            <span>{isEs ? "Aprobación" : "Approval"}</span>
            <span>{isEs ? "Estado factura" : "Invoice status"}</span>
            <span>{isEs ? "Acciones" : "Actions"}</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((p) => {
              const approval = (p.approval_status || "").toUpperCase();
              const invoice = (p.invoice_status || "").toUpperCase();
              const approvalColor = approval === "APPROVED" ? "#166534" : approval === "REJECTED" ? "#b91c1c" : "#b45309";
              const invoiceColor = invoice === "PAID" ? "#166534" : invoice === "OVERDUE" ? "#b91c1c" : invoice === "SENT" ? "#1d4ed8" : "#64748b";
              return (
                <li key={p.id} className="invoice-table-row">
                  <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}><button type="button" className="ga-client360-tracking" onClick={() => onView(p)} title={isEs ? "Abrir factura" : "Open invoice"}>#{p.tracking || "-"}</button></span>
                  <span style={{ color: "#0f172a" }}>
                    <span style={{ display: "block", fontWeight: 600 }}>{getClientName(p)}</span>
                    <span style={{ display: "block", marginTop: "0.2rem", color: "#64748b", fontSize: "0.8rem" }}>{isEs ? "Cuenta" : "Account"}: {p.numeroCliente != null ? `#${p.numeroCliente}` : "-"}</span>
                  </span>
                  <span style={{ color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.carrier || "-"}</span>
                  <span style={{ fontFeatureSettings: '"tnum" on' }}>{formatCurrency(p.billing_total ?? null)}</span>
                  <span style={{ color: approvalColor, fontSize: "0.85rem" }}>{getApprovalLabel(p.approval_status, isEs)}</span>
                  <span style={{ color: invoiceColor, fontSize: "0.85rem" }}>{getInvoiceStatusLabel(p.invoice_status, isEs)}</span>
                  <div style={{ display: "flex", justifyContent: "flex-start", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                    <button type="button" className="ga-secondary-button" style={{ padding: "0.3rem 0.55rem", fontSize: "0.72rem", whiteSpace: "nowrap" }} onClick={() => onView(p)}>{isEs ? "Ver" : "View"}</button>
                    {onDeleteInvoice && <button type="button" className="ga-icon-button ga-icon-button-danger" title={isEs ? "Eliminar factura" : "Delete invoice"} onClick={() => onDeleteInvoice(p)}><Trash2 size={16} /></button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="ga-empty-state">
          <div className="ga-empty-icon">
            <FileText size={24} />
          </div>
          <p className="ga-empty-title">
            {isEs
              ? "No hay facturas que coincidan con estos filtros"
              : "No invoices match these filters"}
          </p>
          {(search || containerFilter !== "ALL" || activeFilter !== "all") && <button type="button" className="ga-secondary-button" onClick={() => { setSearch(""); setContainerFilter("ALL"); setActiveFilter("all"); }}>{isEs ? "Ver todas las facturas" : "Show all invoices"}</button>}
        </div>
      )}
    </>
  );
};

export default InvoicesStage;
