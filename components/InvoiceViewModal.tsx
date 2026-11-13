"use client";

import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type InvoiceViewData = {
  id: string;
  tracking: string;
  clientName?: string | null;
  clientNumber?: number | null;
  clientEmail?: string | null;
  port?: string | null;
  containerLabels?: string[];
  carrier?: string | null;
  typeLabel: string;
  contents?: string | null;
  billingSubtotal?: number | null;
  billingTax?: number | null;
  billingTotal?: number | null;
  serviceDate?: string | null;
  invoiceStatus?: string | null;
  paymentMethod?: string | null;
  paymentNotes?: string | null;
  paymentReference?: string | null;
  paymentDate?: string | null;
  invoiceSentAt?: string | null;
  lateFeeApplied?: boolean;
  approvalStatus?: string | null;
  paymentStatus?: string | null;
  paidAmount?: number | null;
  balanceAmount?: number | null;
  container?: string | null;
};

type InvoicePackage = { id: string; tracking: string; typeLabel: string; status: string };
const money = (value: number | null | undefined) => `$${Number(value || 0).toFixed(2)}`;

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", dateStyle: "short", timeStyle: "short" }).format(date)
    : value;
}

export default function InvoiceViewModal({ invoice, onClose, actions }: { invoice: InvoiceViewData; onClose: () => void; actions?: ReactNode }) {
  const [packages, setPackages] = useState<InvoicePackage[]>([{ id: invoice.id, tracking: invoice.tracking, typeLabel: invoice.typeLabel, status: "-" }]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const loadPackages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("paquetes_checkin")
        .select("paquete_id, parent_box_id, creado_en, paquetes_registro:paquete_id (id, tracking, tipo_paquete, estado)")
        .or(`paquete_id.eq.${invoice.id},parent_box_id.eq.${invoice.id}`)
        .order("creado_en", { ascending: true });
      if (!active || controller.signal.aborted) return;
      const rows = (data || []).map((row: any) => row.paquetes_registro).filter(Boolean);
      const all = [
        { id: invoice.id, tracking: invoice.tracking, typeLabel: invoice.typeLabel, status: "-" },
        ...rows.map((row: any) => ({ id: String(row.id), tracking: String(row.tracking || "-"), typeLabel: String(row.tipo_paquete || "Package"), status: String(row.estado || "-") })),
      ];
      const seen = new Set<string>();
      setPackages(all.filter((item) => !seen.has(item.id) && seen.add(item.id)));
      if (error) setPackages([{ id: invoice.id, tracking: invoice.tracking, typeLabel: invoice.typeLabel, status: "-" }]);
      setLoading(false);
    };
    void loadPackages();
    return () => { active = false; controller.abort(); };
  }, [invoice.id, invoice.tracking, invoice.typeLabel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const paymentStatus = invoice.paymentStatus || (invoice.invoiceStatus === "PAID" ? "Paid" : "Not paid");
  const approvalStatus = invoice.approvalStatus || "UNAPPROVED";
  const total = Number(invoice.billingTotal || 0);
  const paid = invoice.paidAmount == null ? (paymentStatus.toUpperCase() === "PAID" ? total : 0) : Number(invoice.paidAmount);
  const balance = invoice.balanceAmount == null ? Math.max(0, total - paid) : Number(invoice.balanceAmount);

  return (
    <div className="pa-modal-overlay" style={{ zIndex: 10050 }} onClick={onClose}>
      <div className="pa-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-view-modal-title" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 760, maxHeight: "90vh", overflowY: "auto", padding: "1.35rem 1.5rem" }}>
        <div className="pa-modal-header" style={{ marginBottom: "1rem" }}><h2 id="invoice-view-modal-title" className="pa-modal-title">▣&nbsp; Invoice</h2><button type="button" className="pa-close-btn" onClick={onClose} aria-label="Close invoice">×</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "145px minmax(0,1fr)", gap: "0.55rem 1.2rem", fontSize: "1rem", padding: "0.25rem 0 1.1rem" }}>
          <span style={{ color: "#64748b" }}>Client</span><strong>{invoice.clientName || "-"} {invoice.clientNumber != null ? ` (#${invoice.clientNumber})` : ""}</strong>
          <span style={{ color: "#64748b" }}>Status</span><strong>{approvalStatus}</strong>
          <span style={{ color: "#64748b" }}>Payment</span><strong style={{ color: paymentStatus.toUpperCase() === "PAID" ? "#166534" : "#64748b" }}>{paymentStatus}</strong>
          <span style={{ color: "#64748b" }}>Total</span><strong>{money(total)} <span style={{ fontWeight: 500, color: "#475569" }}>(subtotal {money(invoice.billingSubtotal)}, tax {money(invoice.billingTax)})</span></strong>
          <span style={{ color: "#64748b" }}>Balance</span><strong style={{ color: balance > 0 ? "#b45309" : "#166534" }}>{money(balance)}</strong>
          <span style={{ color: "#64748b" }}>Container</span><strong>{invoice.container || invoice.containerLabels?.filter(Boolean).join(", ") || "-"}</strong>
          <span style={{ color: "#64748b" }}>Created</span><strong>{dateTime(invoice.serviceDate)}</strong>
        </div>
        <section style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}><h3 style={{ margin: "0 0 0.55rem", fontSize: "1.05rem" }}>Packages on this invoice ({packages.length})</h3>
          {loading ? <p style={{ color: "#64748b", margin: 0 }}>Loading packages…</p> : <div style={{ display: "grid", gap: "0.35rem" }}>{packages.map((item) => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.8fr) minmax(100px,1fr) minmax(120px,1fr)", gap: "0.75rem", color: "#475569", padding: "0.2rem 0" }}><button type="button" style={{ border: 0, padding: 0, background: "transparent", textAlign: "left", color: "#2563eb", font: "inherit", cursor: "pointer" }} onClick={onClose}>{item.tracking}</button><span>{item.typeLabel}</span><span>{item.id === invoice.id && item.status === "-" ? "" : item.status}</span></div>)}</div>}
        </section>
        {actions && <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: ".6rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>{actions}</div>}
      </div>
    </div>
  );
}
