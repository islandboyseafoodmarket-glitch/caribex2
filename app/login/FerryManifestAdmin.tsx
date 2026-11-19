"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Archive, ChevronDown, Copy, Download, ExternalLink, List, LockKeyhole, MessageCircle, Plus, RefreshCw, Ship } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { downloadFerryManifestExcel, FERRY_PORT_STYLES, formatFerryAccountNumber, type FerryManifestData, type FerryManifestEntry } from "../../lib/ferry-manifest-export";
import { FERRY_PORT_LABELS, FERRY_PORT_ORDER } from "../../lib/shipping-rules";

type Container = { id: string; codigo: string | null; creado_en?: string | null };
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
type AdminEntry = FerryManifestEntry;
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

function arrivalDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", year: "numeric" }).format(new Date(value));
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
  const [reportManifest, setReportManifest] = useState<Manifest | null>(null);
  const [reportData, setReportData] = useState<FerryManifestData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPackagesInContainer, setShowPackagesInContainer] = useState(false);
  const [pendingPackages, setPendingPackages] = useState<PendingPackage[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [entryManifest, setEntryManifest] = useState<Manifest | null>(null);
  const [adminEntries, setAdminEntries] = useState<AdminEntry[]>([]);
  const [entryDrafts, setEntryDrafts] = useState<Record<string, { booking: string }>>({});
  const [manualEditModalOpen, setManualEditModalOpen] = useState(false);
  const [manualPassword, setManualPassword] = useState("");
  const [manualPasswordError, setManualPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [manualEditAccessToken, setManualEditAccessToken] = useState<string | null>(null);
  const [selectedEditManifestId, setSelectedEditManifestId] = useState("");

  const containerById = useMemo(() => new Map(containers.map((item) => [item.id, item.codigo || item.id])), [containers]);
  const selectedManifest = useMemo(() => manifests.find((manifest) => manifest.contenedor_id === selectedContainer && manifest.ubicacion === selectedLocation) || null, [manifests, selectedContainer, selectedLocation]);
  const reportGroups = useMemo(() => FERRY_PORT_ORDER.map((port) => ({ port, entries: (reportData?.entries || []).filter((entry) => entry.puerto === port) })).filter((group) => group.entries.length > 0), [reportData]);

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
      const nextManifests = body.manifests || [];
      setManifests(nextManifests);
      setReportManifest((current) => current ? nextManifests.find((manifest: Manifest) => manifest.id === current.id) || current : null);
    } catch (err: any) {
      setError(err.message || "Could not load ferry manifests.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadManifestReport = useCallback(async (manifest: Manifest) => {
    setReportLoading(true);
    setError(null);
    try {
      const body = await request(`/api/ferry-manifests/${manifest.token}`);
      setReportManifest({ ...manifest, estado: body.manifest?.estado || manifest.estado });
      setReportData(body as FerryManifestData);
    } catch (err: any) {
      setReportManifest(null);
      setReportData(null);
      setError(err.message || "Could not load the ferry report.");
    } finally {
      setReportLoading(false);
    }
  }, [request]);

  const loadPendingPackages = useCallback(async (containerId: string) => {
    if (!containerId) return;
    setPendingLoading(true);
    setPendingError(null);
    try {
      const body = await request(`/api/ferry-manifests?container_id=${encodeURIComponent(containerId)}`);
      setPendingPackages(body.pending_packages || []);
    } catch (err: any) {
      setPendingPackages([]);
      setPendingError(err.message || "Could not load packages in this container.");
    } finally {
      setPendingLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const downloadReport = async () => {
    if (!reportData || exporting) return;
    setExporting(true);
    setError(null);
    try {
      await downloadFerryManifestExcel(reportData);
    } catch (err: any) {
      setError(err.message || "Could not export the ferry manifest.");
    } finally {
      setExporting(false);
    }
  };

  const refreshWorkspace = async () => {
    await load();
    if (reportManifest) await loadManifestReport(reportManifest);
    if (showPackagesInContainer && selectedContainer) await loadPendingPackages(selectedContainer);
  };

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
      const createdManifest = { ...body.manifest, entry_count: 0 } as Manifest;
      setNotice(`${FERRY_LOCATIONS.find((item) => item.value === selectedLocation)?.label || "Ferry"} manifest created successfully.`);
      await load();
      if (createdManifest?.token) await loadManifestReport(createdManifest);
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
      await loadManifestReport(entryManifest);
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

  return (
    <div className="ferry-manifest-admin">
      <header className="ferry-manifest-banner">
        <span className="ferry-manifest-brand-mark" aria-hidden="true"><Ship size={22} /></span>
        <div className="ferry-manifest-heading">
          <h2>Ferry manifests</h2>
          <p>Create, manage, and share shipment manifests.</p>
        </div>
      </header>

      <div className="ferry-manifest-email-note">Customer confirmation emails are sent after a booking number is submitted. Dispatches shows the same manifest entries after the scanner marks a shipment as dispatched; creating a manifest alone does not add a Dispatches row. No email is sent for a row marked <strong>NO</strong>.</div>
      <details className="ferry-manifest-instructions">
        <summary>Ferry workflow instructions</summary>
        <ol>
          <li>Unload each container package normally. Create a ferry manifest only after at least one unloaded shipment is assigned to the selected destination.</li>
          <li>Use the single <strong>Show packages in container</strong> checkbox beside the location selector to view packages that have not yet been officially unloaded.</li>
          <li>When the mobile app gives the triple-beep ferry alert, set that package aside for the ferry.</li>
          <li>The customer invoice is billed and sent at unload using the normal invoice rules. The ferry booking notification is sent later.</li>
          <li>Select the active manifest and choose <strong>WhatsApp</strong> from <strong>Actions</strong> to share its private link with the ferry contact.</li>
          <li>The ferry contact enters each booking number, then presses <strong>Submit to Caribex</strong>. Blank rows can be completed later. The receiver/pickup signer is completed on the printed sheet.</li>
          <li>Use <strong>Print receiver sheet</strong> from the public link for the signed handover sheet.</li>
          <li>After each submitted booking, Caribex sends that customer a confirmation email with the booking number.</li>
        </ol>
      </details>

      <div className="ferry-manifest-toolbar">
        <div className="ferry-manifest-location-switch" role="group" aria-label="Ferry location">
          <span className="ferry-manifest-step-label">1. Location</span>
          {FERRY_LOCATIONS.map((location) => <button
            key={location.value}
            type="button"
            className={`ferry-manifest-location-button${selectedLocation === location.value ? " is-active" : ""}`}
            aria-pressed={selectedLocation === location.value}
            onClick={() => {
              if (selectedLocation !== location.value) {
                setSelectedContainer("");
                setReportManifest(null);
                setReportData(null);
                setPendingPackages([]);
                setPendingError(null);
                setShowPackagesInContainer(false);
              }
              setSelectedLocation(location.value);
            }}
          >{location.label}</button>)}
        </div>
        <label className="ferry-manifest-show-packages">
          <input type="checkbox" checked={showPackagesInContainer} onChange={(event) => {
            const checked = event.target.checked;
            setShowPackagesInContainer(checked);
            if (checked && selectedContainer) void loadPendingPackages(selectedContainer);
            else {
              setPendingPackages([]);
              setPendingError(null);
              setPendingLoading(false);
            }
          }} />
          <span>Show packages in container</span>
        </label>
        <div className="ferry-manifest-tool-actions">
          <button type="button" className="pa-secondary-btn" disabled={!manifests.length || Boolean(entryManifest)} onClick={startManualEdit} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
            <LockKeyhole size={15} /> Type numbers on myself
          </button>
          <button type="button" className="pa-secondary-btn" onClick={() => void refreshWorkspace()} disabled={loading || reportLoading || pendingLoading} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minHeight: "42px" }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      <div className="ferry-manifest-create-row">
        <label className="ferry-manifest-container-field">
          <span>2. Container</span>
          <select
            value={selectedContainer}
            onChange={(event) => {
              const containerId = event.target.value;
              setSelectedContainer(containerId);
              setReportManifest(null);
              setReportData(null);
              setError(null);
              if (showPackagesInContainer && containerId) void loadPendingPackages(containerId);
              else {
                setPendingPackages([]);
                setPendingError(null);
              }
            }}
          >
            <option value="">Select a container…</option>
            {containers.map((container) => {
              const hasManifest = manifests.some((manifest) => manifest.contenedor_id === container.id && manifest.ubicacion === selectedLocation);
              const arrivalDate = container.creado_en ? arrivalDateLabel(container.creado_en) : null;
              return <option key={container.id} value={container.id}>{arrivalDate ? `${arrivalDate} · ` : ""}{container.codigo || container.id}{hasManifest ? " · manifest entered" : ""}</option>;
            })}
          </select>
        </label>
        {selectedManifest ? <button type="button" className="pa-secondary-btn ferry-manifest-show-list" disabled={reportLoading} onClick={() => void loadManifestReport(selectedManifest)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", minHeight: "42px" }}>
          <List size={16} /> 2. Show list
        </button> : <button type="button" className="pa-primary-btn" disabled={!selectedContainer || saving} onClick={() => void createManifest()} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", minHeight: "42px" }}>
          <Plus size={16} /> {saving ? "Creating…" : "Create manifest"}
        </button>}
      </div>
      <p className="ferry-manifest-create-hint">{selectedManifest ? "Select Show list to display this container’s entered ferry report." : "A manifest is created only when the selected container has at least one shipment assigned to that destination and already unloaded."}</p>

      {notice && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "0.8rem", background: "#ecfdf5", color: "#166534", borderRadius: "10px", fontSize: "0.85rem" }}>{notice}</div>}
      {error && <div style={{ padding: "0.7rem 0.85rem", marginBottom: "0.8rem", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", fontSize: "0.85rem" }}>{error}</div>}

      {loading && <p style={{ color: "#64748b" }}>Loading ferry manifests…</p>}

      {showPackagesInContainer && <section className="ferry-manifest-pending" aria-live="polite">
        <h4 style={{ margin: "0 0 0.6rem", color: "#0f3d68", fontSize: "0.9rem" }}>Packages in container awaiting official unload</h4>
        {!selectedContainer ? <p style={{ margin: 0, color: "#64748b" }}>Select a container to see packages that have not yet been officially unloaded.</p> : pendingLoading ? <p style={{ margin: 0, color: "#64748b" }}>Loading packages…</p> : pendingError ? <p style={{ margin: 0, color: "#b91c1c" }}>{pendingError}</p> : pendingPackages.length === 0 ? <p style={{ margin: 0, color: "#64748b" }}>No packages in this container are awaiting official unload.</p> : <div className="ferry-manifest-pending-list">
          <div className="ferry-manifest-pending-header"><strong>Tracking</strong><strong>Customer</strong><strong>Account</strong><strong>Status</strong></div>
          {pendingPackages.map((item) => <div key={item.id} className="ferry-manifest-pending-row"><span data-label="Tracking">{item.tracking}</span><span data-label="Customer">{item.customer_name}</span><span data-label="Account">{item.customer_account || "—"}</span><span data-label="Status">{item.status}</span></div>)}
        </div>}
      </section>}

      {!loading && !selectedManifest && !reportData && <div className="ferry-manifest-empty-state"><Ship size={28} /><p>{manifests.length ? "Select a container with an existing report or create a manifest for a new one." : "No ferry manifests yet. Select a container above to create the first manifest."}</p></div>}
      {reportLoading && <p role="status" className="ferry-manifest-report-loading">Loading ferry report…</p>}
      {reportData && reportManifest && <section className="ferry-manifest-report">
        <div className="ferry-manifest-report-heading">
          <div>
            <h3>Container arriving on {arrivalDateLabel(reportData.manifest.container_creado_en || reportManifest.semana_inicio)}</h3>
            <p>{FERRY_LOCATIONS.find((location) => location.value === reportManifest.ubicacion)?.label || "Ferry"} · {reportData.entries.length} customer rows · {reportData.manifest.estado}</p>
          </div>
          <div className="ferry-manifest-report-actions">
            <button type="button" className="ferry-admin-secondary ferry-manifest-action ferry-manifest-action--download" onClick={() => void downloadReport()} disabled={exporting}><Download size={14} /> {exporting ? "Downloading…" : "Download .xlsx"}</button>
            <button type="button" className="ferry-admin-secondary ferry-manifest-action ferry-manifest-action--copy" onClick={() => void copyToken(reportManifest.token)}><Copy size={14} /> Copy ferry link</button>
            <button type="button" className="ferry-admin-secondary ferry-manifest-action ferry-manifest-action--preview" onClick={() => openManifest(reportManifest.token)}><ExternalLink size={14} /> Preview</button>
            <details className="ferry-actions-menu ferry-manifest-action-menu">
              <summary className="ferry-admin-secondary ferry-manifest-action ferry-manifest-action--more">Actions <ChevronDown size={14} /></summary>
              <div className="ferry-actions-menu-panel">
                <a className="ferry-admin-secondary" href={whatsappUrl(reportManifest.token)} target="_blank" rel="noopener noreferrer" style={{ color: "#15803d", textDecoration: "none" }}><MessageCircle size={14} /> WhatsApp</a>
                {reportManifest.estado === "active" && <button type="button" className="ferry-admin-secondary ferry-admin-danger" onClick={() => void archiveManifest(reportManifest)}><Archive size={14} /> Archive</button>}
              </div>
            </details>
          </div>
        </div>
        {reportGroups.length === 0 ? <p className="ferry-manifest-report-empty">Nobody on this list yet. Customers appear as their boxes are unloaded.</p> : reportGroups.map(({ port, entries }) => <section key={port} className="ferry-manifest-report-group">
          <h4>{FERRY_PORT_LABELS[port].toUpperCase()} CUSTOMER ({entries.length})</h4>
          <div className="ferry-manifest-report-table-wrap"><table className="ferry-manifest-report-table">
            <thead><tr><th>No.</th><th>Acct</th><th>Customer Name</th><th>Quantity</th><th>Booking #</th></tr></thead>
            <tbody>{entries.map((entry, index) => <tr key={entry.id}>
              <td>{index + 1}</td>
              <td className={`ferry-manifest-report-account ferry-acct-${port}`} style={{ color: `#${FERRY_PORT_STYLES[port].color}` }}>{formatFerryAccountNumber(entry.numero_cuenta, port)}</td>
              <td><strong>{entry.nombre_cliente}</strong></td>
              <td>{entry.etiqueta_cantidad}</td>
              <td>{entry.numero_reserva || "—"}</td>
            </tr>)}</tbody>
          </table></div>
        </section>)}
      </section>}

      {entryManifest && <section className="ferry-manifest-manual">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}><div><h3 style={{ margin: 0, color: "#0f3d68" }}>Enter booking numbers manually</h3><p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>Enter or correct the booking number for any ferry row. The receiver/pickup signer is completed on the printed receiver sheet.</p></div><button type="button" className="pa-secondary-btn" onClick={closeAdminEntryForm}>Close</button></div>
        {adminEntries.length === 0 ? <p style={{ color: "#64748b" }}>This manifest has no unloaded packages yet. Packages are added as they are scanned unloaded.</p> : adminEntries.map((entry) => {
          const draft = entryDrafts[entry.id] || { booking: "" };
          const accountColor = `#${FERRY_PORT_STYLES[entry.puerto].color}`;
          return <div key={entry.id} className="ferry-manifest-manual-row"><strong>{entry.nombre_cliente}</strong><strong style={{ color: accountColor }}>{formatFerryAccountNumber(entry.numero_cuenta, entry.puerto)}</strong><input className="pa-input" value={draft.booking} placeholder="Booking # or NO" aria-label={`Booking number for ${entry.nombre_cliente}`} onChange={(event) => setEntryDrafts((current) => ({ ...current, [entry.id]: { booking: event.target.value } }))} /><button type="button" className="pa-primary-btn" disabled={!draft.booking.trim()} onClick={() => void saveAdminEntry(entry)}>Save</button></div>;
        })}
      </section>}

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
