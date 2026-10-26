"use client";

import { useMemo, useState } from "react";
import InvoiceViewModal, { type InvoiceViewData } from "../../components/InvoiceViewModal";
import { roundMoney } from "../../lib/invoice-pricing";

export type PaymentInvoice = {
  id: string;
  tracking: string;
  clienteNombre: string | null;
  clienteNumero: number | null;
  clienteEmail?: string | null;
  carrier: string | null;
  tipo_paquete: string | null;
  contenido: string | null;
  puerto?: string | null;
  creado_en: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  invoice_status: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;
  containerLabels?: string[];
  containerIds?: string[];
  /** The existing row may carry the complete source invoice under this property. */
  fullFactura?: unknown;
};

export type PaymentTotals = {
  invoiced: number;
  paid: number;
  outstanding: number;
};

export type PaymentFilters = {
  dateFrom: string;
  dateTo: string;
  customer: string;
  port: string;
  container: string;
};

export type PaymentBalance = {
  paid: number;
  balance: number;
};

export type PaymentsAdminProps<T extends PaymentInvoice> = {
  invoices: T[];
  totals: PaymentTotals;
  filters: PaymentFilters;
  onFiltersChange: (patch: Partial<PaymentFilters>) => void;
  statusFilter: "ALL" | "PAID" | "OUTSTANDING";
  onStatusFilterChange: (filter: "ALL" | "PAID" | "OUTSTANDING") => void;
  ports: string[];
  containers: [string, string][];
  onRecordPayment: (invoice: T) => void;
  onViewPaymentHistory?: (invoice: T) => void;
  recordingEnabled?: boolean;
  balancesReady?: boolean;
  /** Optional authoritative append-only ledger balances, keyed by invoice id. */
  balances?: Record<string, PaymentBalance>;
};

const money = (value: number) => `$${value.toFixed(2)}`;

function serviceDate(value: string | null | undefined) {
  if (!value) return "-";
  const calendar = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendar) return `${calendar[2]}/${calendar[3]}/${calendar[1]}`;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { timeZone: "America/Tegucigalpa" }) : "-";
}

function invoiceViewData<T extends PaymentInvoice>(invoice: T): InvoiceViewData {
  return {
    id: invoice.id,
    tracking: invoice.tracking,
    clientName: invoice.clienteNombre,
    clientNumber: invoice.clienteNumero,
    carrier: invoice.carrier,
    typeLabel: invoice.tipo_paquete || "Shipment",
    contents: invoice.contenido,
    billingSubtotal: invoice.subtotal,
    billingTax: invoice.tax,
    billingTotal: invoice.total,
    serviceDate: invoice.creado_en,
  };
}

export default function PaymentsAdmin<T extends PaymentInvoice>({
  invoices,
  totals,
  filters,
  onFiltersChange,
  statusFilter,
  onStatusFilterChange,
  ports,
  containers,
  onRecordPayment,
  onViewPaymentHistory,
  recordingEnabled = true,
  balancesReady = true,
  balances,
}: PaymentsAdminProps<T>) {
  const [selectedInvoice, setSelectedInvoice] = useState<T | null>(null);

  const owingOnly = statusFilter === "OUTSTANDING";
  const displayedInvoices = useMemo(() => {
    // The workspace has one intentional status control: Owing only. When it is
    // off, paid invoices must remain visible even if a legacy parent still has
    // the old PAID filter selected.
    return invoices.filter((invoice) => {
      if (!owingOnly) return true;
      const balance = balances?.[invoice.id]?.balance;
      return balancesReady && typeof balance === "number" && Number.isFinite(balance) && balance > 0;
    });
  }, [balances, balancesReady, invoices, owingOnly]);

  const getBalance = (invoice: T): { paid: number | null; balance: number | null } => {
    const ledger = balances?.[invoice.id];
    if (!balancesReady || !ledger || !Number.isFinite(ledger.paid) || !Number.isFinite(ledger.balance)) return { paid: null, balance: null };
    return { paid: roundMoney(ledger.paid), balance: roundMoney(ledger.balance) };
  };

  const updateFilter = (key: keyof PaymentFilters, value: string) => onFiltersChange({ [key]: value });

  return (
    <section className="payments-workspace" aria-labelledby="payments-workspace-title">
      <style>{`
        .payments-workspace { color: #0f172a; }
        .payments-workspace-heading { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; margin-bottom:1rem; }
        .payments-workspace-heading h2 { margin:0; font-size:1.15rem; }
        .payments-workspace-heading p { margin:.3rem 0 0; color:#64748b; font-size:.88rem; }
        .payments-workspace-filters { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; padding:1rem; border:1px solid #e2e8f0; border-radius:.85rem; background:#f8fafc; margin-bottom:1rem; }
        .payments-workspace-filters input, .payments-workspace-filters select { min-height:2.35rem; padding:.5rem .65rem; border:1px solid #cbd5e1; border-radius:.55rem; background:#fff; color:#0f172a; }
        .payments-workspace-search { flex:1 1 230px; }
        .payments-workspace-toggle { display:inline-flex; align-items:center; gap:.5rem; padding:.38rem .55rem; color:#334155; font-size:.86rem; white-space:nowrap; cursor:pointer; }
        .payments-workspace-toggle input { width:1rem; height:1rem; accent-color:#f97316; }
        .payments-workspace-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.7rem; margin-bottom:1rem; }
        .payments-workspace-summary-card { padding:.85rem 1rem; border:1px solid #e2e8f0; border-radius:.8rem; background:#fff; }
        .payments-workspace-summary-card span { display:block; color:#64748b; font-size:.78rem; }
        .payments-workspace-summary-card strong { display:block; margin-top:.22rem; font-size:1.25rem; }
        .payments-workspace-summary-card.invoiced strong { color:#1d4ed8; }
        .payments-workspace-summary-card.paid strong { color:#166534; }
        .payments-workspace-summary-card.outstanding strong { color:#b45309; }
        .payments-workspace-table-wrap { overflow-x:auto; border:1px solid #e2e8f0; border-radius:.8rem; background:#fff; }
        .payments-workspace table { width:100%; min-width:1040px; border-collapse:collapse; }
        .payments-workspace th { padding:.72rem .8rem; background:#f8fafc; color:#475569; font-size:.74rem; letter-spacing:.02em; text-align:left; white-space:nowrap; }
        .payments-workspace td { padding:.78rem .8rem; border-top:1px solid #eef2f7; vertical-align:middle; font-size:.85rem; }
        .payments-workspace tbody tr { cursor:pointer; transition:background .15s ease; }
        .payments-workspace tbody tr:hover { background:#fff7ed; }
        .payments-workspace .customer-name { font-weight:700; }
        .payments-workspace .muted-detail { display:block; margin-top:.18rem; color:#64748b; font-size:.74rem; }
        .payments-workspace .invoice-link { color:#1d4ed8; font-weight:700; text-decoration:underline; text-underline-offset:2px; }
        .payments-workspace .status { font-weight:700; }
        .payments-workspace .status.paid { color:#166534; }
        .payments-workspace .status.owing { color:#b45309; }
        .payments-workspace .record-payment-btn { border:1px solid #f97316; border-radius:999px; padding:.43rem .75rem; background:#fff7ed; color:#c2410c; font-size:.78rem; font-weight:700; cursor:pointer; white-space:nowrap; }
        .payments-workspace .record-payment-btn:hover { background:#ffedd5; }
        .payments-workspace-empty { padding:2.2rem 1rem; text-align:center; color:#64748b; }
        @media (max-width: 720px) { .payments-workspace-summary { grid-template-columns:1fr; } .payments-workspace-heading { display:block; } }
      `}</style>

      <div className="payments-workspace-heading">
        <div>
          <h2 id="payments-workspace-title">Payments</h2>
          <p>Review invoices, balances, and recorded payments. Payment records are append-only.</p>
        </div>
        <span style={{ color: "#64748b", fontSize: ".82rem" }}>{displayedInvoices.length} invoice{displayedInvoices.length === 1 ? "" : "s"}</span>
      </div>

      <div className="payments-workspace-filters">
        <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} aria-label="Latest payment date from" />
        <input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} aria-label="Latest payment date to" />
        <input className="payments-workspace-search" type="search" value={filters.customer} onChange={(event) => updateFilter("customer", event.target.value)} placeholder="Search client" aria-label="Search client" />
        <select value={filters.port} onChange={(event) => updateFilter("port", event.target.value)} aria-label="Filter by port">
          <option value="ALL">All ports</option>
          {ports.map((port) => <option key={port} value={port}>{port}</option>)}
        </select>
        <select value={filters.container} onChange={(event) => updateFilter("container", event.target.value)} aria-label="Filter by container">
          <option value="ALL">All containers</option>
          {containers.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <label className="payments-workspace-toggle">
          <input
            type="checkbox"
            checked={owingOnly}
            onChange={(event) => onStatusFilterChange(event.target.checked ? "OUTSTANDING" : "ALL")}
          />
          Owing only
        </label>
      </div>

      <div className="payments-workspace-summary" aria-label="Payment totals">
        <div className="payments-workspace-summary-card invoiced"><span>Total invoiced</span><strong>{money(roundMoney(totals.invoiced))}</strong></div>
        <div className="payments-workspace-summary-card paid"><span>Total paid</span><strong>{balancesReady ? money(roundMoney(totals.paid)) : "—"}</strong></div>
        <div className="payments-workspace-summary-card outstanding"><span>Outstanding</span><strong>{balancesReady ? money(roundMoney(totals.outstanding)) : "—"}</strong></div>
      </div>

      <div className="payments-workspace-table-wrap">
        {!balancesReady ? <div className="payments-workspace-empty" role="status">Verified payment balances are unavailable. Paid amounts, balances, and payment recording remain hidden until they can be loaded.</div> : displayedInvoices.length > 0 ? (
          <table>
            <thead>
              <tr><th>Customer</th><th>Client ID</th><th>Invoice</th><th>Container</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action / Record payment</th></tr>
            </thead>
            <tbody>
              {displayedInvoices.map((invoice) => {
                const { paid, balance } = getBalance(invoice);
                const isOwing = balance != null && balance > 0;
                const verified = paid != null && balance != null;
                const container = invoice.containerLabels?.filter(Boolean).join(", ") || "-";
                return (
                  <tr key={invoice.id} onClick={() => setSelectedInvoice(invoice)} title="Open invoice">
                    <td><span className="customer-name">{invoice.clienteNombre || "-"}</span>{invoice.clienteEmail && <span className="muted-detail">{invoice.clienteEmail}</span>}</td>
                    <td>#{invoice.clienteNumero ?? "-"}</td>
                    <td><button type="button" className="invoice-link" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }} onClick={(event) => { event.stopPropagation(); setSelectedInvoice(invoice); }} aria-label={`Open invoice ${invoice.tracking}`}>{invoice.tracking || "-"}</button></td>
                    <td>{container}</td>
                    <td>{money(roundMoney(Number(invoice.total || 0)))}</td>
                    <td>{paid == null ? "—" : money(paid)}</td>
                    <td>{balance == null ? "—" : money(balance)}</td>
                    <td>
                      <span className={`status ${isOwing ? "owing" : "paid"}`}>{!verified ? "Unverified" : isOwing ? "Outstanding" : "Paid"}</span>
                      {verified && !isOwing && (invoice.payment_date || invoice.payment_method || invoice.payment_reference) && (
                        <span className="muted-detail">
                          {[invoice.payment_date && serviceDate(invoice.payment_date), invoice.payment_method, invoice.payment_reference && `Ref ${invoice.payment_reference}`].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td>
                      {isOwing ? (
                        <button type="button" className="record-payment-btn" disabled={!recordingEnabled} onClick={(event) => { event.stopPropagation(); onRecordPayment(invoice); }}>
                          Record payment
                        </button>
                      ) : <span className="muted-detail" style={{ marginTop: 0 }}>{verified ? "Recorded — no edits" : "Balance unavailable"}</span>}
                      {onViewPaymentHistory && <button type="button" className="pa-secondary-btn" style={{ marginLeft: ".4rem", padding: ".35rem .55rem", fontSize: ".75rem" }} disabled={!recordingEnabled} onClick={(event) => { event.stopPropagation(); onViewPaymentHistory(invoice); }}>History</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="payments-workspace-empty">No invoices match these filters.</div>}
      </div>

      {selectedInvoice && <InvoiceViewModal invoice={invoiceViewData(selectedInvoice)} onClose={() => setSelectedInvoice(null)} />}
    </section>
  );
}
