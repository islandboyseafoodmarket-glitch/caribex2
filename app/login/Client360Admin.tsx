"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CalendarDays, Mail, MapPin, Phone, PackageOpen, Search, UserRound, Users } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type Cliente = { id: string; nombre: string; numero_cliente: number; email: string | null; telefono: string | null; puerto: string | null; tipo_cuenta: string | null; creado_en: string | null; auth_user_id?: string | null };
type Pedido = { id: string; tracking: string; clienteNumero: number | null; clienteNombre: string | null; estado: string | null; carrier?: string | null; tipo_paquete?: string | null; contenido?: string | null; notas?: string | null; numero_cliente_id?: string | null; registro?: string | null; hora_fecha?: string | null; fecha_entregado?: string | null; problema?: boolean | null; problema_notas?: string | null };
type Factura = { id: string; tracking: string; clienteNumero: number | null; clienteNombre: string | null; carrier: string | null; tipo_paquete: string | null; subtotal: number | null; tax: number | null; total: number | null; approval_status: string | null; invoice_status: string | null; notas: string | null };

const STAGE_LABELS = ["Received", "Registered", "In transit", "Unloaded", "Picked up"];

function safeDate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const dayFirst = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(.*))?$/);
  const normalized = dayFirst
    ? `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}${dayFirst[4] ? `T${dayFirst[4]}` : "T00:00:00"}`
    : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "-";
  return /(?:T|\s)\d{1,2}:\d{2}/.test(raw) ? date.toLocaleString() : date.toLocaleDateString();
}

function stageFor(status: string | null) {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("entregado") || normalized.includes("recogido") || normalized.includes("picked")) return "Picked up";
  if (normalized.includes("descargado") || normalized.includes("unloaded")) return "Unloaded";
  if (normalized.includes("transito") || normalized.includes("tránsito") || normalized.includes("transit")) return "In transit";
  if (normalized.includes("registro") || normalized.includes("registered")) return "Registered";
  return "Received";
}

export default function Client360Admin({ clientes, pedidos, facturas }: { clientes: Cliente[]; pedidos: Pedido[]; facturas: Factura[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [balanceFilter, setBalanceFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Pedido | null>(null);
  const selected = clientes.find((client) => client.id === selectedId) || null;
  const now = Date.now();

  const records = useMemo(() => clientes.map((client) => {
    const packages = pedidos.filter((item) => item.numero_cliente_id === client.id || item.clienteNumero === client.numero_cliente);
    return { client, packages };
  }), [clientes, pedidos]);

  const filteredRecords = records.filter(({ client, packages }) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [client.nombre, client.email, client.puerto, String(client.numero_cliente)].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const matchesStatus = statusFilter === "ALL" || packages.some((pkg) => stageFor(pkg.estado) === statusFilter);
    const total = packages.reduce((sum, pkg) => sum + Number((facturas.find((invoice) => invoice.id === pkg.id)?.total) || 0), 0);
    const paid = packages.reduce((sum, pkg) => sum + ((facturas.find((invoice) => invoice.id === pkg.id)?.invoice_status || "").toLowerCase() === "paid" ? Number(facturas.find((invoice) => invoice.id === pkg.id)?.total || 0) : 0), 0);
    const balance = Math.max(0, total - paid);
    const matchesBalance = balanceFilter === "ALL" || (balanceFilter === "OUTSTANDING" && balance > 0) || (balanceFilter === "PAID" && balance === 0 && total > 0);
    const latest = Math.max(...packages.map((pkg) => new Date(pkg.hora_fecha || pkg.registro || 0).getTime()).filter((value) => Number.isFinite(value)), 0);
    const matchesDate = dateFilter === "ALL" || (dateFilter === "30" && latest >= now - 30 * 86400000) || (dateFilter === "90" && latest >= now - 90 * 86400000);
    return matchesSearch && matchesStatus && matchesBalance && matchesDate;
  });

  const selectedRecord = records.find((record) => record.client.id === selectedId) || null;
  const clientPackages = selectedRecord?.packages || [];
  const clientInvoices = selected ? facturas.filter((invoice) => invoice.clienteNumero === selected.numero_cliente || invoice.clienteNombre === selected.nombre) : [];
  const summary = {
    packages: clientPackages.length,
    active: clientPackages.filter((pkg) => !["Picked up", "Unloaded"].includes(stageFor(pkg.estado))).length,
    invoices: clientInvoices.length,
    invoiced: clientInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    paid: clientInvoices.filter((invoice) => (invoice.invoice_status || "").toLowerCase() === "paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
  };
  const outstanding = Math.max(0, summary.invoiced - summary.paid);

  const sendResetLink = async () => {
    if (!selected) return;
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/customer-reset", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify({ customer_id: selected.id }) });
    const body = await response.json();
    setMessage(response.ok ? "Password-reset link emailed to the customer." : (body.error || "Could not send reset link."));
  };

  const provisionPortal = async () => {
    if (!selected) return;
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/customer-provision", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify({ customer_id: selected.id }) });
    const body = await response.json();
    setMessage(response.ok ? `Portal access created. Initial password: ${body.initial_password}` : (body.error || "Could not provision portal access."));
  };

  if (!selected) return <section className="ga-client360">
    <div className="ga-client360-heading"><div><h2><Users size={22} /> Client 360</h2><p>Search by account number, email, customer name, or location.</p></div></div>
    <div className="ga-client360-toolbar"><label className="ga-client360-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, email, location, or number..." /></label><div className="ga-client360-filters"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{STAGE_LABELS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select><select value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value)}><option value="ALL">Any balance</option><option value="OUTSTANDING">Outstanding balance</option><option value="PAID">Paid</option></select><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="ALL">Any activity</option><option value="30">Activity in 30 days</option><option value="90">Activity in 90 days</option></select></div></div>
    {filteredRecords.length ? <div className="ga-client360-layout"><aside className="ga-client360-list"><div className="ga-client360-list-heading"><Users size={16} /> Clients ({filteredRecords.length})</div>{filteredRecords.map(({ client }) => <button type="button" key={client.id} className="ga-client360-list-item" onClick={() => setSelectedId(client.id)}><span className="ga-client360-avatar"><UserRound size={16} /></span><span><strong>{client.nombre}</strong><small>#{client.numero_cliente} · {client.puerto || "Location not recorded"}</small></span></button>)}</aside><div className="ga-client360-empty"><Users size={28} /><p>Select a customer to view the complete profile.</p></div></div> : <div className="ga-client360-empty"><Users size={28} /><p>No clients found.</p></div>}
  </section>;

  return <section className="ga-client360">
    <button type="button" className="pa-secondary-btn" onClick={() => setSelectedId("")} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", marginBottom: "1rem" }}><ArrowLeft size={15} /> All clients</button>
    <div className="ga-client360-profile"><div className="ga-client360-profile-icon"><UserRound size={28} /></div><div><h3>{selected.nombre} <span>#{selected.numero_cliente}</span></h3><p><MapPin size={14} /> {selected.puerto || "Location not recorded"}</p><p><Mail size={14} /> {selected.email || "No email"} · <Phone size={14} /> {selected.telefono || "No phone"}</p></div><div style={{ marginLeft: "auto", display: "flex", gap: ".45rem", flexWrap: "wrap" }}>{selected.auth_user_id ? <button type="button" className="pa-secondary-btn" onClick={() => void sendResetLink()}>Email password-reset link</button> : <button type="button" className="pa-secondary-btn" onClick={() => void provisionPortal()}>Create customer portal access</button>}</div></div>
    {message && <div className="c360-alert">{message}</div>}
    <div className="ga-client360-metrics"><div><small>Packages ever</small><strong>{summary.packages}</strong></div><div><small>Active now</small><strong>{summary.active}</strong></div><div><small>Invoices</small><strong>{summary.invoices}</strong></div><div><small>Invoiced</small><strong>${summary.invoiced.toFixed(2)}</strong></div><div><small>Paid</small><strong>${summary.paid.toFixed(2)}</strong></div><div className="ga-client360-metric-alert"><small>Outstanding</small><strong>${outstanding.toFixed(2)}</strong></div></div>
    <div className="ga-client360-card"><div className="ga-client360-card-header"><div><h3>Where their packages are</h3><p>Current shipment distribution by stage.</p></div><CalendarDays size={18} /></div><div className="ga-client360-statuses">{STAGE_LABELS.map((stage) => <span key={stage}><strong>{clientPackages.filter((pkg) => stageFor(pkg.estado) === stage).length}</strong> {stage}</span>)}</div></div>
    <div className="ga-client360-card"><div className="ga-client360-card-header"><div><h3>Package history</h3><p>Most recent first. Click a shipment to see details.</p></div><PackageOpen size={18} /></div><div className="ga-client360-table-wrap"><table className="ga-client360-table"><thead><tr><th>Recorded</th><th>Tracking</th><th>Status</th><th>Invoice</th></tr></thead><tbody>{clientPackages.slice(0, 30).map((pkg) => <tr key={pkg.id} onClick={() => setSelectedPackage(pkg)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedPackage(pkg); } }} tabIndex={0} role="button" title="Open shipment details" style={{ cursor: "pointer" }}><td>{safeDate(pkg.hora_fecha || pkg.registro)}</td><td><span style={{ color: "#2563eb", textDecoration: "underline", textUnderlineOffset: "2px", fontWeight: 700 }}>{pkg.tracking}</span></td><td><span className="ga-client360-status">{pkg.estado || "-"}</span>{pkg.problema && <AlertCircle size={14} color="#b91c1c" />}</td><td>{facturas.find((invoice) => invoice.id === pkg.id)?.total != null ? `$${Number(facturas.find((invoice) => invoice.id === pkg.id)?.total).toFixed(2)}` : "-"}</td></tr>)}</tbody></table></div></div>
    {selectedPackage && <div className="pa-modal-overlay" onClick={() => setSelectedPackage(null)}><div className="pa-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Shipment details"><div className="pa-modal-header"><h4 className="pa-modal-title">Shipment details</h4><button type="button" className="pa-close-btn" onClick={() => setSelectedPackage(null)} aria-label="Close">×</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem", padding: "1rem 0" }}><div><strong>Tracking</strong><div>{selectedPackage.tracking || "-"}</div></div><div><strong>Status</strong><div>{selectedPackage.estado || "-"}</div></div><div><strong>Carrier</strong><div>{selectedPackage.carrier || "-"}</div></div><div><strong>Package type</strong><div>{selectedPackage.tipo_paquete || "-"}</div></div><div><strong>Recorded</strong><div>{safeDate(selectedPackage.hora_fecha || selectedPackage.registro)}</div></div><div><strong>Delivered</strong><div>{safeDate(selectedPackage.fecha_entregado)}</div></div><div style={{ gridColumn: "1 / -1" }}><strong>Contents</strong><div>{selectedPackage.contenido || "-"}</div></div><div style={{ gridColumn: "1 / -1" }}><strong>Notes</strong><div>{selectedPackage.notas || "-"}</div></div>{selectedPackage.problema && <div style={{ gridColumn: "1 / -1", color: "#b91c1c" }}><strong>Problem</strong><div>{selectedPackage.problema_notas || "Reported problem"}</div></div>}</div><div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="pa-secondary-btn" onClick={() => setSelectedPackage(null)}>Close</button></div></div></div>}
  </section>;
}
