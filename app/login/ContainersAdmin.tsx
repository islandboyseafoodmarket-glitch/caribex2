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
  billing_subtotal: number | null;
  billing_tax: number | null;
  billing_total: number | null;
  customer: { numero_cliente: number; nombre: string; email: string | null; telefono: string | null; puerto: string | null; tipo_cuenta: string | null } | null;
  checkin: { alto: number | null; ancho: number | null; largo: number | null; peso: number | null; problema: boolean | null; problema_notas: string | null; cargos_adicionales: string | null; consolidacion: boolean | null; parent_box_id: string | null } | null;
};

type Container = { id: string; codigo: string; descripcion: string | null; creado_en: string | null; shipments: Shipment[] };

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function money(value: number | null | undefined) {
  return value == null || Number.isNaN(Number(value)) ? "—" : `$${Number(value).toFixed(2)}`;
}

function additionalChargeTotal(value: string | null | undefined) {
  if (!value) return 0;
  return (value.match(/\$?\d+(?:\.\d{1,2})?/g) || []).reduce((sum, item) => sum + Number(item.replace("$", "")), 0);
}

export default function ContainersAdmin() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceGroup, setInvoiceGroup] = useState<Shipment[] | null>(null);

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
  const groupedShipments = useMemo(() => {
    const groups = new Map<string, Shipment[]>();
    for (const shipment of visibleShipments) {
      const key = `${shipment.customer?.numero_cliente || "unknown"}`;
      groups.set(key, [...(groups.get(key) || []), shipment]);
    }
    return Array.from(groups.values());
  }, [visibleShipments]);
  const invoiceTotals = useMemo(() => {
    const lines = invoiceGroup || [];
    return lines.reduce((totals, shipment) => {
      const additional = additionalChargeTotal(shipment.checkin?.cargos_adicionales);
      const subtotal = Number(shipment.billing_subtotal || 0);
      const tax = Number(shipment.billing_tax || 0);
      const total = Number(shipment.billing_total ?? (subtotal + tax));
      totals.subtotal += subtotal;
      totals.additional += additional;
      totals.tax += tax;
      totals.total += total + additional;
      return totals;
    }, { subtotal: 0, additional: 0, tax: 0, total: 0 });
  }, [invoiceGroup]);

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
        .container-dashboard-table table { width: 100%; min-width: 1320px; border-collapse: collapse; font-size: .82rem; }
        .container-dashboard-table th, .container-dashboard-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        .container-dashboard-table th { background: #f8fafc; color: #475569; font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; }
        .container-dashboard-table tr:last-child td { border-bottom: 0; }
        .container-customer-button { border: 0; padding: 0; background: transparent; color: #0f4c81; font: inherit; font-weight: 800; text-align: left; text-decoration: underline; cursor: pointer; }
        .container-dashboard-state { padding: 32px; text-align: center; color: #64748b; }
        .container-dashboard-error { color: #b91c1c; background: #fef2f2; border-radius: 12px; }
        .container-invoice-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 18px; background: rgba(15, 23, 42, .58); }
        .container-invoice-modal { width: min(900px, 100%); max-height: 92vh; overflow: auto; border-radius: 16px; background: #fff; padding: 22px; box-shadow: 0 20px 60px rgba(15, 23, 42, .3); }
        .container-invoice-header { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
        .container-invoice-header h2 { margin: 0 0 4px; color: #0f4c81; }
        .container-invoice-muted { color: #64748b; font-size: .86rem; }
        .container-invoice-close { border: 0; border-radius: 8px; padding: 8px 11px; background: #e2e8f0; color: #0f172a; font-weight: 800; cursor: pointer; }
        .container-invoice-lines { width: 100%; border-collapse: collapse; font-size: .84rem; }
        .container-invoice-lines th, .container-invoice-lines td { padding: 9px 7px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
        .container-invoice-lines th { color: #475569; font-size: .72rem; text-transform: uppercase; }
        .container-invoice-totals { margin: 16px 0 0 auto; width: min(320px, 100%); display: grid; gap: 7px; }
        .container-invoice-total-row { display: flex; justify-content: space-between; gap: 16px; }
        .container-invoice-total-row.final { border-top: 2px solid #0f4c81; padding-top: 8px; color: #0f4c81; font-size: 1.1rem; font-weight: 900; }
        @media (max-width: 800px) { .container-dashboard-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media print { body * { visibility: hidden !important; } .container-dashboard, .container-dashboard *, .container-invoice-modal, .container-invoice-modal * { visibility: visible !important; } .container-dashboard { position: static; } .container-dashboard-toolbar, .container-dashboard-metrics, .container-dashboard-locations, .container-dashboard-filter, .container-invoice-close { display: none !important; } .container-dashboard-table { border: 0; } .container-invoice-backdrop { position: static; padding: 0; background: #fff; } .container-invoice-modal { width: 100%; max-height: none; overflow: visible; box-shadow: none; } }
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
            <thead><tr><th>Location</th><th>Name</th><th>Customer ID</th><th>Tracking Number</th><th>Item</th><th>Item Cost</th><th>Additional Charges</th><th>Total Cost</th><th>Consolidates</th><th>Pkgs</th></tr></thead>
            <tbody>{groupedShipments.flatMap((group) => group.map((shipment, index) => {
              const additional = additionalChargeTotal(shipment.checkin?.cargos_adicionales);
              const consolidated = selected?.shipments.filter((candidate) => candidate.checkin?.parent_box_id === shipment.id).map((candidate) => candidate.tracking).filter(Boolean) || [];
              const groupLocations = Array.from(new Set(group.map((item) => item.customer?.puerto || "Unassigned"))).join(", ");
              const dimensions = shipment.checkin && [shipment.checkin.largo, shipment.checkin.ancho, shipment.checkin.alto].some((value) => value != null)
                ? ` ${shipment.checkin.largo || "—"}x${shipment.checkin.ancho || "—"}x${shipment.checkin.alto || "—"}`
                : "";
              return <tr key={shipment.id}>
                {index === 0 && <td rowSpan={group.length}>{groupLocations}</td>}
                {index === 0 && <td rowSpan={group.length}><button type="button" className="container-customer-button" onClick={() => setInvoiceGroup(group)} title="View this customer's invoice for the selected container">{shipment.customer?.nombre || "Unknown owner"}</button></td>}
                {index === 0 && <td rowSpan={group.length}>#{shipment.customer?.numero_cliente || "—"}</td>}
                <td><strong>{shipment.tracking || "—"}</strong></td>
                <td>{shipment.tipo_paquete || shipment.contenido || "—"}{dimensions}</td>
                <td>{money(shipment.billing_subtotal)}</td>
                <td>{additional ? money(additional) : "—"}</td>
                <td>{money(shipment.billing_total ?? ((shipment.billing_subtotal || 0) + additional))}</td>
                <td>{consolidated.length ? consolidated.join(", ") : "None"}</td>
                <td>{consolidated.length + 1}</td>
              </tr>;
            }))}</tbody>
          </table>
        </div>
      </>}
      {invoiceGroup && selected && <div className="container-invoice-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInvoiceGroup(null); }}>
        <section className="container-invoice-modal" role="dialog" aria-modal="true" aria-labelledby="container-invoice-title">
          <div className="container-invoice-header">
            <div>
              <h2 id="container-invoice-title">Shipment invoice</h2>
              <div className="container-invoice-muted">{selected.codigo} · {invoiceGroup.length} package{invoiceGroup.length === 1 ? "" : "s"}</div>
              <div><strong>{invoiceGroup[0]?.customer?.nombre || "Unknown owner"}</strong> · Account #{invoiceGroup[0]?.customer?.numero_cliente || "—"}</div>
              <div className="container-invoice-muted">{invoiceGroup[0]?.customer?.email || "No email on file"} · {invoiceGroup[0]?.customer?.puerto || "Unassigned destination"}</div>
            </div>
            <button type="button" className="container-invoice-close" onClick={() => setInvoiceGroup(null)}>Close</button>
          </div>
          <table className="container-invoice-lines"><thead><tr><th>Tracking</th><th>Package</th><th>Subtotal</th><th>Additional</th><th>Tax</th><th>Total</th></tr></thead><tbody>
            {invoiceGroup.map((shipment) => {
              const additional = additionalChargeTotal(shipment.checkin?.cargos_adicionales);
              const subtotal = Number(shipment.billing_subtotal || 0);
              const tax = Number(shipment.billing_tax || 0);
              const total = Number(shipment.billing_total ?? (subtotal + tax)) + additional;
              return <tr key={shipment.id}><td><strong>{shipment.tracking || "—"}</strong></td><td>{shipment.tipo_paquete || shipment.contenido || "Package"}</td><td>{money(subtotal)}</td><td>{additional ? money(additional) : "—"}</td><td>{money(tax)}</td><td><strong>{money(total)}</strong></td></tr>;
            })}
          </tbody></table>
          <div className="container-invoice-totals"><div className="container-invoice-total-row"><span>Subtotal</span><strong>{money(invoiceTotals.subtotal)}</strong></div><div className="container-invoice-total-row"><span>Additional charges</span><strong>{money(invoiceTotals.additional)}</strong></div><div className="container-invoice-total-row"><span>Tax</span><strong>{money(invoiceTotals.tax)}</strong></div><div className="container-invoice-total-row final"><span>Invoice total</span><strong>{money(invoiceTotals.total)}</strong></div></div>
        </section>
      </div>}
    </div>
  );
}
