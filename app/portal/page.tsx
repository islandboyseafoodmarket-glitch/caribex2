"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Box, CheckCircle2, FileText, KeyRound, LogOut, Ship, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type PortalData = { client: { nombre: string; numero_cliente: number; email: string; telefono: string | null; puerto: string | null; tipo_cuenta: string | null }; packages: any[]; invoices: any[]; ferry: any[] };

export default function CustomerPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  useEffect(() => { void load(); }, []);
  async function load() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { window.location.href = "/login?next=/portal"; return; }
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
    if (changeError) setError(changeError.message); else { setNewPassword(""); setMessage("Your password was updated successfully."); }
  };
  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/"; };
  const counts = useMemo(() => ({ active: data?.packages.filter((item) => !["entregado", "delivered"].includes(String(item.estado || "").toLowerCase())).length || 0, delivered: data?.packages.filter((item) => ["entregado", "delivered"].includes(String(item.estado || "").toLowerCase())).length || 0 }), [data]);
  if (loading) return <main className="portal-page portal-centered">Loading your customer portal…</main>;
  if (error || !data) return <main className="portal-page portal-centered"><h1>Portal unavailable</h1><p>{error || "Please sign in again."}</p><Link href="/login" className="portal-button">Go to login</Link></main>;
  return <main className="portal-page"><header className="portal-header"><Image src="/imagenes/logo.png" alt="Caribex Logistics Group" width={150} height={45} /><div><span>Customer portal</span><button type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div></header><section className="portal-welcome"><div className="portal-avatar"><UserRound size={26} /></div><div><p>Welcome back</p><h1>{data.client.nombre}</h1><span>Caribex account #{data.client.numero_cliente} · {data.client.email}</span></div></section><div className="portal-stats"><div><Box size={20} /><strong>{data.packages.length}</strong><span>Total shipments</span></div><div><Ship size={20} /><strong>{counts.active}</strong><span>In progress</span></div><div><CheckCircle2 size={20} /><strong>{counts.delivered}</strong><span>Delivered</span></div><div><FileText size={20} /><strong>{data.invoices.length}</strong><span>Invoices</span></div></div><div className="portal-grid"><section className="portal-card"><h2>Shipment history</h2>{data.packages.length ? <div className="portal-list">{data.packages.map((item) => <div className="portal-row" key={item.id}><div><strong>{item.tracking}</strong><span>{item.nombre_paqueteria || "Carrier pending"} · {item.tipo_paquete || "Shipment"}</span></div><span className="portal-status">{item.estado || "Pending"}</span></div>)}</div> : <p className="portal-muted">No shipments found.</p>}</section><section className="portal-card"><h2>Ferry bookings</h2>{data.ferry.length ? <div className="portal-list">{data.ferry.map((item) => <div className="portal-row" key={item.id}><div><strong>{item.numero_reserva || "Pending"}</strong><span>{item.puerto === "la_ceiba" ? "La Ceiba" : "Utila"} · Receiver: {item.nombre_receptor || "Not assigned"}</span></div></div>)}</div> : <p className="portal-muted">No ferry bookings found.</p>}</section><section className="portal-card portal-security"><h2><KeyRound size={18} /> Change password</h2><p>Keep your portal access secure by changing your password at any time.</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? "Saving…" : "Update password"}</button></div>{message && <small className="portal-success">{message}</small>}</section></div></main>;
}
