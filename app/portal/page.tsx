"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Box, CheckCircle2, FileText, KeyRound, LogOut, Printer, Ship, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatStaffDateTime } from "../../lib/staff-date-format";

type PortalShipment = {
  id: string;
  tracking: string | null;
  nombre_paqueteria: string | null;
  tipo_paquete: string | null;
  contenido?: string | null;
  estado: string | null;
  hora_fecha: string | null;
  fecha_entregado?: string | null;
  cubic_feet?: number | null;
  prepaid_review_required?: boolean | null;
  prepaid_review_status?: string | null;
};

type PortalData = {
  client: {
    nombre: string;
    numero_cliente: number;
    email: string;
    telefono: string | null;
    puerto: string | null;
    tipo_cuenta: string | null;
    prepaid_allowance_cubic_feet?: number | null;
    prepaid_used_cubic_feet?: number | null;
  };
  packages: PortalShipment[];
  invoices: any[];
  ferry: any[];
};

export default function CustomerPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    setReportDate(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const recoveryLink = hash.includes("type=recovery") || hash.includes("access_token=");
    if (recoveryLink) {
      setRecoveryMode(true);
      void supabase.auth.getSession().then(({ data: sessionData }) => {
        if (mounted && sessionData.session) setLoading(false);
      });
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setLoading(false);
      }
    });
    if (!recoveryLink) void load();
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function load() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { window.location.href = "/portal/login"; return; }
    setMustChangePassword(Boolean(session.session.user.user_metadata?.must_change_password));
    const response = await fetch("/api/customer-portal", { headers: { Authorization: `Bearer ${session.session.access_token}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Could not load your portal"); else setData(body);
    setLoading(false);
  }

  const changePassword = async () => {
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setChanging(true); setError(null); setMessage(null);
    const { error: changeError } = await supabase.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (changeError) setError(changeError.message);
    else {
      await supabase.auth.updateUser({ data: { must_change_password: false } });
      setMustChangePassword(false);
      setNewPassword("");
      setMessage("Your password was updated successfully.");
      if (recoveryMode) { setRecoveryMode(false); await load(); }
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  const counts = useMemo(() => {
    const isReadyForPickup = (item: PortalShipment) => String(item.estado || "").toLowerCase().includes("descargado");
    const isInTransit = (item: PortalShipment) => {
      const status = String(item.estado || "").toLowerCase();
      return status.includes("transito") || status.includes("tránsito") || status.includes("in transit");
    };
    return {
      inTransit: data?.packages.filter(isInTransit).length || 0,
      readyForPickup: data?.packages.filter(isReadyForPickup).length || 0,
    };
  }, [data]);
  const portalStatusLabel = (status: string | null | undefined) => String(status || "Pending").toLowerCase().includes("descargado") ? "Ready for pickup" : (status || "Pending");
  const isDeveloper = data?.client.tipo_cuenta === "Developer / Builder — Prepaid";
  const normalizedPort = String(data?.client.puerto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
  const isRoatan = normalizedPort === "roatan";
  const allowance = Number(data?.client.prepaid_allowance_cubic_feet || 0);
  const usedAllowance = Number(data?.client.prepaid_used_cubic_feet || 0);
  const remainingAllowance = Math.max(0, allowance - usedAllowance);
  const pendingPrepaidReviews = data?.packages.filter((item) => item.prepaid_review_required && item.prepaid_review_status !== "APPROVED").length || 0;

  if (loading) return <main className="portal-page portal-centered">Loading your customer portal…</main>;
  if (recoveryMode) return <main className="portal-page portal-centered"><section className="portal-card portal-first-login"><Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group" width={220} height={94} /><h1>Change your password</h1><p>Choose a new password for your Caribex customer portal.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" autoComplete="new-password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Save new password"}</button></div>{error && <small className="portal-error">{error}</small>}{message && <small className="portal-success">{message}</small>}</section></main>;
  if (error || !data) return <main className="portal-page portal-centered"><h1>Portal unavailable</h1><p>{error || "Please sign in again."}</p><Link href="/login" className="portal-button">Go to login</Link></main>;

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group" width={220} height={94} />
        <div><span>Customer portal</span>{!mustChangePassword && <button type="button" className="portal-print-button" onClick={() => window.print()}><Printer size={16} /> Download / Print PDF</button>}<button type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
      </header>

      {!mustChangePassword && <section className="portal-print-report" aria-label="Printable customer shipment history">
        <div className="portal-print-brand"><Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group" width={220} height={94} /><div><strong>Customer shipment history</strong><span>Report generated: {reportDate || "—"}</span></div></div>
        <div className="portal-print-account"><h1>{data.client.nombre}</h1><p>Caribex account #{data.client.numero_cliente} · {data.client.email}</p>{data.client.puerto && <p>Destination: {data.client.puerto}</p>}</div>
        {isDeveloper && <section className="portal-print-allowance"><h2>Developer / Builder prepaid account</h2><div><span>Allowance</span><strong>{allowance.toFixed(2)} ft³</strong><span>Used</span><strong>{usedAllowance.toFixed(2)} ft³</strong><span>Remaining</span><strong>{remainingAllowance.toFixed(2)} ft³</strong></div></section>}
        <h2>Shipment history</h2>
        {data.packages.length ? <table className="portal-print-table"><thead><tr><th>Tracking</th><th>Carrier</th><th>Type</th><th>Status</th><th>Received</th></tr></thead><tbody>{data.packages.map((item) => <tr key={item.id}><td>{item.tracking || "—"}</td><td>{item.nombre_paqueteria || "Carrier pending"}</td><td>{item.tipo_paquete || item.contenido || "Shipment"}</td><td>{portalStatusLabel(item.estado)}</td><td>{item.hora_fecha ? formatStaffDateTime(item.hora_fecha) : "—"}</td></tr>)}</tbody></table> : <p>No shipments found.</p>}
        <p className="portal-print-footnote">This report contains information for the authenticated customer account shown above.</p>
      </section>}

      <section className="portal-welcome"><div className="portal-avatar"><UserRound size={26} /></div><div><p>Welcome back</p><h1>{data.client.nombre}</h1><span>Caribex account #{data.client.numero_cliente} · {data.client.email}</span></div></section>

      {isDeveloper && <section className="portal-card" style={{ margin: "16px auto 0", width: "min(100%, 1120px)", borderColor: "#bfdbfe", background: "#eff6ff" }}><h2><Box size={18} /> Developer / Builder prepaid account</h2><p style={{ margin: ".35rem 0 0", color: "#475569", fontSize: ".84rem" }}>Your prepaid account allowance and usage are shown below.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: ".65rem", marginTop: "1rem" }}><div><small>Allowance</small><strong style={{ display: "block", fontSize: "1.25rem" }}>{allowance.toFixed(2)} ft³</strong></div><div><small>Used</small><strong style={{ display: "block", fontSize: "1.25rem" }}>{usedAllowance.toFixed(2)} ft³</strong></div><div><small>Remaining</small><strong style={{ display: "block", fontSize: "1.25rem", color: remainingAllowance > 0 ? "#166534" : "#92400e" }}>{remainingAllowance.toFixed(2)} ft³</strong></div><div><small>Pending shipment reviews</small><strong style={{ display: "block", fontSize: "1.25rem" }}>{pendingPrepaidReviews}</strong></div></div></section>}

      {mustChangePassword ? <section className="portal-card portal-first-login"><h2><KeyRound size={18} /> First-time sign-in</h2><p>For your security, change the temporary password <strong>Caribex{data.client.numero_cliente}</strong> before accessing your shipment history.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Create your new password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Set new password"}</button></div>{error && <small className="portal-error">{error}</small>}</section> : <>
        <div className="portal-stats"><div><Box size={20} /><strong>{data.packages.length}</strong><span>Total shipments</span></div><div><Ship size={20} /><strong>{counts.inTransit}</strong><span>In transit</span></div><div><CheckCircle2 size={20} /><strong>{counts.readyForPickup}</strong><span>Ready for pickup</span></div><div><FileText size={20} /><strong>{data.invoices.length}</strong><span>Invoices</span></div></div>
        <div className="portal-grid">
          <section className="portal-card"><h2>Shipment history</h2>{data.packages.length ? <div className="portal-list">{data.packages.map((item) => <div className="portal-row" key={item.id}><div><strong>{item.tracking}</strong><span>{item.nombre_paqueteria || "Carrier pending"} · {item.tipo_paquete || "Shipment"}</span>{item.hora_fecha ? <small>Received: {formatStaffDateTime(item.hora_fecha)}</small> : null}</div><span className="portal-status">{portalStatusLabel(item.estado)}</span></div>)}</div> : <p className="portal-muted">No shipments found.</p>}</section>
          <section className="portal-card"><h2><FileText size={18} /> Invoice history</h2>{data.invoices.length ? <div className="portal-list">{data.invoices.map((invoice) => <div className="portal-row portal-invoice-row" key={invoice.id}><div><strong>{invoice.tracking || "Shipment invoice"}</strong><span>Subtotal ${Number(invoice.billing_subtotal || 0).toFixed(2)} · Tax ${Number(invoice.billing_tax || 0).toFixed(2)}</span></div><div className="portal-invoice-total"><strong>${Number(invoice.billing_total || 0).toFixed(2)}</strong><span>{String(invoice.invoice_status || invoice.approval_status || "Pending").replaceAll("_", " ")}</span></div></div>)}</div> : <p className="portal-muted">No invoices available yet.</p>}</section>
          {!isRoatan && <section className="portal-card"><h2>Ferry bookings</h2>{data.ferry.length ? <div className="portal-list">{data.ferry.map((item) => <div className="portal-row" key={item.id}><div><strong>{item.numero_reserva || "Pending"}</strong><span>{item.puerto === "la_ceiba" ? "La Ceiba" : "Utila"} · Receiver: {item.nombre_receptor || "Not assigned"}</span></div></div>)}</div> : <p className="portal-muted">No ferry bookings found.</p>}</section>}
          <section className="portal-card portal-security"><h2><KeyRound size={18} /> Change password</h2><p>Keep your portal access secure by changing your password at any time.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Update password"}</button></div>{message && <small className="portal-success">{message}</small>}</section>
        </div>
      </>}
    </main>
  );
}
