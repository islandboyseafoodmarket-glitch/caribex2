"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Archive, ChevronDown, ChevronUp, Clipboard, Copy, ExternalLink, LockKeyhole, MessageCircle, Plus, RefreshCw, Ship } from "lucide-react";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";

type Container = { id: string; codigo: string | null };
type Manifest = {
  id: string;
  contenedor_id: string;
  token: string;
  semana_inicio: string;
  semana_fin: string;
  estado: "active" | "completed" | "archived";
  creado_en: string;
  entry_count: number;
  ubicacion: string;
};
type AdminEntry = { id: string; puerto: string; numero_cuenta: string; nombre_cliente: string; numero_reserva: string | null; nombre_receptor: string | null; enviado_en: string | null };
type PendingPackage = { id: string; tracking: string; status: string; customer_name: string; customer_account: string | null };
const CARIBEX_WHATSAPP_NUMBER = "50489467476";
const FERRY_LOCATIONS = [
  { value: "la_ceiba_utila", label: "La Ceiba + Utila" },
  { value: "guanaja", label: "Guanaja" },
  { value: "san_pedro_sula", label: "San Pedro Sula" },
  { value: "tegucigalpa", label: "Tegucigalpa" },
] as const;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default function FerryManifestAdmin() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [selectedContainer, setSelectedContainer] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<(typeof FERRY_LOCATIONS)[number]["value"]>("la_ceiba_utila");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [entryManifest, setEntryManifest] = useState<Manifest | null>(null);
  const [adminEntries, setAdminEntries] = useState<AdminEntry[]>([]);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, { booking: string }>>({});
  const [manualEditModalOpen, setManualEditModalOpen] = useState(false);
  const [manualPassword, setManualPassword] = useState("");
  const [manualPasswordError, setManualPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [manualEditAccessToken, setManualEditAccessToken] = useState<string | null>(null);
  const [selectedEditManifestId, setSelectedEditManifestId] = useState("");
  const [expandedPendingManifestId, setExpandedPendingManifestId] = useState<string | null>(null);
  const [pendingPackagesByManifest, setPendingPackagesByManifest] = useState<Record<string, PendingPackage[]>>({});
  const [pendingLoadingManifestId, setPendingLoadingManifestId] = useState<string | null>(null);
  const [pendingErrors, setPendingErrors] = useState<Record<string, string>>({});

  const containerById = useMemo(() => new Map(containers.map((item) => [item.id, item.codigo || item.id])), [containers]);

  const request = useCallback(async (input: RequestInfo, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The request could not be completed.");
    return body;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await request("/api/ferry-manifests");
      setContainers(body.containers || []);
      setManifests(body.manifests || []);
    } catch (err: any) {
      setError(err.message || "Could not load ferry manifests.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const createManifest = async () => {
    if (!selectedContainer) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = await request("/api/ferry-manifests", {
        method: "POST",
        body: JSON.stringify({ contenedor_id: selectedContainer, ubicacion: selectedLocation }),
      });
      setLastToken(body.manifest?.token || null);
      setSelectedContainer("");
      setNotice(`${FERRY_LOCATIONS.find((item) => item.value === selectedLocation)?.label || "Ferry"} manifest created successfully.`);
      await load();
    } catch (err: any) {
      setError(err.message || "Could not create the ferry manifest.");
    } finally {
      setSaving(false);
    }
  };

  const archiveManifest = async (manifest: Manifest) => {
    if (!window.confirm("Archive this ferry manifest? It will become read-only.")) return;
    setError(null);
    try {
      await request("/api/ferry-manifests", { method: "PATCH", body: JSON.stringify({ id: manifest.id }) });
      setNotice("Ferry manifest archived.");
      await load();
    } catch (err: any) {
      setError(err.message || "Could not archive the ferry manifest.");
    }
  };

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/ferry-manifest/${token}`);
    setNotice("Manifest link copied to clipboard.");
  };

  const manifestLink = (token: string) => `${window.location.origin}/ferry-manifest/${token}`;

  const whatsappUrl = (token: string) => {
    const link = manifestLink(token);
    const message = `Caribex Ferry Report — enter booking numbers here: ${link}`;
    return `https://api.whatsapp.com/send?phone=${CARIBEX_WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
  };

  const openManifest = (token: string) => {
    window.open(`/ferry-manifest/${token}`, "_blank", "noopener,noreferrer");
  };

  const openAdminEntryForm = async (manifest: Manifest): Promise<boolean> => {
    try {
      const body = await request(`/api/ferry-manifests/${manifest.token}`);
      const entries = body.entries || [];
      setEntryManifest(manifest);
      setAdminEntries(entries);
      setEntryDrafts(Object.fromEntries(entries.map((entry: AdminEntry) => [entry.id, { booking: entry.numero_reserva || "" }])));
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.message || "Could not load manifest entries.");
      return false;
    }
  };

  const startManualEdit = () => {
    setManualEditAccessToken(null);
    setManualPassword("");
    setManualPasswordError(null);
    setSelectedEditManifestId(manifests[0]?.id || "");
    setManualEditModalOpen(true);
  };

  const verifyManualEditPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVerifyingPassword(true);
    setManualPasswordError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser?.id || !currentUser.email) throw new Error("Could not identify the signed-in account. Please sign in again.");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) throw new Error("Password verification is unavailable. Please contact an administrator.");

      const verificationClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
      const { data, error: authError } = await verificationClient.auth.signInWithPassword({ email: currentUser.email, password: manualPassword });
      if (authError || !data.user || !data.session?.access_token || data.user.id !== currentUser.id) {
        throw new Error("The password could not be verified. Check it and try again.");
      }
      setManualEditAccessToken(data.session.access_token);
      setManualPassword("");
      setSelectedEditManifestId(manifests[0]?.id || "");
    } catch (err: any) {
      setManualPasswordError(err.message || "The password could not be verified. Try again.");
    } finally {
      setVerifyingPassword(false);
    }
  };

  const openSelectedManifestForEdit = async () => {
    if (!manualEditAccessToken) return;
    const manifest = manifests.find((item) => item.id === selectedEditManifestId);
    if (!manifest) return;
    if (await openAdminEntryForm(manifest)) setManualEditModalOpen(false);
  };

  const closeManualEditModal = () => {
    setManualEditModalOpen(false);
    setManualPassword("");
    setManualPasswordError(null);
    setManualEditAccessToken(null);
  };

  const closeAdminEntryForm = () => {
    setEntryManifest(null);
    setAdminEntries([]);
    setEntryDrafts({});
    setManualEditAccessToken(null);
  };

  const saveAdminEntry = async (entry: AdminEntry) => {
    if (!entryManifest) return;
    if (!manualEditAccessToken) {
      setManualPasswordError("Please confirm your password again to edit booking numbers.");
      setManualEditModalOpen(true);
      return;
    }
    const draft = entryDrafts[entry.id];
    if (!draft?.booking.trim()) return;
    try {
      await request(`/api/ferry-manifests/${entryManifest.token}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${manualEditAccessToken}` },
        body: JSON.stringify({ entry_id: entry.id, numero_reserva: draft.booking.trim(), admin_edit: true, notify: true }),
      });
      setNotice(`Booking ${draft.booking.trim()} saved. The customer notification was sent when an email is available.`);
      await openAdminEntryForm(entryManifest);
      await load();
    } catch (err: any) {
      setError(err.message || "Could not save booking number.");
      if (String(err.message || "").toLowerCase().includes("password confirmation")) {
        setManualEditAccessToken(null);
        setManualPasswordError("Password confirmation expired. Enter your password again to continue.");
        setManualEditModalOpen(true);
      }
    }
  };

  const togglePendingPackages = async (manifest: Manifest) => {
    if (expandedPendingManifestId === manifest.id) {
      setExpandedPendingManifestId(null);
      return;
    }
    setExpandedPendingManifestId(manifest.id);
    setPendingLoadingManifestId(manifest.id);
    setPendingErrors((current) => ({ ...current, [manifest.id]: "" }));
    try {
      const body = await request(`/api/ferry-manifests?container_id=${encodeURIComponent(manifest.contenedor_id)}`);
      setPendingPackagesByManifest((current) => ({ ...current, [manifest.id]: body.pending_packages || [] }));
    } catch (err: any) {
      setPendingErrors((current) => ({ ...current, [manifest.id]: err.message || "Could not load packages." }));
    } finally {
      setPendingLoadingManifestId(null);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem", padding: "0.75rem 1rem", borderRadius: "14px", background: "#ffffff", border: "1px solid #dbeafe", boxShadow: "0 6px 16px rgba(15, 23, 42, 0.06)" }}>
        <Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group — Your Cargo Our Commitment" width={220} height={94} style={{ width: "220px", height: "auto", maxWidth: "100%" }} />
        <div>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.25rem" }}>Ferry manifests</h2>
          <p style={{ margin: "0.3rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>Create, manage, and share shipment manifests.</p>
        </div>
      </div>
      <section aria-labelledby="ferry-workflow-instructions" style={{ marginBottom: "1.25rem", padding: "1rem 1.1rem", borderRadius: "14px", background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0f3d68" }}>
        <h3 id="ferry-workflow-instructions" style={{ margin: 0, fontSize: "1rem" }}>Ferry workflow instructions</h3>
        <ol style={{ margin: "0.65rem 0 0", paddingLeft: "1.25rem", lineHeight: 1.55, fontSize: "0.84rem" }}>
          <li>Unload each container package normally, then choose La Ceiba + Utila, Guanaja, San Pedro Sula, or Tegucigalpa when creating the report.</li>
          <li>Use <strong>Packages not yet unloaded</strong> on a container row to view its registered packages still awaiting unload.</li>
          <li>When the mobile app gives the triple-beep ferry alert, set that package aside for the ferry.</li>
          <li>The customer invoice is billed and sent at unload using the normal invoice rules. The ferry booking notification is sent later.</li>
          <li>Open the active manifest and use <strong>Send by WhatsApp</strong> to share the private link with Joni.</li>
          <li>Joni enters each booking number, then presses <strong>Submit to Caribex</strong>. Blank rows can be completed later. The receiver/pickup signer is completed on the printed sheet.</li>
          <li>Use <strong>Print receiver sheet</strong> from the public link for the signed handover sheet.</li>
          <li>After each submitted booking, Caribex sends that customer a confirmation email with the booking number. No email is sent for a row marked <strong>NO</strong>.</li>
        </ol>
      </section>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1.25rem" }}>
        <label style={{ flex: "1 1 240px", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}>
          Ferry location
          <select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value as (typeof FERRY_LOCATIONS)[number]["value"])} style={{ display: "block", width: "100%", marginTop: "0.35rem", padding: "0.7rem 0.85rem", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }}>
            {FERRY_LOCATIONS.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}
          </select>
        </label>
        <label style={{ flex: "1 1 280px", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}>
          Create manifest from container
          <select
            value={selectedContainer}
            onChange={(event) => setSelectedContainer(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: "0.35rem", padding: "0.7rem 0.85rem", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }}
          >
            <option value="">Select a container…</option>
            {containers.filter((container) => !manifests.some((manifest) => manifest.contenedor_id === container.id && manifest.ubicacion === selectedLocation)).map((container) => (
              <option key={container.id} value={container.id}>{container.codigo || container.id}</option>
            ))}
          </select>
        </label>
        <button type="button" className="pa-primary-btn" disabled={!selectedContainer || saving} onClick={() => void createManifest()} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
          <Plus size={16} /> {saving ? "Creating…" : "Create manifest"}
        </button>
        <button type="button" className="pa-secondary-btn" disabled={!manifests.length || Boolean(entryManifest)} onClick={startManualEdit} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
          <LockKeyhole size={15} /> Type numbers on myself
        </button>
        <button type="button" className="pa-secondary-btn" onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {notice && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "0.8rem", background: "#ecfdf5", color: "#166534", borderRadius: "10px", fontSize: "0.85rem" }}>{notice}</div>}
      {error && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "0.8rem", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", fontSize: "0.85rem" }}>{error}</div>}
      {lastToken && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "1rem", background: "#eff6ff", color: "#1e40af", borderRadius: "10px", fontSize: "0.85rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}><Clipboard size={16} /> New ferry link is ready. <button type="button" onClick={() => void copyToken(lastToken)} style={{ border: 0, background: "transparent", color: "#1d4ed8", fontWeight: 700, cursor: "pointer", display: "inline-flex", gap: "0.3rem", alignItems: "center" }}><Copy size={14} /> Copy link</button><a href={whatsappUrl(lastToken)} target="_blank" rel="noopener noreferrer" style={{ border: 0, background: "transparent", color: "#15803d", fontWeight: 700, cursor: "pointer", display: "inline-flex", gap: "0.3rem", alignItems: "center", textDecoration: "none" }}><MessageCircle size={14} /> Send by WhatsApp</a></div>}

      {loading ? <p style={{ color: "#64748b" }}>Loading ferry manifests…</p> : manifests.length === 0 ? (
        <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: "14px" }}><Ship size={28} style={{ marginBottom: "0.5rem", color: "#2563eb" }} /><div>No ferry manifests yet.</div><small>Choose an existing container above to generate the first manifest.</small></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 0.8fr 1.5fr", gap: "0.75rem", minWidth: "760px", padding: "0.45rem 0", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.78rem", fontWeight: 700 }}><span>Container</span><span>Week</span><span>Status</span><span>Entries</span><span style={{ textAlign: "right" }}>Actions</span></div>
          {manifests.map((manifest) => (
            <div key={manifest.id}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 0.8fr 1.5fr", gap: "0.75rem", minWidth: "760px", alignItems: "center", padding: "0.8rem 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.86rem" }}>
                <strong style={{ color: "#0f172a" }}>{containerById.get(manifest.contenedor_id) || manifest.contenedor_id}<small style={{ display: "block", marginTop: "0.2rem", color: "#64748b", fontWeight: 500 }}>{FERRY_LOCATIONS.find((location) => location.value === manifest.ubicacion)?.label || "Existing combined report"}</small></strong>
                <span style={{ color: "#475569" }}>{dateLabel(manifest.semana_inicio)} – {dateLabel(manifest.semana_fin)}</span>
                <span style={{ display: "inline-flex", width: "fit-content", padding: "0.25rem 0.55rem", borderRadius: "999px", background: manifest.estado === "active" ? "#dcfce7" : "#f1f5f9", color: manifest.estado === "active" ? "#166534" : "#475569", fontSize: "0.75rem", fontWeight: 700 }}>{manifest.estado}</span>
                <span>{manifest.entry_count}</span>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", flexWrap: "wrap" }}>
                  <button type="button" className="pa-secondary-btn" onClick={() => openManifest(manifest.token)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><ExternalLink size={14} /> Preview</button>
                  <button type="button" className="pa-secondary-btn" onClick={() => void copyToken(manifest.token)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><Copy size={14} /> Copy link</button>
                  <details className="ferry-actions-menu">
                    <summary className="pa-secondary-btn">Actions</summary>
                    <div className="ferry-actions-menu-panel">
                      <button type="button" className="pa-secondary-btn" onClick={() => void togglePendingPackages(manifest)} aria-expanded={expandedPendingManifestId === manifest.id}>{expandedPendingManifestId === manifest.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Packages not yet unloaded</button>
                      <a className="pa-secondary-btn" href={whatsappUrl(manifest.token)} target="_blank" rel="noopener noreferrer" style={{ color: "#15803d", textDecoration: "none" }}><MessageCircle size={14} /> WhatsApp</a>
                      {manifest.estado === "active" && <button type="button" className="pa-secondary-btn ferry-admin-danger" onClick={() => void archiveManifest(manifest)}><Archive size={14} /> Archive</button>}
                    </div>
                  </details>
                </div>
              </div>
              {expandedPendingManifestId === manifest.id && <section aria-label={`Packages not yet unloaded in ${containerById.get(manifest.contenedor_id) || "this container"}`} style={{ minWidth: "760px", padding: "0.85rem 1rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 0.6rem", color: "#0f3d68", fontSize: "0.9rem" }}>Packages registered to this container and still awaiting unload</h4>
                {pendingLoadingManifestId === manifest.id ? <p style={{ margin: 0, color: "#64748b" }}>Loading packages…</p> : pendingErrors[manifest.id] ? <p style={{ margin: 0, color: "#b91c1c" }}>{pendingErrors[manifest.id]}</p> : (pendingPackagesByManifest[manifest.id] || []).length === 0 ? <p style={{ margin: 0, color: "#64748b" }}>No packages are currently waiting to be unloaded from this container.</p> : <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 0.8fr 1fr", gap: "0.5rem", color: "#475569", fontSize: "0.8rem" }}>
                  <strong>Tracking</strong><strong>Customer</strong><strong>Account</strong><strong>Status</strong>
                  {(pendingPackagesByManifest[manifest.id] || []).map((item) => <div key={item.id} style={{ display: "contents" }}><span>{item.tracking}</span><span>{item.customer_name}</span><span>{item.customer_account || "—"}</span><span>{item.status}</span></div>)}
                </div>}
              </section>}
            </div>
          ))}
          {entryManifest && <section style={{ marginTop: "1.25rem", padding: "1rem", border: "1px solid #bfdbfe", borderRadius: "14px", background: "#f8fbff", minWidth: "760px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}><div><h3 style={{ margin: 0, color: "#0f3d68" }}>Enter booking numbers manually</h3><p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>Enter or correct the booking number for any ferry row. The receiver/pickup signer is completed on the printed receiver sheet.</p></div><button type="button" className="pa-secondary-btn" onClick={closeAdminEntryForm}>Close</button></div>
            {adminEntries.length === 0 ? <p style={{ color: "#64748b" }}>This manifest has no unloaded packages yet. Packages are added as they are scanned unloaded.</p> : adminEntries.map((entry) => {
              const draft = entryDrafts[entry.id] || { booking: "" };
              const accountColor = entry.puerto === "la_ceiba" ? "#2563eb" : entry.puerto === "utila" ? "#dc2626" : entry.puerto === "guanaja" ? "#16a34a" : entry.puerto === "san_pedro_sula" ? "#d97706" : "#7c3aed";
              return <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr auto", gap: "0.5rem", alignItems: "center", padding: "0.6rem 0.5rem", borderTop: "1px solid #e2e8f0" }}><strong>{entry.nombre_cliente}</strong><strong style={{ color: accountColor }}>#{entry.numero_cuenta}</strong><input className="pa-input" value={draft.booking} placeholder="Booking # or NO" aria-label={`Booking number for ${entry.nombre_cliente}`} onChange={(event) => setEntryDrafts((current) => ({ ...current, [entry.id]: { booking: event.target.value } }))} /><button type="button" className="pa-primary-btn" disabled={!draft.booking.trim()} onClick={() => void saveAdminEntry(entry)}>Save</button></div>;
            })}
          </section>}
        </div>
      )}

      {manualEditModalOpen && <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: "1rem", background: "rgba(15, 23, 42, 0.55)" }}>
        <section role="dialog" aria-modal="true" aria-labelledby="manual-ferry-edit-title" style={{ width: "min(100%, 480px)", padding: "1.25rem", borderRadius: "16px", background: "#fff", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)" }}>
          <h3 id="manual-ferry-edit-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 0.55rem", color: "#0f3d68" }}><LockKeyhole size={18} /> Type numbers on myself</h3>
          {!manualEditAccessToken ? <form onSubmit={(event) => void verifyManualEditPassword(event)}>
            <p style={{ margin: "0 0 0.85rem", color: "#475569", fontSize: "0.88rem" }}>Confirm your account password before entering or changing booking numbers.</p>
            <label style={{ display: "block", marginBottom: "0.8rem", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}>Password
              <input className="pa-input" type="password" value={manualPassword} onChange={(event) => setManualPassword(event.target.value)} autoComplete="current-password" required style={{ display: "block", width: "100%", marginTop: "0.35rem" }} />
            </label>
            {manualPasswordError && <p role="alert" style={{ margin: "0 0 0.8rem", color: "#b91c1c", fontSize: "0.82rem" }}>{manualPasswordError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}><button type="button" className="pa-secondary-btn" onClick={closeManualEditModal}>Cancel</button><button type="submit" className="pa-primary-btn" disabled={verifyingPassword || !manualPassword}>{verifyingPassword ? "Verifying…" : "Verify password"}</button></div>
          </form> : <div>
            <p style={{ margin: "0 0 0.85rem", color: "#475569", fontSize: "0.88rem" }}>Choose the ferry manifest whose booking numbers you want to enter or edit.</p>
            <label style={{ display: "block", marginBottom: "0.9rem", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}>Manifest
              <select value={selectedEditManifestId} onChange={(event) => setSelectedEditManifestId(event.target.value)} style={{ display: "block", width: "100%", marginTop: "0.35rem", padding: "0.7rem 0.85rem", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }}>
                <option value="">Select a manifest…</option>
                {manifests.map((manifest) => <option key={manifest.id} value={manifest.id}>{containerById.get(manifest.contenedor_id) || manifest.contenedor_id} · {dateLabel(manifest.semana_inicio)} · {manifest.estado}</option>)}
              </select>
            </label>
            <p style={{ margin: "0 0 0.9rem", color: "#64748b", fontSize: "0.78rem" }}>Password confirmation remains valid for up to 10 minutes.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}><button type="button" className="pa-secondary-btn" onClick={closeManualEditModal}>Cancel</button><button type="button" className="pa-primary-btn" disabled={!selectedEditManifestId} onClick={() => void openSelectedManifestForEdit()}>Open manifest</button></div>
          </div>}
        </section>
      </div>}
    </div>
  );
}
