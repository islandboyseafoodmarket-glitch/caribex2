"use client";

import React, { useMemo, useState } from "react";
import { FileText, Eye, Receipt, Trash2 } from "lucide-react";

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
}) => {
  const [search, setSearch] = useState("");

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
          </div>
        </div>
      </header>

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
                <th>IVA 15%</th>
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
