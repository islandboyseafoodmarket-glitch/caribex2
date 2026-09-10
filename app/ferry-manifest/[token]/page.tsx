"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Send, Ship, XCircle } from "lucide-react";

type Entry = {
  id: string;
  puerto: "la_ceiba" | "utila";
  numero_cuenta: string;
  nombre_cliente: string;
  etiqueta_cantidad: string;
  numero_reserva: string | null;
  nombre_receptor: string | null;
  enviado_en: string | null;
};
type ManifestData = {
  manifest: { semana_inicio: string; semana_fin: string; estado: string; container_codigo: string | null };
  entries: Entry[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default function FerryManifestPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ManifestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { booking: string; receiver: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ferry-manifests/${params.token}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Manifest not found");
      setData(body);
      setDrafts(Object.fromEntries((body.entries || []).map((entry: Entry) => [entry.id, { booking: entry.numero_reserva || "", receiver: entry.nombre_receptor || "" }])));
    } catch (err: any) {
      setError(err.message || "Could not load this manifest");
    } finally {
      setLoading(false);
    }
  }, [params.token]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => ({
    la_ceiba: data?.entries.filter((entry) => entry.puerto === "la_ceiba") || [],
    utila: data?.entries.filter((entry) => entry.puerto === "utila") || [],
  }), [data]);

  const updateDraft = (id: string, field: "booking" | "receiver", value: string) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || { booking: "", receiver: "" }), [field]: value } }));
  };

  const submitEntry = async (entry: Entry) => {
    const draft = drafts[entry.id] || { booking: "", receiver: "" };
    if (!draft.booking.trim()) return;
    setSaving(entry.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/ferry-manifests/${params.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entry.id, numero_reserva: draft.booking, nombre_receptor: draft.receiver }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not submit booking");
      setNotice(`Booking submitted for ${entry.nombre_cliente}.`);
      await load();
    } catch (err: any) {
      setError(err.message || "Could not submit booking");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <main className="ferry-page ferry-centered"><Loader2 className="ferry-spin" size={32} /><p>Loading ferry manifest…</p></main>;
  if (error || !data) return <main className="ferry-page ferry-centered"><XCircle size={40} color="#b91c1c" /><h1>Manifest unavailable</h1><p>{error || "This manifest could not be found."}</p></main>;

  const readOnly = data.manifest.estado !== "active";
  const renderSection = (port: "la_ceiba" | "utila", title: string) => (
    <section className="ferry-section" key={port}>
      <div className="ferry-section-heading"><h2>{title}</h2><span>{grouped[port].length} shipment{grouped[port].length === 1 ? "" : "s"}</span></div>
      {grouped[port].length === 0 ? <p className="ferry-muted">No shipments listed for this port.</p> : grouped[port].map((entry) => {
        const draft = drafts[entry.id] || { booking: "", receiver: "" };
        const submitted = Boolean(entry.enviado_en || entry.numero_reserva);
        return <article className="ferry-entry" key={entry.id}>
          <div className="ferry-entry-info"><strong>{entry.nombre_cliente}</strong><span>Account #{entry.numero_cuenta} · {entry.etiqueta_cantidad}</span></div>
          <div className="ferry-entry-form">
            <label>Booking number<input value={draft.booking} disabled={readOnly} placeholder="Enter booking number" onChange={(event) => updateDraft(entry.id, "booking", event.target.value)} /></label>
            <label>Pickup signer / receiver<input value={draft.receiver} disabled={readOnly} placeholder="Customer picking up" onChange={(event) => updateDraft(entry.id, "receiver", event.target.value)} /></label>
            <button type="button" className="ferry-submit" disabled={readOnly || saving === entry.id || !draft.booking.trim()} onClick={() => void submitEntry(entry)}>{saving === entry.id ? <Loader2 className="ferry-spin" size={16} /> : submitted ? <CheckCircle2 size={16} /> : <Send size={16} />}{submitted ? "Update" : "Submit"}</button>
          </div>
        </article>;
      })}
    </section>
  );

  return <main className="ferry-page">
    <header className="ferry-header"><div className="ferry-brand"><Image src="/imagenes/logo.png" alt="Caribex Logistics Group" width={150} height={45} /><span>Ferry manifest</span></div><div className="ferry-status">{readOnly ? "Read-only" : "Active"}</div></header>
    <div className="ferry-hero"><div className="ferry-icon"><Ship size={25} /></div><div><p className="ferry-eyebrow">Ferry operations</p><h1>Weekly shipment manifest</h1><p>Review the shipments and submit the booking number for each package.</p></div></div>
    <div className="ferry-meta"><span><ClipboardList size={16} /> Week: {dateLabel(data.manifest.semana_inicio)} – {dateLabel(data.manifest.semana_fin)}</span><span>Container: <strong>{data.manifest.container_codigo || "—"}</strong></span></div>
    {notice && <div className="ferry-notice"><CheckCircle2 size={18} />{notice}</div>}
    {renderSection("la_ceiba", "La Ceiba")}
    {renderSection("utila", "Utila")}
    <footer className="ferry-footer">Caribex Logistics Group · Please submit a booking number for every shipment before dispatch.</footer>
  </main>;
}
