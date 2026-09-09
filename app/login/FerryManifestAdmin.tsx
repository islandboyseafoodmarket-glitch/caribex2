"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Clipboard, Copy, Plus, RefreshCw, Ship } from "lucide-react";
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

  return (
    <div style={{ width: "100%" }}>
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
      {lastToken && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "1rem", background: "#eff6ff", color: "#1e40af", borderRadius: "10px", fontSize: "0.85rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}><Clipboard size={16} /> New ferry link is ready. <button type="button" onClick={() => void copyToken(lastToken)} style={{ border: 0, background: "transparent", color: "#1d4ed8", fontWeight: 700, cursor: "pointer", display: "inline-flex", gap: "0.3rem", alignItems: "center" }}><Copy size={14} /> Copy link</button></div>}

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
                <button type="button" className="pa-secondary-btn" onClick={() => void copyToken(manifest.token)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><Copy size={14} /> Link</button>
                {manifest.estado === "active" && <button type="button" onClick={() => void archiveManifest(manifest)} style={{ border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", borderRadius: "999px", padding: "0.45rem 0.75rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}><Archive size={14} /> Archive</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
