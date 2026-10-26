"use client";

import React, { useMemo, useState } from "react";
import { FileText, Eye, Receipt, Trash2 } from "lucide-react";
import { BILLABLE_INVOICE_ITEMS, formatCatalogCharge } from "../lib/invoice-pricing";

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

const getCategoryLabel = (id: "BOX" | "PACKAGE", isEs: boolean): string => {
  if (isEs) {
    return id === "BOX" ? "Caja" : "Paquete";
  }
  return id === "BOX" ? "Box" : "Package";
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
    if (!manual.customer_id) {
      window.alert(isEs ? "Seleccione un cliente." : "Select a customer.");
      return;
    }
    if (!manual.charges.length && !manual.catalogLines.length) {
      window.alert(isEs ? "Seleccione un artículo del catálogo o un cargo operativo." : "Select a catalog item or operational extra.");
      return;
    }
    const catalogCharges = manual.catalogLines.map((line) => {
      const item = BILLABLE_INVOICE_ITEMS.find((candidate) => candidate.id === line.itemId);
      return item ? formatCatalogCharge(item, line.quantity) : null;
    }).filter((charge): charge is string => Boolean(charge));
    void onCreateManualInvoice?.({ customer_id: manual.customer_id, tracking: manual.tracking, description: manual.description, additional_charges: [...manual.charges, ...catalogCharges].join(", ") || null, tax_enabled: manual.taxEnabled });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Trabajar solo con envíos que estén en estado "Descargado" o "Entregado" (cualquier variante).
    const unloaded = packages.filter((p) => {
      const raw = (p.estado || "").toLowerCase();
      return raw.includes("descargado") || raw.includes("entregado");
    });

    // Si no hay término de búsqueda, mostramos todos los descargados.
    if (!term) return unloaded;

    // Filtrar por coincidencia parcial en el nombre del cliente dentro de los descargados.
    return unloaded.filter((p) => {
      const clientName = getClientName(p).toLowerCase();
      return clientName.includes(term);
    });
  }, [packages, search]);

  const hasPackages = filtered.length > 0;

  return (
    <>
      <style>{`
        .staff-invoice-modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(15, 23, 42, 0.48); }
        .staff-invoice-modal { width: min(680px, 96vw); background: #fff; border-radius: 1rem; box-shadow: 0 25px 80px rgba(15, 23, 42, .28); padding: 1.25rem; }
        .staff-invoice-modal-header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .75rem; }
        .staff-invoice-modal-title { margin: 0; color: #0f172a; font-size: 1.1rem; }
        .staff-invoice-modal-field { display: grid; gap: .3rem; }
        .staff-invoice-modal-field label { color: #475569; font-size: .82rem; font-weight: 600; }
        .staff-invoice-modal-field input, .staff-invoice-modal-field select { width: 100%; box-sizing: border-box; padding: .6rem .7rem; border: 1px solid #cbd5e1; border-radius: .6rem; background: #fff; color: #0f172a; }
        .staff-invoice-modal-actions { display: flex; justify-content: flex-end; gap: .75rem; margin-top: 1rem; }
      `}</style>
      <header className="ga-state-card-header">
        <div
          className="ga-state-title-row"
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="ga-state-header-icon">
              <FileText size={18} />
            </span>

            <div>
              <h2 className="ga-state-title">
                {isEs ? "Facturas" : "Invoices"}
              </h2>
              <p className="ga-state-subtitle">
                {isEs
                  ? `${filtered.length} pedidos listos para facturar`
                  : `${filtered.length} orders ready for invoicing`}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div className="ga-search-bar" style={{ maxWidth: 260 }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isEs
                    ? "Buscar factura por nombre de cliente..."
                    : "Search invoices by client name..."
                }
              />
            </div>

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
              <button type="button" className="ga-secondary-button" onClick={() => setManualOpen((open) => !open)}>
                {isEs ? "Crear factura manual" : "Create manual invoice"}
              </button>
            )}
          </div>
        </div>
      </header>

      {manualOpen && onCreateManualInvoice && (
        <div className="staff-invoice-modal-overlay" role="dialog" aria-modal="true" aria-label={isEs ? "Crear factura manual" : "Create manual invoice"}>
          <div className="staff-invoice-modal" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <div className="staff-invoice-modal-header"><h3 className="staff-invoice-modal-title">{isEs ? "Crear factura manual" : "Create manual invoice"}</h3><button type="button" className="ga-icon-button ga-icon-button-light" onClick={() => setManualOpen(false)} aria-label={isEs ? "Cerrar" : "Close"}>×</button></div>
          <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: ".86rem" }}>{isEs ? "Crea una factura pendiente usando las mismas reglas de facturación del panel Admin." : "Create a pending invoice using the same billing rules as the Admin panel."}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".75rem" }}>
            <div className="staff-invoice-modal-field"><label>Customer</label><select value={manual.customer_id} onChange={(e) => setManual({ ...manual, customer_id: e.target.value })}><option value="">No customer selected</option>{customerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></div>
            <div className="staff-invoice-modal-field"><label>Tracking (optional)</label><input value={manual.tracking} onChange={(e) => setManual({ ...manual, tracking: e.target.value })} placeholder="Auto-generated if blank" /></div>
            <div className="staff-invoice-modal-field" style={{ gridColumn: "1 / -1" }}><label>Notes (optional)</label><input value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} placeholder="Optional notes about this invoice" /></div>
          </div>
          <div style={{ marginTop: ".85rem" }}><strong style={{ color: "#334155", fontSize: ".85rem" }}>Operational extras</strong><div style={{ display: "grid", gap: ".35rem", marginTop: ".45rem" }}>{operationalCharges.map((charge) => <label key={charge} style={{ display: "flex", gap: ".45rem", alignItems: "center", color: "#475569", fontSize: ".84rem" }}><input type="checkbox" checked={manual.charges.includes(charge)} onChange={(e) => setManual({ ...manual, charges: e.target.checked ? [...manual.charges, charge] : manual.charges.filter((item) => item !== charge) })} />{charge}</label>)}</div></div>
          <div style={{ marginTop: "1rem", paddingTop: ".85rem", borderTop: "1px solid #e2e8f0" }}><strong style={{ color: "#334155", fontSize: ".85rem" }}>Catalog items</strong><div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 100px auto", gap: ".5rem", alignItems: "end", marginTop: ".45rem" }}><div className="staff-invoice-modal-field"><label>Catalog item</label><select value={manual.catalogItem} onChange={(e) => setManual({ ...manual, catalogItem: e.target.value })}><option value="">Select an item</option>{BILLABLE_INVOICE_ITEMS.map((item) => <option key={item.id} value={item.id}>{item.label} — ${item.unitPrice.toFixed(2)} / {item.unit}</option>)}</select></div><div className="staff-invoice-modal-field"><label>Qty</label><input type="number" min="1" step="1" value={manual.catalogQuantity} onChange={(e) => setManual({ ...manual, catalogQuantity: e.target.value })} /></div><button type="button" className="ga-secondary-button" disabled={!manual.catalogItem} onClick={addCatalogLine}>Add item</button></div>{manual.catalogLines.length > 0 && <div style={{ display: "grid", gap: ".35rem", marginTop: ".6rem" }}>{manual.catalogLines.map((line) => { const item = BILLABLE_INVOICE_ITEMS.find((candidate) => candidate.id === line.itemId); if (!item) return null; return <div key={line.itemId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: ".45rem .6rem", borderRadius: ".5rem", background: "#f8fafc", color: "#475569", fontSize: ".82rem" }}>{formatCatalogCharge(item, line.quantity)}<button type="button" className="ga-icon-button ga-icon-button-light" onClick={() => setManual({ ...manual, catalogLines: manual.catalogLines.filter((candidate) => candidate.itemId !== line.itemId) })}>×</button></div>; })}</div>}</div>
          <label style={{ display: "flex", gap: ".45rem", alignItems: "center", marginTop: ".9rem", color: "#475569", fontSize: ".84rem" }}><input type="checkbox" checked={manual.taxEnabled} onChange={(e) => setManual({ ...manual, taxEnabled: e.target.checked })} />Apply 15% sales tax</label>
          <div className="staff-invoice-modal-actions"><button type="button" className="ga-secondary-button" onClick={() => setManualOpen(false)}>Cancel</button><button type="button" className="ga-primary-button" onClick={submitManualInvoice}>Create invoice</button></div>
          </div>
        </div>
      )}

      {hasPackages ? (
        <div className="ga-table-card">
          <table className="ga-table">
            <thead>
              <tr>
                <th>{isEs ? "N.º cliente" : "Client #"}</th>
                <th>{isEs ? "Nombre cliente" : "Client name"}</th>
                <th>Tracking</th>
                <th>{isEs ? "Paquetería" : "Carrier"}</th>
                <th>{isEs ? "Tipo" : "Type"}</th>
                <th>{isEs ? "Subtotal" : "Subtotal"}</th>
                <th>{isEs ? "Impuesto de venta (15%)" : "Sales tax (15%)"}</th>
                <th>{isEs ? "Total" : "Total"}</th>
                <th>{isEs ? "Aprobación" : "Approval"}</th>
                <th>{isEs ? "Estado factura" : "Invoice status"}</th>
                <th className="ga-table-col-actions">
                  {isEs ? "Acciones" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="ga-table-row">
                  <td className="ga-table-text">
                    {p.numeroCliente != null ? p.numeroCliente : "-"}
                  </td>
                  <td className="ga-table-text">{getClientName(p)}</td>
                  <td className="ga-table-tracking">{p.tracking}</td>
                  <td className="ga-table-text">{p.carrier || "-"}</td>
                  <td className="ga-table-text">
                    <span className="ga-tag">{getCategoryLabel(p.type, isEs)}</span>
                  </td>
                  <td className="ga-table-text">
                    {formatCurrency(p.billing_subtotal ?? null)}
                  </td>
                  <td className="ga-table-text">
                    {formatCurrency(p.billing_tax ?? null)}
                  </td>
                  <td className="ga-table-text">
                    {formatCurrency(p.billing_total ?? null)}
                  </td>
                  <td className="ga-table-text">
                    {getApprovalLabel(p.approval_status, isEs)}
                  </td>
                  <td className="ga-table-text">
                    {getInvoiceStatusLabel(p.invoice_status, isEs)}
                  </td>
                  <td className="ga-table-actions">
                    <div
                      style={{
                        display: "flex",
                        gap: "0.25rem",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        type="button"
                        className="ga-icon-button"
                        title={isEs ? "Ver factura" : "View invoice"}
                        onClick={() => onView(p)}
                      >
                        <Receipt size={16} />
                      </button>

                      {onDeleteInvoice && (
                        <button
                          type="button"
                          className="ga-icon-button ga-icon-button-danger"
                          title={isEs ? "Eliminar factura" : "Delete invoice"}
                          onClick={() => onDeleteInvoice(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ga-empty-state">
          <div className="ga-empty-icon">
            <FileText size={24} />
          </div>
          <p className="ga-empty-title">
            {isEs
              ? "No hay pedidos listos para facturar"
              : "No orders ready for invoicing"}
          </p>
        </div>
      )}
    </>
  );
};

export default InvoicesStage;
