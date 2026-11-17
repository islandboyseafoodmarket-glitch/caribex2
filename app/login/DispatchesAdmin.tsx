"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type Dispatch = {
  id: string;
  tracking: string;
  despachado_en: string | null;
  nombre_cliente: string;
  numero_cuenta: string;
  puerto: string;
  container_code: string;
  ferry_location: string;
  numero_reserva: string | null;
  enviado_en: string | null;
  booking_status: string;
  shipment_status: string;
  package_type: string | null;
};

const routeLabel = (value: string) =>
  ({
    la_ceiba_utila: "La Ceiba + Utila",
    guanaja: "Guanaja",
    san_pedro_sula: "San Pedro Sula",
    tegucigalpa: "Tegucigalpa",
    la_ceiba: "La Ceiba",
    utila: "Utila",
  } as Record<string, string>)[value] || value;

const showId = (account: string, port: string) => {
  const normalized = String(port || "").toLowerCase().replace(/[–—\s-]+/g, "_");
  const prefix = normalized.includes("roatan") || normalized.includes("roatán")
    ? "R"
    : normalized.includes("utila")
      ? "U"
      : normalized.includes("guanaja")
        ? "G"
        : normalized.includes("ceiba")
          ? "L"
          : "";
  return account ? (prefix ? `${prefix}-${account}` : account) : "—";
};

const searchable = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Tegucigalpa",
      }).format(new Date(value))
    : "—";

export default function DispatchesAdmin() {
  const [rows, setRows] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`/api/ferry-dispatches?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load dispatches");
      setRows(body.dispatches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dispatches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const term = searchable(filter);
    if (!term) return rows;
    return rows.filter((row) =>
      [row.numero_cuenta, showId(row.numero_cuenta, row.puerto), row.numero_reserva].some((value) => searchable(value).includes(term)),
    );
  }, [filter, rows]);

  return (
    <section className="dispatches-workspace">
      <style>{`
        .dispatches-workspace { width: 100%; min-width: 0; color: #0f172a; }
        .dispatches-toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
        .dispatches-toolbar h2 { margin: 0; }
        .dispatches-toolbar p { color: #64748b; margin: .3rem 0 0; }
        .dispatches-controls { display: flex; gap: .65rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
        .dispatches-filter { flex: 1 1 320px; min-width: 0; min-height: 2.45rem; padding: .55rem .75rem; border: 1px solid #bfd2df; border-radius: .55rem; background: #fff; color: #0f172a; }
        .dispatches-result-count { color: #64748b; font-size: .84rem; }
        .dispatches-refresh { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid #93c5fd; border-radius: .55rem; background: #eff6ff; color: #1d4ed8; padding: .55rem .75rem; font-weight: 700; cursor: pointer; }
        .dispatches-table-wrap { width: 100%; max-width: 100%; overflow: visible; border: 1px solid #dbe4ed; border-radius: .8rem; background: #fff; }
        .dispatches-workspace table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; }
        .dispatches-workspace th, .dispatches-workspace td { min-width: 0; padding: .65rem .55rem; border-bottom: 1px solid #eef2f7; text-align: left; white-space: normal; overflow-wrap: anywhere; word-break: break-word; font-size: .78rem; line-height: 1.35; }
        .dispatches-workspace th { background: #f8fafc; color: #475569; font-size: .68rem; }
        .dispatches-tracking { color: #1d4ed8; font-weight: 800; }
        .dispatches-booking { font-weight: 700; }
        .dispatches-booking.sent { color: #166534; }
        .dispatches-booking.pending { color: #b45309; }
        .dispatches-empty { padding: 2rem; text-align: center; color: #64748b; }
        @media (max-width: 900px) {
          .dispatches-toolbar { flex-direction: column; }
          .dispatches-refresh { align-self: flex-start; }
          .dispatches-workspace th, .dispatches-workspace td { padding: .55rem .35rem; font-size: .7rem; }
          .dispatches-workspace th { font-size: .61rem; }
        }
      `}</style>

      <div className="dispatches-toolbar">
        <div>
          <h2><Truck size={19} style={{ verticalAlign: "-3px", marginRight: 7 }} />Dispatches</h2>
          <p>Ferry shipments scanned out of the warehouse. Booking-number status is shown under the route.</p>
        </div>
        <button type="button" className="dispatches-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} />{loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      <div className="dispatches-controls">
        <input
          className="dispatches-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search by Client ID, Show ID, or booking number"
          aria-label="Search dispatches by Client ID, Show ID, or booking number"
        />
        <span className="dispatches-result-count">{filteredRows.length} of {rows.length} dispatches</span>
      </div>

      {error ? (
        <div className="dispatches-empty" role="alert">{error}</div>
      ) : (
        <div className="dispatches-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Client ID</th>
                <th>Show ID</th>
                <th>Route</th>
                <th>Container</th>
                <th>Tracking</th>
                <th>Packages</th>
                <th>Booking number status</th>
                <th>Shipment status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{dateLabel(row.despachado_en)}</td>
                  <td>{row.nombre_cliente || "—"}</td>
                  <td>{row.numero_cuenta || "—"}</td>
                  <td>{showId(row.numero_cuenta, row.puerto)}</td>
                  <td>{routeLabel(row.ferry_location)}<small style={{ display: "block", color: "#64748b", marginTop: 3 }}>{row.puerto || "—"}</small></td>
                  <td>{row.container_code}</td>
                  <td className="dispatches-tracking">{row.tracking}</td>
                  <td>{row.package_type || "Package"}</td>
                  <td className={`dispatches-booking ${row.numero_reserva ? "sent" : "pending"}`}>{row.numero_reserva ? `Sent: ${row.numero_reserva}` : "Awaiting booking number"}</td>
                  <td>{row.shipment_status}</td>
                </tr>
              )) : (
                <tr><td colSpan={10} className="dispatches-empty">{rows.length ? "No dispatches match this filter." : "No ferry dispatches have been scanned yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
