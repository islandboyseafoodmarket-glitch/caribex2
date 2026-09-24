"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Shipment = {
  id: string;
  tracking: string | null;
  nombre_paqueteria: string | null;
  tipo_paquete: string | null;
  contenido: string | null;
  notas: string | null;
  creado_en: string | null;
  registro: string | null;
  estado: string | null;
  hora_fecha: string | null;
  descargado: string | null;
  fecha_descargado: string | null;
  hora_descargado: string | null;
  fecha_entregado: string | null;
  hora_entregado: string | null;
  customer: { numero_cliente: number; nombre: string; email: string | null; telefono: string | null; puerto: string | null; tipo_cuenta: string | null } | null;
  checkin: { alto: number | null; ancho: number | null; largo: number | null; peso: number | null; problema: boolean | null; problema_notas: string | null; consolidacion: boolean | null; parent_box_id: string | null } | null;
};

type Container = { id: string; codigo: string; descripcion: string | null; creado_en: string | null; shipments: Shipment[] };

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function ContainersAdmin() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { if (mounted) { setError("Your admin session has expired."); setLoading(false); } return; }
      const response = await fetch("/api/admin/containers", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load containers");
      if (mounted) {
        setContainers(payload.containers || []);
        setSelectedId(payload.containers?.[0]?.id || "");
        setLoading(false);
      }
    })().catch((err) => { if (mounted) { setError(err.message); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const selected = containers.find((container) => container.id === selectedId) || null;
  const visibleShipments = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!selected || !term) return selected?.shipments || [];
    return selected.shipments.filter((shipment) => [shipment.tracking, shipment.customer?.nombre, shipment.customer?.email, shipment.customer?.puerto, shipment.estado, shipment.nombre_paqueteria].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [filter, selected]);
  const locationSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const shipment of selected?.shipments || []) {
      const location = shipment.customer?.puerto || "Unassigned";
      counts.set(location, (counts.get(location) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [selected]);
  const totalShipments = containers.reduce((sum, container) => sum + container.shipments.length, 0);

  if (loading) return <div className="container-dashboard-state">Loading container dashboard…</div>;
  if (error) return <div className="container-dashboard-state container-dashboard-error">{error}</div>;

  return (
    <div className="container-dashboard">
      <style>{`
        .container-dashboard { display: grid; gap: 16px; }
        .container-dashboard-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
        .container-dashboard-toolbar select, .container-dashboard-toolbar input { min-height: 38px; border: 1px solid #cbd5e1; border-radius: 9px; padding: 0 11px; background: #fff; }
        .container-dashboard-toolbar select { min-width: 270px; }
        .container-dashboard-toolbar input { min-width: 230px; }
        .container-dashboard-button { border: 0; border-radius: 9px; padding: 10px 14px; background: #0f4c81; color: #fff; font-weight: 700; cursor: pointer; }
        .container-dashboard-button.secondary { background: #e2e8f0; color: #0f172a; }
        .container-dashboard-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .container-dashboard-metric { padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
        .container-dashboard-metric strong { display: block; color: #0f4c81; font-size: 1.35rem; }
        .container-dashboard-metric span { color: #64748b; font-size: .78rem; }
        .container-dashboard-locations { display: flex; flex-wrap: wrap; gap: 8px; }
        .container-location-chip { padding: 7px 10px; border-radius: 999px; background: #dbeafe; color: #1e3a8a; font-size: .8rem; font-weight: 700; }
        .container-dashboard-table { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
        .container-dashboard-table table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: .82rem; }
        .container-dashboard-table th, .container-dashboard-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        .container-dashboard-table th { background: #f8fafc; color: #475569; font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; }
        .container-dashboard-table tr:last-child td { border-bottom: 0; }
        .container-dashboard-state { padding: 32px; text-align: center; color: #64748b; }
        .container-dashboard-error { color: #b91c1c; background: #fef2f2; border-radius: 12px; }
        @media (max-width: 800px) { .container-dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media print { body * { visibility: hidden !important; } .container-dashboard, .container-dashboard * { visibility: visible !important; } .container-dashboard { position: static; } .container-dashboard-toolbar, .container-dashboard-metrics, .container-dashboard-locations, .container-dashboard-filter { display: none !important; } .container-dashboard-table { border: 0; } }
      `}</style>
      <div className="container-dashboard-toolbar">
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-label="Select container">
          <option value="">Select a container</option>
          {containers.map((container) => <option key={container.id} value={container.id}>{container.codigo} ({container.shipments.length} shipments)</option>)}
        </select>
        <input className="container-dashboard-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter tracking, customer, or location" />
        <button className="container-dashboard-button" type="button" onClick={() => window.print()} disabled={!selected}>Print / Save PDF manifest</button>
      </div>
      <div className="container-dashboard-metrics">
        <div className="container-dashboard-metric"><strong>{containers.length}</strong><span>Total containers</span></div>
        <div className="container-dashboard-metric"><strong>{totalShipments}</strong><span>Total linked shipments</span></div>
        <div className="container-dashboard-metric"><strong>{selected?.shipments.length || 0}</strong><span>Selected container shipments</span></div>
        <div className="container-dashboard-metric"><strong>{locationSummary.length}</strong><span>Locations in selected container</span></div>
      </div>
      {selected && <>
        <div><strong>{selected.codigo}</strong> <span style={{ color: "#64748b" }}>created {dateLabel(selected.creado_en)}</span></div>
        <div className="container-dashboard-locations">{locationSummary.map(([location, count]) => <span className="container-location-chip" key={location}>{location}: {count}</span>)}</div>
        <div className="container-dashboard-table">
          <table>
            <thead><tr><th>Tracking</th><th>Customer</th><th>Location</th><th>Carrier / type</th><th>Status</th><th>Recorded</th><th>Check-in / dimensions</th><th>Notes</th></tr></thead>
            <tbody>{visibleShipments.map((shipment) => <tr key={shipment.id}>
              <td><strong>{shipment.tracking || "—"}</strong></td>
              <td>{shipment.customer?.nombre || "—"}<br /><small>#{shipment.customer?.numero_cliente || "—"} · {shipment.customer?.email || "—"}</small></td>
              <td>{shipment.customer?.puerto || "Unassigned"}</td>
              <td>{shipment.nombre_paqueteria || "—"}<br /><small>{shipment.tipo_paquete || "—"}</small></td>
              <td>{shipment.estado || shipment.registro || "—"}</td>
              <td>{dateLabel(shipment.hora_fecha || shipment.creado_en)}</td>
              <td>{shipment.checkin ? `${shipment.checkin.largo || "—"} × ${shipment.checkin.ancho || "—"} × ${shipment.checkin.alto || "—"} · ${shipment.checkin.peso || "—"} lb` : "Not checked in"}</td>
              <td>{shipment.notas || shipment.contenido || "—"}{shipment.checkin?.problema ? <><br /><strong style={{ color: "#b91c1c" }}>Problem: {shipment.checkin.problema_notas || "Yes"}</strong></> : null}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
