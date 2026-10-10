"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Minus, Plus } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type ReportRow = {
  id: string;
  nombre: string;
  account: number | null;
  tracking: string;
  estado: string | null;
  item: string;
  creado_en: string | null;
  numero_cliente_id: string | null;
  container_id: string | null;
  parent_box_id: string | null;
};

type ReportFilter = "container" | "received" | "checkin" | "pickup" | "customer";

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const normalize = (value: string | null | undefined) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const isArchived = (status: string) => status.includes("archiv");
const isReceived = (status: string) => status === "recibido" || status === "received";
const isRegistered = (status: string) => status === "registrado" || status === "registered" || status === "check in" || status === "checkin";
const isUnloaded = (status: string) => status.includes("descargado") || status.includes("unloaded");
const isPickedUp = (status: string) => status.includes("entregado") || status.includes("recogido") || status.includes("picked");

export default function ReportsAdmin() {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [fromMonth, setFromMonth] = useState(`${today.getFullYear()}-06`);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [containerCount, setContainerCount] = useState(1);
  const [filter, setFilter] = useState<ReportFilter>("container");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ loading: boolean; error: string; shipment: any | null; checkins: any[]; logs: any[] } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: packages, error: packageError }, { data: links, error: linkError }, { data: customers, error: customerError }, { data: checkins, error: checkinError }] = await Promise.all([
        supabase.from("paquetes_registro").select("id, tracking, estado, creado_en, registro, numero_cliente_id, tipo_paquete, contenido").order("creado_en", { ascending: false }),
        supabase.from("contenedor_paquetes").select("paquete_id, contenedor_id"),
        supabase.from("numero_cliente").select("id, nombre, numero_cliente"),
        supabase.from("paquetes_checkin").select("paquete_id, alto, ancho, largo, parent_box_id, creado_en").order("creado_en", { ascending: false }),
      ]);
      if (packageError || linkError || customerError || checkinError) throw packageError || linkError || customerError || checkinError;
      const customerById = new Map((customers || []).map((customer: any) => [customer.id, customer]));
      const containerByPackage = new Map((links || []).map((link: any) => [link.paquete_id, link.contenedor_id]));
      const checkinByPackage = new Map((checkins || []).map((checkin: any) => [checkin.paquete_id, checkin]));
      const mapped = (packages || []).map((pkg: any) => ({
        id: pkg.id,
        nombre: customerById.get(pkg.numero_cliente_id)?.nombre || "",
        account: customerById.get(pkg.numero_cliente_id)?.numero_cliente ?? null,
        tracking: pkg.tracking || "",
        estado: pkg.estado || null,
        item: (() => {
          const checkin = checkinByPackage.get(pkg.id);
          const type = String(pkg.tipo_paquete || "").trim() || (checkin ? "Package" : "Item");
          const dimensions = checkin && [checkin.largo, checkin.ancho, checkin.alto].some((value: number | null) => value != null)
            ? ` ${checkin.largo || "—"}x${checkin.ancho || "—"}x${checkin.alto || "—"}`
            : "";
          return `${type}${dimensions}`;
        })(),
        creado_en: pkg.creado_en || pkg.registro || null,
        numero_cliente_id: pkg.numero_cliente_id || null,
        container_id: containerByPackage.get(pkg.id) || null,
        parent_box_id: checkinByPackage.get(pkg.id)?.parent_box_id || null,
      }));
      if (mounted) { setRows(mapped); setLoading(false); }
    })().catch((err) => { if (mounted) { setError(err.message || "Could not load reports"); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const date = row.creado_en ? new Date(row.creado_en) : null;
    const month = date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "";
    const inRange = (!fromMonth || month >= fromMonth) && (!toMonth || month <= toMonth);
    if (!inRange) return false;
    const status = normalize(row.estado);
    if (isArchived(status)) return false;
    if (filter === "container") return Boolean(row.container_id) && !isUnloaded(status) && !isPickedUp(status);
    if (filter === "received") return isReceived(status);
    if (filter === "checkin") return isRegistered(status);
    if (filter === "pickup") return isUnloaded(status) && !isPickedUp(status) && !row.parent_box_id;
    return !row.nombre.trim();
  }), [filter, fromMonth, rows, toMonth]);

  const grouped = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    for (const row of filteredRows) {
      const date = row.creado_en ? new Date(row.creado_en) : null;
      const key = date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "Unknown date";
      map.set(key, [...(map.get(key) || []), row]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredRows]);

  const exportCsv = () => {
    const header = ["Client Name", "Account", "Tracking Number", "Item"];
    const body = filteredRows.map((row) => [row.nombre, row.account ?? "", row.tracking, row.item]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `caribex-report-${filter}-${fromMonth}-${toMonth}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openTrackingDetail = async (row: ReportRow) => {
    setDetail({ loading: true, error: "", shipment: null, checkins: [], logs: [] });
    try {
      const [{ data: shipment, error: shipmentError }, { data: checkins, error: checkinError }, { data: logs, error: logsError }] = await Promise.all([
        supabase.from("paquetes_registro").select("*").eq("id", row.id).maybeSingle(),
        supabase.from("paquetes_checkin").select("*").eq("paquete_id", row.id).order("creado_en", { ascending: false }),
        supabase.from("staff_action_logs").select("id, actor_name, actor_email, actor_role, action, success, error_message, details, created_at").eq("entity_id", row.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (shipmentError || checkinError || logsError) throw shipmentError || checkinError || logsError;
      if (!shipment) throw new Error("Shipment details could not be found.");
      setDetail({ loading: false, error: "", shipment, checkins: checkins || [], logs: logs || [] });
    } catch (err: any) {
      setDetail({ loading: false, error: err?.message || "Could not load shipment details.", shipment: null, checkins: [], logs: [] });
    }
  };

  if (loading) return <div className="container-dashboard-state">Loading reports…</div>;
  if (error) return <div className="container-dashboard-state container-dashboard-error">{error}</div>;

  const filters: [ReportFilter, string][] = [
    ["container", "Never made it off a container"],
    ["received", "Never made it from Received"],
    ["checkin", "Never made it from Check In"],
    ["pickup", "Never picked up"],
    ["customer", "No customer name"],
  ];

  return <section className="caribex-reports">
    <style>{`.caribex-reports{background:#064a73;color:#fff;border-radius:12px;overflow:hidden}.caribex-reports-header{padding:22px 24px 18px}.caribex-reports h2{margin:0 0 14px;font-size:1.35rem}.caribex-report-code{display:inline-block;background:#fbbf24;color:#172554;border-radius:7px;padding:7px 14px;font-weight:800}.caribex-report-filters{display:flex;flex-wrap:wrap;gap:10px;padding:0 24px 18px}.caribex-report-filter{border:1px solid #bfdbfe;background:#e0f2fe;color:#1e293b;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease}.caribex-report-filter:hover{border-color:#fbbf24;background:#fef3c7}.caribex-report-filter.active{background:#fbbf24;color:#172554;border-color:#f59e0b;box-shadow:0 0 0 3px rgba(251,191,36,.22);transform:translateY(-1px)}.caribex-report-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 24px 20px}.caribex-report-controls label{display:flex;align-items:center;gap:6px}.caribex-report-controls select{min-height:38px;border:0;border-radius:7px;padding:0 12px;color:#334155}.caribex-report-counter{display:flex;align-items:center;gap:8px;background:#fff;color:#334155;border-radius:999px;padding:4px 8px;font-weight:700}.caribex-report-counter button{border:0;background:transparent;color:#0f4c81;cursor:pointer}.caribex-report-export{border:1px solid #93c5fd;border-radius:999px;background:transparent;color:#fff;padding:9px 15px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.caribex-report-table{background:#fff;color:#334155;overflow:auto}.caribex-report-table table{width:100%;min-width:760px;border-collapse:collapse}.caribex-report-table th,.caribex-report-table td{padding:11px 14px;border-bottom:1px solid #e2e8f0;text-align:left}.caribex-report-table th{font-size:.78rem}.caribex-report-month{background:#f1f5f9;color:#334155;font-weight:800}.caribex-report-empty{padding:30px;text-align:center;color:#64748b}.caribex-report-tracking{border:0;background:transparent;color:#075985;text-decoration:underline;font:inherit;font-weight:800;cursor:pointer;padding:0}.caribex-report-modal-backdrop{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.65)}.caribex-report-modal{width:min(900px,100%);max-height:92vh;overflow-y:auto;background:#fff;color:#334155;border-radius:16px;padding:22px;box-shadow:0 20px 60px rgba(15,23,42,.35)}.caribex-report-modal-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.caribex-report-modal-header h3{margin:0;color:#0f4c81}.caribex-report-close{border:0;border-radius:8px;padding:8px 11px;background:#e2e8f0;color:#0f172a;font-weight:800;cursor:pointer}.caribex-report-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.caribex-report-detail-card{border:1px solid #e2e8f0;border-radius:10px;padding:11px;background:#f8fafc}.caribex-report-detail-card strong{display:block;color:#0f4c81;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}.caribex-report-detail-section{margin-top:18px}.caribex-report-detail-section h4{margin:0 0 8px;color:#0f4c81}.caribex-report-photo-grid{display:flex;flex-wrap:wrap;gap:10px}.caribex-report-photo-grid img{width:150px;height:110px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1}.caribex-report-detail-table{width:100%;border-collapse:collapse;font-size:.82rem}.caribex-report-detail-table th,.caribex-report-detail-table td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}@media(max-width:620px){.caribex-report-detail-grid{grid-template-columns:1fr}.caribex-report-modal{padding:16px}}`}</style>
    <div className="caribex-reports-header"><h2>Shipment Exception Reports <span style={{fontWeight:400}}>Never made it off a container</span></h2></div>
    <div className="caribex-report-filters">{filters.map(([value, label]) => <button type="button" key={value} className={`caribex-report-filter ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="caribex-report-controls"><label>From <input type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} /></label><label>To <input type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} /></label><span>Later containers that must have gone</span><span className="caribex-report-counter"><button type="button" onClick={() => setContainerCount((value) => Math.max(1, value - 1))}><Minus size={16} /></button>{containerCount} containers<button type="button" onClick={() => setContainerCount((value) => value + 1)}><Plus size={16} /></button></span><button type="button" className="caribex-report-export" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
    <div className="caribex-report-table">{grouped.length ? <table><thead><tr><th>Client Name</th><th>Account</th><th>Tracking Number</th><th>Item</th></tr></thead><tbody>{grouped.map(([month, monthRows]) => <><tr className="caribex-report-month" key={`${month}-heading`}><td colSpan={4}>{month === "Unknown date" ? month : monthLabel(month)}</td></tr>{monthRows.map((row) => <tr key={row.id}><td>{row.nombre || "—"}</td><td>{row.account || "—"}</td><td><button type="button" className="caribex-report-tracking" onClick={() => void openTrackingDetail(row)} title={`View details for ${row.tracking}`}>{row.tracking || "—"}</button></td><td>{row.item}</td></tr>)}</>)}</tbody></table> : <div className="caribex-report-empty">No shipments match this report.</div>}</div>
    {detail && <div className="caribex-report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
      <section className="caribex-report-modal" role="dialog" aria-modal="true" aria-labelledby="report-tracking-detail-title">
        <div className="caribex-report-modal-header"><div><h3 id="report-tracking-detail-title">Shipment details</h3>{detail.shipment && <div>{detail.shipment.tracking || "—"} · {detail.shipment.tipo_paquete || "Shipment"}</div>}</div><button type="button" className="caribex-report-close" onClick={() => setDetail(null)}>Close</button></div>
        {detail.loading && <p>Loading shipment details…</p>}
        {detail.error && <p style={{ color: "#b91c1c", fontWeight: 700 }}>{detail.error}</p>}
        {!detail.loading && !detail.error && detail.shipment && <>
          <div className="caribex-report-detail-grid">
            <div className="caribex-report-detail-card"><strong>Customer</strong>{detail.shipment.numero_cliente_id || "Unknown owner"}</div>
            <div className="caribex-report-detail-card"><strong>Current status</strong>{detail.shipment.estado || "—"}</div>
            <div className="caribex-report-detail-card"><strong>Scanned in by</strong>{detail.shipment.registro || "Not recorded"}</div>
            <div className="caribex-report-detail-card"><strong>Carrier</strong>{detail.shipment.nombre_paqueteria || "—"}</div>
            <div className="caribex-report-detail-card"><strong>Received date</strong>{detail.shipment.hora_fecha || detail.shipment.creado_en || "—"}</div>
            <div className="caribex-report-detail-card"><strong>Check In records</strong>{detail.checkins.length}</div>
          </div>
          <div className="caribex-report-detail-section"><h4>Notes</h4><p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{detail.shipment.notas || "No notes recorded."}</p></div>
          <div className="caribex-report-detail-section"><h4>Photos</h4>{(Array.isArray(detail.shipment.notas_imagenes) ? detail.shipment.notas_imagenes : typeof detail.shipment.notas_imagenes === "string" ? [detail.shipment.notas_imagenes] : []).length ? <div className="caribex-report-photo-grid">{(Array.isArray(detail.shipment.notas_imagenes) ? detail.shipment.notas_imagenes : [detail.shipment.notas_imagenes]).filter(Boolean).map((url: string) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`Photo for ${detail.shipment.tracking || "shipment"}`} /></a>)}</div> : <p style={{ margin: 0 }}>No photos recorded.</p>}</div>
          <div className="caribex-report-detail-section"><h4>Staff activity for this shipment</h4>{detail.logs.length ? <table className="caribex-report-detail-table"><thead><tr><th>Date</th><th>Staff member</th><th>Action</th><th>Result</th></tr></thead><tbody>{detail.logs.map((log) => <tr key={log.id}><td>{log.created_at}</td><td>{log.actor_name || log.actor_email || "Unknown"}</td><td>{String(log.action || "").replaceAll("_", " ")}</td><td>{log.success ? "Success" : log.error_message || "Failed"}</td></tr>)}</tbody></table> : <p style={{ margin: 0 }}>No staff activity log is attached to this shipment.</p>}</div>
        </>}
      </section>
    </div>}
  </section>;
}
