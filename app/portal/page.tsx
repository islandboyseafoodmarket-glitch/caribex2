"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Box, CheckCircle2, FileText, KeyRound, LogOut, Ship, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatStaffDateTime } from "../../lib/staff-date-format";

type PortalData = { client: { nombre: string; numero_cliente: number; email: string; telefono: string | null; puerto: string | null; tipo_cuenta: string | null; account_review_status?: string | null; account_reviewed_at?: string | null; account_review_notes?: string | null; prepaid_allowance_cubic_feet?: number | null; prepaid_used_cubic_feet?: number | null }; packages: any[]; invoices: any[]; ferry: any[] };

export default function CustomerPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  useEffect(() => {
    let mounted = true;
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
    if (changeError) setError(changeError.message); else { await supabase.auth.updateUser({ data: { must_change_password: false } }); setMustChangePassword(false); setNewPassword(""); setMessage("Your password was updated successfully."); if (recoveryMode) { setRecoveryMode(false); await load(); } }
  };
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  const counts = useMemo(() => {
    const isReadyForPickup = (item: any) => String(item.estado || "").toLowerCase().includes("descargado");
    const isInTransit = (item: any) => {
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
  const allowance = Number(data?.client.prepaid_allowance_cubic_feet || 0);
  const usedAllowance = Number(data?.client.prepaid_used_cubic_feet || 0);
  const remainingAllowance = Math.max(0, allowance - usedAllowance);
  const pendingPrepaidReviews = data?.packages.filter((item) => item.prepaid_review_required && item.prepaid_review_status !== "APPROVED").length || 0;
  const reviewStatusLabel = (status: string | null | undefined) => ({ PENDING_REVIEW: "Pending Admin review", APPROVED: allowance > 0 ? "Active prepaid account" : "Approved — allowance pending", ACTIVE: "Active prepaid account", MORE_INFORMATION_REQUIRED: "More information requested", REJECTED: "Application not approved", SUSPENDED: "Account suspended" } as Record<string, string>)[String(status || "").toUpperCase()] || (allowance > 0 ? "Active prepaid account" : "Pending Admin review");
  if (loading) return <main className="portal-page portal-centered">Loading your customer portal…</main>;
  if (recoveryMode) return <main className="portal-page portal-centered"><section className="portal-card portal-first-login"><Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group" width={220} height={94} /><h1>Change your password</h1><p>Choose a new password for your Caribex customer portal.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" autoComplete="new-password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Save new password"}</button></div>{error && <small className="portal-error">{error}</small>}{message && <small className="portal-success">{message}</small>}</section></main>;
  if (error || !data) return <main className="portal-page portal-centered"><h1>Portal unavailable</h1><p>{error || "Please sign in again."}</p><Link href="/login" className="portal-button">Go to login</Link></main>;
  return <main className="portal-page"><header className="portal-header"><Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group" width={220} height={94} /><div><span>Customer portal</span><button type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div></header><section className="portal-welcome"><div className="portal-avatar"><UserRound size={26} /></div><div><p>Welcome back</p><h1>{data.client.nombre}</h1><span>Caribex account #{data.client.numero_cliente} · {data.client.email}</span></div></section>{isDeveloper && <section className="portal-card" style={{ margin: "16px auto 0", width: "min(100%, 1120px)", borderColor: "#bfdbfe", background: "#eff6ff" }}><h2><Box size={18} /> Developer / Builder prepaid account</h2><div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}><div><strong style={{ color: "#1e3a8a" }}>{reviewStatusLabel(data.client.account_review_status)}</strong><p style={{ margin: ".35rem 0 0", color: "#475569", fontSize: ".84rem" }}>{data.client.account_review_notes || (data.client.account_review_status === "PENDING_REVIEW" ? "Your portal access is active. Prepaid shipment processing will become available after Caribex reviews your account and assigns your allowance." : "Your prepaid account information and allowance activity are shown below.")}</p></div><span className="portal-status" style={{ background: allowance > 0 ? "#dcfce7" : "#fef3c7", color: allowance > 0 ? "#166534" : "#92400e" }}>{String(data.client.account_review_status || "PENDING_REVIEW").replaceAll("_", " ")}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: ".65rem", marginTop: "1rem" }}><div><small>Allowance</small><strong style={{ display: "block", fontSize: "1.25rem" }}>{allowance.toFixed(2)} ft³</strong></div><div><small>Used</small><strong style={{ display: "block", fontSize: "1.25rem" }}>{usedAllowance.toFixed(2)} ft³</strong></div><div><small>Remaining</small><strong style={{ display: "block", fontSize: "1.25rem", color: remainingAllowance > 0 ? "#166534" : "#92400e" }}>{remainingAllowance.toFixed(2)} ft³</strong></div><div><small>Pending reviews</small><strong style={{ display: "block", fontSize: "1.25rem" }}>{pendingPrepaidReviews}</strong></div></div></section>}{mustChangePassword ? <section className="portal-card portal-first-login"><h2><KeyRound size={18} /> First-time sign-in</h2><p>For your security, change the temporary password <strong>Caribex{data.client.numero_cliente}</strong> before accessing your shipment history.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Create your new password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Set new password"}</button></div>{error && <small className="portal-error">{error}</small>}</section> : <><div className="portal-stats"><div><Box size={20} /><strong>{data.packages.length}</strong><span>Total shipments</span></div><div><Ship size={20} /><strong>{counts.inTransit}</strong><span>In transit</span></div><div><CheckCircle2 size={20} /><strong>{counts.readyForPickup}</strong><span>Ready for pickup</span></div><div><FileText size={20} /><strong>{data.invoices.length}</strong><span>Invoices</span></div></div><div className="portal-grid"><section className="portal-card"><h2>Shipment history</h2>{data.packages.length ? <div className="portal-list">{data.packages.map((item) => <div className="portal-row" key={item.id}><div><strong>{item.tracking}</strong><span>{item.nombre_paqueteria || "Carrier pending"} · {item.tipo_paquete || "Shipment"}</span>{item.hora_fecha ? <small>Received: {formatStaffDateTime(item.hora_fecha)}</small> : null}</div><span className="portal-status">{portalStatusLabel(item.estado)}</span></div>)}</div> : <p className="portal-muted">No shipments found.</p>}</section><section className="portal-card"><h2><FileText size={18} /> Invoice history</h2>{data.invoices.length ? <div className="portal-list">{data.invoices.map((invoice) => <div className="portal-row portal-invoice-row" key={invoice.id}><div><strong>{invoice.tracking || "Shipment invoice"}</strong><span>Subtotal ${Number(invoice.billing_subtotal || 0).toFixed(2)} · Tax ${Number(invoice.billing_tax || 0).toFixed(2)}</span></div><div className="portal-invoice-total"><strong>${Number(invoice.billing_total || 0).toFixed(2)}</strong><span>{String(invoice.invoice_status || invoice.approval_status || "Pending").replaceAll("_", " ")}</span></div></div>)}</div> : <p className="portal-muted">No invoices available yet.</p>}</section><section className="portal-card"><h2>Ferry bookings</h2>{data.ferry.length ? <div className="portal-list">{data.ferry.map((item) => <div className="portal-row" key={item.id}><div><strong>{item.numero_reserva || "Pending"}</strong><span>{item.puerto === "la_ceiba" ? "La Ceiba" : "Utila"} · Receiver: {item.nombre_receptor || "Not assigned"}</span></div></div>)}</div> : <p className="portal-muted">No ferry bookings found.</p>}</section><section className="portal-card portal-security"><h2><KeyRound size={18} /> Change password</h2><p>Keep your portal access secure by changing your password at any time.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Update password"}</button></div>{message && <small className="portal-success">{message}</small>}</section></div></>}</main>;
}
