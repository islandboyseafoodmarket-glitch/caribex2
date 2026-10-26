"use client";

import { INVOICE_FILTER_COLORS, tabColorStyle } from "../lib/shipment-colors";

export type InvoiceStatusTab = "pending" | "approved" | "all" | "problems" | "sent" | "paid";

type Props = {
  value: InvoiceStatusTab;
  onChange: (value: InvoiceStatusTab) => void;
  isEs?: boolean;
};

export default function InvoiceStatusTabs({ value, onChange, isEs = false }: Props) {
  const tabs: { id: InvoiceStatusTab; label: string }[] = [
    { id: "pending", label: isEs ? "Sin aprobar" : "Pending approval" },
    { id: "approved", label: isEs ? "Aprobadas" : "Approved" },
    { id: "all", label: "All" },
    { id: "problems", label: isEs ? "Problemas" : "Problems" },
    { id: "sent", label: isEs ? "Enviadas" : "Sent" },
    { id: "paid", label: isEs ? "Pagadas" : "Paid" },
  ];
  return <div className="invoice-status-tabs" role="group" aria-label={isEs ? "Filtrar facturas" : "Filter invoices"}>
    {tabs.map((tab) => <button key={tab.id} type="button" className={`tab-pill ${value === tab.id ? "active" : ""}`} style={tabColorStyle(INVOICE_FILTER_COLORS[tab.id])} onClick={() => onChange(tab.id)} aria-pressed={value === tab.id}>{tab.label}</button>)}
  </div>;
}
