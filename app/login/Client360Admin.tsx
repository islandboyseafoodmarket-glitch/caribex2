"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Box, CheckCircle2, FileText, Mail, MapPin, Phone, Search, Ship, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type Cliente = { id: string; nombre: string; numero_cliente: number; email: string | null; telefono: string | null; puerto: string | null; tipo_cuenta: string | null; creado_en: string | null };
type Pedido = { id: string; tracking: string; clienteNumero: number | null; clienteNombre: string | null; estado: string | null; carrier?: string | null; tipo_paquete?: string | null; contenido?: string | null; notas?: string | null; numero_cliente_id?: string | null; fecha_entregado?: string | null; problema?: boolean | null; problema_notas?: string | null };
type Factura = { id: string; tracking: string; clienteNumero: number | null; clienteNombre: string | null; carrier: string | null; tipo_paquete: string | null; subtotal: number | null; tax: number | null; total: number | null; approval_status: string | null; invoice_status: string | null; notas: string | null };
type FerryEntry = { id: string; manifiesto_id: string; puerto: string; numero_reserva: string | null; nombre_receptor: string | null; enviado_en: string | null };

export default function Client360Admin({ clientes, pedidos, facturas }: { clientes: Cliente[]; pedidos: Pedido[]; facturas: Factura[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [ferryEntries, setFerryEntries] = useState<FerryEntry[]>([]);
  const [ferryLoading, setFerryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingLoginHelp, setPendingLoginHelp] = useState(0);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const selected = clientes.find((client) => client.id === selectedId) || null;
  const filteredClients = clientes.filter((client) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return String(client.numero_cliente).includes(term) || client.email?.toLowerCase().includes(term) || client.nombre.toLowerCase().includes(term);
  });
  const clientPackages = useMemo(() => selected ? pedidos.filter((item) => item.numero_cliente_id === selected.id || item.clienteNumero === selected.numero_cliente) : [], [pedidos, selected]);
  const clientInvoices = useMemo(() => selected ? facturas.filter((item) => item.clienteNumero === selected.numero_cliente) : [], [facturas, selected]);
  const incidents = clientPackages.filter((item) => item.problema || item.estado?.toLowerCase().includes("problema") || item.problema_notas);

  const sendResetLink = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/customer-reset", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session?.access_token || ""}` }, body: JSON.stringify({ customer_id: selected?.id }) });
    const body = await response.json();
    setResetMessage(response.ok ? "Password-reset link emailed to the customer." : (body.error || "Could not send reset link."));
  };

  useEffect(() => {
    let cancelled = false;
    async function loadFerry() {
      if (!selected) { setFerryEntries([]); return; }
      setFerryLoading(true);
      const { data } = await supabase.from("ferry_manifest_entries").select("id, manifiesto_id, puerto, numero_reserva, nombre_receptor, enviado_en").eq("numero_cliente_id", selected.id).order("enviado_en", { ascending: false });
      if (!cancelled) { setFerryEntries((data as FerryEntry[]) || []); setFerryLoading(false); }
    }
    void loadFerry();
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    void supabase.from("customer_password_reset_requests").select("id", { count: "exact", head: true }).eq("status", "requested").then(({ count }) => setPendingLoginHelp(count || 0));
  }, []);

  if (!selected) return <div>
    <div style={{ maxWidth: 700, margin: "0 auto 1.5rem", textAlign: "center" }}><UserRound size={34} color="#2563eb" /><h2 style={{ margin: ".5rem 0 .3rem" }}>Client 360</h2><p style={{ margin: 0, color: "#64748b" }}>Search by account number, email, or customer name to open the complete operational history.</p></div>
    {pendingLoginHelp > 0 && <div className="c360-alert"><AlertCircle size={17} /> {pendingLoginHelp} customer login request{pendingLoginHelp === 1 ? "" : "s"} need admin follow-up.</div>}
    <label className="c360-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search account number, email, or customer name" /></label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: ".75rem" }}>{filteredClients.map((client) => <button key={client.id} type="button" onClick={() => setSelectedId(client.id)} style={{ textAlign: "left", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "14px", background: "#fff", cursor: "pointer", boxShadow: "0 3px 10px rgba(15,23,42,.04)" }}><strong style={{ display: "block", color: "#0f172a" }}>{client.nombre}</strong><span style={{ display: "block", marginTop: ".3rem", color: "#2563eb", fontSize: ".8rem" }}>#{client.numero_cliente}</span><span style={{ display: "block", marginTop: ".35rem", color: "#475569", fontSize: ".8rem" }}>Location: {client.puerto || "Not recorded"}</span><span style={{ display: "block", marginTop: ".35rem", color: "#64748b", fontSize: ".8rem" }}>{client.email || "No email recorded"}</span></button>)}</div>
  </div>;

  const money = (value: number | null) => value == null ? "—" : `$${Number(value).toFixed(2)}`;
  return <div>
    <button type="button" className="pa-secondary-btn" onClick={() => setSelectedId("")} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", marginBottom: "1rem" }}><ArrowLeft size={15} /> All clients</button>
    <section className="c360-profile"><div className="c360-avatar"><UserRound size={25} /></div><div style={{ flex: 1 }}><p className="c360-eyebrow">Client 360 profile</p><h2>{selected.nombre}</h2><span>Client #{selected.numero_cliente} · {selected.tipo_cuenta || "Personal"}</span></div><div className="c360-contact"><span><Mail size={15} /> {selected.email || "No email"}</span><span><Phone size={15} /> {selected.telefono || "No phone"}</span><span><MapPin size={15} /> {selected.puerto || "No port"}</span><button type="button" className="pa-secondary-btn" onClick={() => void sendResetLink()}>Email password-reset link</button></div></section>
    {resetMessage && <div className="c360-alert">{resetMessage}</div>}
    <div className="c360-metrics"><div><Box size={18} /><strong>{clientPackages.length}</strong><span>Packages</span></div><div><FileText size={18} /><strong>{clientInvoices.length}</strong><span>Invoices</span></div><div><AlertCircle size={18} /><strong>{incidents.length}</strong><span>Incidents</span></div><div><Ship size={18} /><strong>{ferryEntries.length}</strong><span>Ferry bookings</span></div></div>
    <div className="c360-grid">
      <section className="c360-card"><h3><Box size={18} /> Shipment history</h3>{clientPackages.length ? <div className="c360-list">{clientPackages.map((item) => <div className="c360-row" key={item.id}><div><strong>{item.tracking}</strong><span>{item.carrier || "Carrier not recorded"} · {item.tipo_paquete || "Package"}</span></div><div className="c360-row-right"><span className="c360-status">{item.estado || "Unknown"}</span>{item.problema && <AlertCircle size={16} color="#b91c1c" />}</div></div>)}</div> : <p className="c360-muted">No packages recorded.</p>}</section>
      <section className="c360-card"><h3><Ship size={18} /> Ferry bookings</h3>{ferryLoading ? <p className="c360-muted">Loading ferry bookings…</p> : ferryEntries.length ? <div className="c360-list">{ferryEntries.map((item) => <div className="c360-row" key={item.id}><div><strong>{item.numero_reserva || "Pending"}</strong><span>{item.puerto === "la_ceiba" ? "La Ceiba" : "Utila"} · Receiver: {item.nombre_receptor || "Not entered"}</span></div>{item.enviado_en && <CheckCircle2 size={17} color="#166534" />}</div>)}</div> : <p className="c360-muted">No ferry booking recorded.</p>}</section>
      <section className="c360-card"><h3><FileText size={18} /> Billing and invoices</h3>{clientInvoices.length ? <div className="c360-list">{clientInvoices.map((item) => <div className="c360-row" key={item.id}><div><strong>{item.tracking}</strong><span>{item.invoice_status || "Pending"} · {item.approval_status || "Pending approval"}</span></div><strong>{money(item.total)}</strong></div>)}</div> : <p className="c360-muted">No invoices recorded.</p>}</section>
      <section className="c360-card"><h3><AlertCircle size={18} /> Incidents and notes</h3>{incidents.length ? <div className="c360-list">{incidents.map((item) => <div className="c360-row" key={item.id}><div><strong>{item.tracking}</strong><span>{item.problema_notas || item.notas || item.estado || "Incident reported"}</span></div></div>)}</div> : <p className="c360-muted">No incidents reported.</p>}</section>
    </div>
  </div>;
}
