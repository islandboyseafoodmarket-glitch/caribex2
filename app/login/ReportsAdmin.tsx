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
};

type ReportFilter = "container" | "received" | "checkin" | "pickup" | "customer";

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const normalize = (value: string | null | undefined) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: packages, error: packageError }, { data: links, error: linkError }, { data: customers, error: customerError }, { data: checkins, error: checkinError }] = await Promise.all([
        supabase.from("paquetes_registro").select("id, tracking, estado, creado_en, registro, numero_cliente_id, tipo_paquete, contenido").order("creado_en", { ascending: false }),
        supabase.from("contenedor_paquetes").select("paquete_id, contenedor_id"),
        supabase.from("numero_cliente").select("id, nombre, numero_cliente"),
        supabase.from("paquetes_checkin").select("paquete_id, alto, ancho, largo"),
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
    if (filter === "container") return !row.container_id;
    if (filter === "received") return status.includes("recibido") || status.includes("received");
    if (filter === "checkin") return status.includes("registro") || status.includes("check in") || status.includes("checkin");
    if (filter === "pickup") return !(status.includes("entregado") || status.includes("recogido") || status.includes("picked"));
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
    <style>{`.caribex-reports{background:#064a73;color:#fff;border-radius:12px;overflow:hidden}.caribex-reports-header{padding:22px 24px 18px}.caribex-reports h2{margin:0 0 14px;font-size:1.35rem}.caribex-report-code{display:inline-block;background:#fbbf24;color:#172554;border-radius:7px;padding:7px 14px;font-weight:800}.caribex-report-filters{display:flex;flex-wrap:wrap;gap:10px;padding:0 24px 18px}.caribex-report-filter{border:1px solid #bfdbfe;background:#e0f2fe;color:#1e293b;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease,transform .15s ease}.caribex-report-filter:hover{border-color:#fbbf24;background:#fef3c7}.caribex-report-filter.active{background:#fbbf24;color:#172554;border-color:#f59e0b;box-shadow:0 0 0 3px rgba(251,191,36,.22);transform:translateY(-1px)}.caribex-report-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 24px 20px}.caribex-report-controls label{display:flex;align-items:center;gap:6px}.caribex-report-controls select{min-height:38px;border:0;border-radius:7px;padding:0 12px;color:#334155}.caribex-report-counter{display:flex;align-items:center;gap:8px;background:#fff;color:#334155;border-radius:999px;padding:4px 8px;font-weight:700}.caribex-report-counter button{border:0;background:transparent;color:#0f4c81;cursor:pointer}.caribex-report-export{border:1px solid #93c5fd;border-radius:999px;background:transparent;color:#fff;padding:9px 15px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.caribex-report-table{background:#fff;color:#334155;overflow:auto}.caribex-report-table table{width:100%;min-width:760px;border-collapse:collapse}.caribex-report-table th,.caribex-report-table td{padding:11px 14px;border-bottom:1px solid #e2e8f0;text-align:left}.caribex-report-table th{font-size:.78rem}.caribex-report-month{background:#f1f5f9;color:#334155;font-weight:800}.caribex-report-empty{padding:30px;text-align:center;color:#64748b}`}</style>
    <div className="caribex-reports-header"><h2>Shipment Exception Reports <span style={{fontWeight:400}}>Never made it off a container</span></h2></div>
    <div className="caribex-report-filters">{filters.map(([value, label]) => <button type="button" key={value} className={`caribex-report-filter ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="caribex-report-controls"><label>From <input type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} /></label><label>To <input type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} /></label><span>Later containers that must have gone</span><span className="caribex-report-counter"><button type="button" onClick={() => setContainerCount((value) => Math.max(1, value - 1))}><Minus size={16} /></button>{containerCount} containers<button type="button" onClick={() => setContainerCount((value) => value + 1)}><Plus size={16} /></button></span><button type="button" className="caribex-report-export" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
    <div className="caribex-report-table">{grouped.length ? <table><thead><tr><th>Client Name</th><th>Account</th><th>Tracking Number</th><th>Item</th></tr></thead><tbody>{grouped.map(([month, monthRows]) => <><tr className="caribex-report-month" key={`${month}-heading`}><td colSpan={4}>{month === "Unknown date" ? month : monthLabel(month)}</td></tr>{monthRows.map((row) => <tr key={row.id}><td>{row.nombre || "—"}</td><td>{row.account || "—"}</td><td>{row.tracking || "—"}</td><td>{row.item}</td></tr>)}</>)}</tbody></table> : <div className="caribex-report-empty">No shipments match this report.</div>}</div>
  </section>;
}
