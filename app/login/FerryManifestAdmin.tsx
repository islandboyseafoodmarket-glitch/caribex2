"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Clipboard, Copy, ExternalLink, MessageCircle, Plus, RefreshCw, Ship } from "lucide-react";
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
};
type AdminEntry = { id: string; puerto: string; numero_cuenta: string; nombre_cliente: string; numero_reserva: string | null; nombre_receptor: string | null; enviado_en: string | null };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default function FerryManifestAdmin() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [selectedContainer, setSelectedContainer] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [entryManifest, setEntryManifest] = useState<Manifest | null>(null);
  const [adminEntries, setAdminEntries] = useState<AdminEntry[]>([]);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, { booking: string }>>({});

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
        body: JSON.stringify({ contenedor_id: selectedContainer }),
      });
      setLastToken(body.manifest?.token || null);
      setSelectedContainer("");
      setNotice("Ferry manifest created successfully.");
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

  const shareWhatsApp = (token: string) => {
    const link = `${window.location.origin}/ferry-manifest/${token}`;
    const message = `Caribex Ferry Report — enter booking numbers here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const openManifest = (token: string) => {
    window.open(`/ferry-manifest/${token}`, "_blank", "noopener,noreferrer");
  };

  const openAdminEntryForm = async (manifest: Manifest) => {
    try {
      const body = await request(`/api/ferry-manifests/${manifest.token}`);
      const entries = body.entries || [];
      setEntryManifest(manifest);
      setAdminEntries(entries);
      setEntryDrafts(Object.fromEntries(entries.map((entry: AdminEntry) => [entry.id, { booking: entry.numero_reserva || "" }])));
    } catch (err: any) {
      setError(err.message || "Could not load manifest entries.");
    }
  };

  const saveAdminEntry = async (entry: AdminEntry) => {
    if (!entryManifest) return;
    const draft = entryDrafts[entry.id];
    if (!draft?.booking.trim()) return;
    try {
      await request(`/api/ferry-manifests/${entryManifest.token}`, { method: "PATCH", body: JSON.stringify({ entry_id: entry.id, numero_reserva: draft.booking.trim(), admin_edit: true, notify: true }) });
      setNotice(`Booking ${draft.booking.trim()} saved. The customer notification was sent when an email is available.`);
      await openAdminEntryForm(entryManifest);
      await load();
    } catch (err: any) {
      setError(err.message || "Could not save booking number.");
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
          <li>Unload each container package normally. La Ceiba and Utila packages are automatically added to the Ferry Report.</li>
          <li>When the mobile app gives the triple-beep ferry alert, set that package aside for the ferry.</li>
          <li>The customer invoice is billed and sent at unload using the normal invoice rules. The ferry booking notification is sent later.</li>
          <li>Open the active manifest and use <strong>Send by WhatsApp</strong> to share the private link with Joni.</li>
          <li>Joni enters each booking number, then presses <strong>Submit to Caribex</strong>. Blank rows can be completed later. The receiver/pickup signer is completed on the printed sheet.</li>
          <li>Use <strong>Print receiver sheet</strong> from the public link for the signed handover sheet.</li>
          <li>After each submitted booking, Caribex sends that customer a confirmation email with the booking number. No email is sent for a row marked <strong>NO</strong>.</li>
        </ol>
      </section>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1.25rem" }}>
        <label style={{ flex: "1 1 280px", color: "#475569", fontSize: "0.82rem", fontWeight: 600 }}>
          Create manifest from container
          <select
            value={selectedContainer}
            onChange={(event) => setSelectedContainer(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: "0.35rem", padding: "0.7rem 0.85rem", border: "1px solid #cbd5e1", borderRadius: "10px", background: "#fff" }}
          >
            <option value="">Select a container…</option>
            {containers.filter((container) => !manifests.some((manifest) => manifest.contenedor_id === container.id)).map((container) => (
              <option key={container.id} value={container.id}>{container.codigo || container.id}</option>
            ))}
          </select>
        </label>
        <button type="button" className="pa-primary-btn" disabled={!selectedContainer || saving} onClick={createManifest} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
          <Plus size={16} /> {saving ? "Creating…" : "Create manifest"}
        </button>
        <button type="button" className="pa-secondary-btn" onClick={() => void load()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {notice && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "0.8rem", background: "#ecfdf5", color: "#166534", borderRadius: "10px", fontSize: "0.85rem" }}>{notice}</div>}
      {error && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "0.8rem", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", fontSize: "0.85rem" }}>{error}</div>}
      {lastToken && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "1rem", background: "#eff6ff", color: "#1e40af", borderRadius: "10px", fontSize: "0.85rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}><Clipboard size={16} /> New ferry link is ready. <button type="button" onClick={() => void copyToken(lastToken)} style={{ border: 0, background: "transparent", color: "#1d4ed8", fontWeight: 700, cursor: "pointer", display: "inline-flex", gap: "0.3rem", alignItems: "center" }}><Copy size={14} /> Copy link</button><button type="button" onClick={() => shareWhatsApp(lastToken)} style={{ border: 0, background: "transparent", color: "#15803d", fontWeight: 700, cursor: "pointer", display: "inline-flex", gap: "0.3rem", alignItems: "center" }}><MessageCircle size={14} /> Send by WhatsApp</button></div>}

      {loading ? <p style={{ color: "#64748b" }}>Loading ferry manifests…</p> : manifests.length === 0 ? (
        <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: "14px" }}><Ship size={28} style={{ marginBottom: "0.5rem", color: "#2563eb" }} /><div>No ferry manifests yet.</div><small>Choose an existing container above to generate the first manifest.</small></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 0.8fr 1.5fr", gap: "0.75rem", minWidth: "760px", padding: "0.45rem 0", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: "0.78rem", fontWeight: 700 }}><span>Container</span><span>Week</span><span>Status</span><span>Entries</span><span style={{ textAlign: "right" }}>Actions</span></div>
          {manifests.map((manifest) => (
            <div key={manifest.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 0.8fr 1.5fr", gap: "0.75rem", minWidth: "760px", alignItems: "center", padding: "0.8rem 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.86rem" }}>
              <strong style={{ color: "#0f172a" }}>{containerById.get(manifest.contenedor_id) || manifest.contenedor_id}</strong>
              <span style={{ color: "#475569" }}>{dateLabel(manifest.semana_inicio)} – {dateLabel(manifest.semana_fin)}</span>
              <span style={{ display: "inline-flex", width: "fit-content", padding: "0.25rem 0.55rem", borderRadius: "999px", background: manifest.estado === "active" ? "#dcfce7" : "#f1f5f9", color: manifest.estado === "active" ? "#166534" : "#475569", fontSize: "0.75rem", fontWeight: 700 }}>{manifest.estado}</span>
              <span>{manifest.entry_count}</span>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                <button type="button" className="pa-primary-btn" onClick={() => void openAdminEntryForm(manifest)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", whiteSpace: "nowrap" }}>{manifest.estado === "active" ? "Enter bookings manually" : "Edit booking numbers"}</button>
                <button type="button" className="pa-secondary-btn" onClick={() => openManifest(manifest.token)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><ExternalLink size={14} /> Preview</button>
                <button type="button" className="pa-secondary-btn" onClick={() => void copyToken(manifest.token)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><Copy size={14} /> Copy link</button>
                <button type="button" className="pa-secondary-btn" onClick={() => shareWhatsApp(manifest.token)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "#15803d" }}><MessageCircle size={14} /> WhatsApp</button>
                {manifest.estado === "active" && <button type="button" onClick={() => void archiveManifest(manifest)} style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", borderRadius: "999px", padding: "0.45rem 0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><Archive size={14} /> Archive</button>}
              </div>
            </div>
          ))}
          {entryManifest && <section style={{ marginTop: "1.25rem", padding: "1rem", border: "1px solid #bfdbfe", borderRadius: "14px", background: "#f8fbff", minWidth: "760px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}><div><h3 style={{ margin: 0, color: "#0f3d68" }}>Enter booking numbers manually</h3><p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>Enter or correct the booking number for any ferry row. The receiver/pickup signer is completed on the printed receiver sheet.</p></div><button type="button" className="pa-secondary-btn" onClick={() => setEntryManifest(null)}>Close</button></div>
            {adminEntries.map((entry) => { const draft = entryDrafts[entry.id] || { booking: "" }; const accountColor = entry.puerto === "la_ceiba" ? "#2563eb" : entry.puerto === "utila" ? "#dc2626" : "#16a34a"; return <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr auto", gap: "0.5rem", alignItems: "center", padding: "0.6rem 0.5rem", borderTop: "1px solid #e2e8f0" }}><strong>{entry.nombre_cliente}</strong><strong style={{ color: accountColor }}>#{entry.numero_cuenta}</strong><input className="pa-input" value={draft.booking} placeholder="Booking # or NO" aria-label={`Booking number for ${entry.nombre_cliente}`} onChange={(event) => setEntryDrafts((current) => ({ ...current, [entry.id]: { booking: event.target.value } }))} /><button type="button" className="pa-primary-btn" disabled={!draft.booking.trim()} onClick={() => void saveAdminEntry(entry)}>Save</button></div>; })}
          </section>}
        </div>
      )}
    </div>
  );
}
