"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
type Draft = { booking: string; receiver: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default function FerryManifestPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<ManifestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ferry-manifests/${params.token}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Manifest not found");
      setData(body);
      setDrafts(Object.fromEntries((body.entries || []).map((entry: Entry) => [entry.id, {
        booking: entry.numero_reserva || "",
        receiver: entry.nombre_receptor || "",
      }])));
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

  const updateDraft = (id: string, field: keyof Draft, value: string) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || { booking: "", receiver: "" }), [field]: value } }));
  };

  const submitAll = async (event: FormEvent) => {
    event.preventDefault();
    if (!data || data.manifest.estado !== "active") return;
    const pending = data.entries.filter((entry) => !entry.enviado_en && drafts[entry.id]?.booking.trim());
    if (!pending.length) {
      setError("Enter at least one booking number before submitting.");
      return;
    }
    if (!window.confirm(`Submit ${pending.length} booking number${pending.length === 1 ? "" : "s"}? Submitted rows will be locked.`)) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const results = await Promise.all(pending.map(async (entry) => {
        const draft = drafts[entry.id];
        const response = await fetch(`/api/ferry-manifests/${params.token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entry_id: entry.id, numero_reserva: draft.booking, nombre_receptor: draft.receiver }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `Could not submit ${entry.nombre_cliente}`);
        return body;
      }));
      setNotice(`${results.length} booking${results.length === 1 ? "" : "s"} saved successfully. Submitted rows are now locked.`);
      await load();
    } catch (err: any) {
      setError(err.message || "Could not submit the ferry manifest");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="ferry-page ferry-centered"><Loader2 className="ferry-spin" size={32} /><p>Loading ferry manifest…</p></main>;
  if (error && !data) return <main className="ferry-page ferry-centered"><XCircle size={40} color="#b91c1c" /><h1>Manifest unavailable</h1><p>{error}</p></main>;
  if (!data) return null;

  const readOnly = data.manifest.estado !== "active";
  const submittedCount = data.entries.filter((entry) => Boolean(entry.enviado_en)).length;
  const renderSection = (port: "la_ceiba" | "utila", title: string) => {
    const entries = grouped[port];
    if (!entries.length) return null;
    return <section className="ferry-section" key={port}>
      <div className="ferry-section-heading"><h2>{title}</h2><span>{entries.length} shipment{entries.length === 1 ? "" : "s"}</span></div>
      <div className="ferry-table-wrap"><table className="ferry-table"><thead><tr><th>No.</th><th>Acct</th><th>Customer name</th><th>Quantity</th><th>Booking #</th><th>Receiver / pickup signer</th></tr></thead><tbody>
        {entries.map((entry, index) => {
          const locked = Boolean(entry.enviado_en) || readOnly;
          const draft = drafts[entry.id] || { booking: "", receiver: "" };
          return <tr className={locked ? "ferry-row-locked" : ""} key={entry.id}>
            <td>{index + 1}</td><td className="ferry-acct">{entry.numero_cuenta}</td><td><strong>{entry.nombre_cliente}</strong></td><td>{entry.etiqueta_cantidad}</td>
            <td>{locked ? <span className="ferry-booking-saved">{entry.numero_reserva || "—"} <CheckCircle2 size={15} /></span> : <input value={draft.booking} maxLength={100} placeholder="Booking #" onChange={(event) => updateDraft(entry.id, "booking", event.target.value)} />}</td>
            <td>{locked ? <span>{entry.nombre_receptor || "—"}</span> : <input value={draft.receiver} maxLength={255} placeholder="Customer picking up" onChange={(event) => updateDraft(entry.id, "receiver", event.target.value)} />}</td>
          </tr>;
        })}
      </tbody></table></div>
    </section>;
  };

  return <main className="ferry-page">
    <header className="ferry-header"><div className="ferry-brand"><Image src="/imagenes/logo.png" alt="Caribex Logistics Group" width={150} height={45} /><span>Ferry manifest</span></div><div className={`ferry-status ${readOnly ? "ferry-status-locked" : ""}`}>{readOnly ? "Read-only" : `${submittedCount} of ${data.entries.length} submitted`}</div></header>
    <div className="ferry-hero"><div className="ferry-icon"><Ship size={25} /></div><div><p className="ferry-eyebrow">Ferry operations</p><h1>Weekly shipment manifest</h1><p>Enter the booking number for each customer who has shipped. Blank rows remain open for the next ferry.</p></div></div>
    <div className="ferry-meta"><span><ClipboardList size={16} /> Week: {dateLabel(data.manifest.semana_inicio)} – {dateLabel(data.manifest.semana_fin)}</span><span>Container: <strong>{data.manifest.container_codigo || "—"}</strong></span></div>
    {error && <div className="ferry-error"><XCircle size={18} />{error}</div>}
    {notice && <div className="ferry-notice"><CheckCircle2 size={18} />{notice}</div>}
    <form onSubmit={submitAll}>
      {renderSection("la_ceiba", "La Ceiba")}
      {renderSection("utila", "Utila")}
      {!readOnly && <div className="ferry-actions"><p>Submitted rows turn grey and lock automatically. Blank rows can be completed later using this same link.</p><button type="submit" className="ferry-submit-all" disabled={submitting}>{submitting ? <Loader2 className="ferry-spin" size={18} /> : <Send size={18} />} {submitting ? "Saving…" : "Submit to Caribex"}</button></div>}
    </form>
    <footer className="ferry-footer">Caribex Logistics Group · The submitted list is visible to anyone with this manifest link.</footer>
  </main>;
}
