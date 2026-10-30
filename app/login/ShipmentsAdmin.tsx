"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  Package,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { SHIPMENT_STAGE_COLORS, WORKFLOW_STAGE_COLORS } from "../../lib/shipment-colors";

export type ShipmentRow = {
  id: string;
  tracking: string;
  clienteNombre?: string | null;
  clienteNumero?: number | null;
  numero_cliente_id?: string | null;
  carrier?: string | null;
  tipo_paquete?: string | null;
  estado?: string | null;
  creado_en?: string | null;
  hora_fecha?: string | null;
  invoice_status?: string | null;
  insideBox?: boolean;
};

export type ShipmentsAdminProps = {
  shipments: ShipmentRow[];
  issueIds?: string[];
  stageOptions: readonly (readonly [string, string])[];
  getStage: (estado: string | null | undefined) => string;
  onView: (id: string) => void;
  onEdit?: (shipment: ShipmentRow) => void;
  onDelete?: (id: string) => void;
};

type SortKey = "tracking" | "customer" | "account" | "carrier" | "stage" | "created";
type SortDirection = "asc" | "desc";
type SortState = { key: SortKey; direction: SortDirection };

const ALL_STAGE = "ALL";
const compactText = (value: unknown) => String(value ?? "").trim();
const normalizedText = (value: unknown) => compactText(value).toLocaleLowerCase();

const formatCreatedDate = (value: string | null | undefined) => {
  const text = compactText(value);
  if (!text) return "—";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const createdTimestamp = (shipment: ShipmentRow) => {
  const raw = compactText(shipment.creado_en);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const accountValue = (shipment: ShipmentRow) =>
  shipment.clienteNumero == null ? "" : String(shipment.clienteNumero);

const isManualInvoice = (shipment: ShipmentRow) =>
  normalizedText(shipment.tipo_paquete) === "manual_invoice" ||
  normalizedText(shipment.carrier) === "manual invoice";

const readableStage = (stage: string) =>
  stage
    .replaceAll("_", " ")
    .toLocaleLowerCase()
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());

const stageClassName = (stage: string) =>
  stage.toLocaleUpperCase().replace(/[^A-Z0-9]+/g, "-") || "UNKNOWN";

const stageBadgeStyle = (stage: string) => {
  const palette = stage === "INSIDE_BOX"
    ? { color: "#4338ca", background: "#eef2ff", border: "#a5b4fc" }
    : stage === "PICKUP_READY"
    ? SHIPMENT_STAGE_COLORS.UNLOADED
    : WORKFLOW_STAGE_COLORS[stage] || SHIPMENT_STAGE_COLORS[stage] || SHIPMENT_STAGE_COLORS.RECEIVED;
  return { color: palette.color, backgroundColor: palette.background, borderColor: palette.border };
};

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown aria-hidden="true" size={14} />;
  return direction === "asc" ? <ArrowUp aria-hidden="true" size={14} /> : <ArrowDown aria-hidden="true" size={14} />;
}

export default function ShipmentsAdmin({
  shipments,
  issueIds = [],
  stageOptions,
  getStage,
  onView,
  onEdit,
  onDelete,
}: ShipmentsAdminProps) {
  const [trackingSearch, setTrackingSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(ALL_STAGE);
  const [customerFilter, setCustomerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "created", direction: "desc" });

  const issueSet = useMemo(() => new Set(issueIds), [issueIds]);

  const stages = useMemo(() => {
    const options = stageOptions.some(([value]) => value === ALL_STAGE)
      ? stageOptions
      : [[ALL_STAGE, "All stages"], ...stageOptions] as readonly (readonly [string, string])[];
    return options;
  }, [stageOptions]);

  const stageLabels = useMemo(() => new Map(stages), [stages]);
  const rowStage = (shipment: ShipmentRow) => shipment.insideBox && getStage(shipment.estado) !== "PICKED_UP" ? "INSIDE_BOX" : getStage(shipment.estado);

  const customerOptions = useMemo(() => {
    const values = new Set<string>();
    shipments.forEach((shipment) => {
      const customer = compactText(shipment.clienteNombre);
      if (customer) values.add(customer);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [shipments]);

  const accountOptions = useMemo(() => {
    const values = new Set<number>();
    shipments.forEach((shipment) => {
      if (shipment.clienteNumero != null && Number.isFinite(Number(shipment.clienteNumero))) {
        values.add(Number(shipment.clienteNumero));
      }
    });
    return Array.from(values).sort((a, b) => a - b).map(String);
  }, [shipments]);

  const carrierOptions = useMemo(() => {
    const values = new Map<string, string>();
    shipments.forEach((shipment) => {
      const carrier = compactText(shipment.carrier);
      if (carrier && !values.has(normalizedText(carrier))) values.set(normalizedText(carrier), carrier);
    });
    return Array.from(values.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [shipments]);

  const counts = useMemo(() => {
    let inTransit = 0;
    let delivered = 0;
    let exceptions = 0;
    shipments.forEach((shipment) => {
      const stage = rowStage(shipment);
      if (stage === "IN_TRANSIT") inTransit += 1;
      if (stage === "PICKED_UP") delivered += 1;
      if (issueSet.has(shipment.id)) exceptions += 1;
    });
    return { total: shipments.length, inTransit, delivered, exceptions };
  }, [getStage, issueSet, shipments]);

  const filteredShipments = useMemo(() => {
    const trackingTerm = normalizedText(trackingSearch);
    const customerTerm = normalizedText(customerSearch);
    const accountTerm = normalizedText(accountSearch);

    return shipments.filter((shipment) => {
      const tracking = normalizedText(shipment.tracking);
      const customer = normalizedText(shipment.clienteNombre);
      const account = normalizedText(`${accountValue(shipment)} ${shipment.numero_cliente_id || ""}`);
      const stage = rowStage(shipment);
      const carrier = normalizedText(shipment.carrier);

      return (
        (!trackingTerm || tracking.includes(trackingTerm)) &&
        (!customerTerm || customer.includes(customerTerm)) &&
        (!accountTerm || account.includes(accountTerm)) &&
        (!stageFilter || stageFilter === ALL_STAGE || stage === stageFilter) &&
        (!customerFilter || customer === normalizedText(customerFilter)) &&
        (!accountFilter || accountValue(shipment) === accountFilter) &&
        (!carrierFilter || carrier === normalizedText(carrierFilter)) &&
        (!exceptionsOnly || issueSet.has(shipment.id))
      );
    });
  }, [accountFilter, accountSearch, carrierFilter, customerFilter, customerSearch, exceptionsOnly, getStage, issueSet, shipments, stageFilter, trackingSearch]);

  const sortedShipments = useMemo(() => {
    const rows = filteredShipments.map((shipment, index) => ({ shipment, index }));
    rows.sort((left, right) => {
      const a = left.shipment;
      const b = right.shipment;
      let comparison = 0;

      if (sort.key === "account") {
        const aValue = a.clienteNumero == null ? null : Number(a.clienteNumero);
        const bValue = b.clienteNumero == null ? null : Number(b.clienteNumero);
        const aKnown = aValue != null && Number.isFinite(aValue);
        const bKnown = bValue != null && Number.isFinite(bValue);
        if (!aKnown || !bKnown) {
          if (aKnown !== bKnown) return aKnown ? -1 : 1;
        } else {
          comparison = aValue - bValue;
        }
      } else if (sort.key === "created") {
        const aValue = createdTimestamp(a);
        const bValue = createdTimestamp(b);
        if (aValue == null || bValue == null) {
          if ((aValue == null) !== (bValue == null)) return aValue == null ? 1 : -1;
        } else {
          comparison = aValue - bValue;
        }
      } else {
        const aValue = sort.key === "tracking"
          ? a.tracking
          : sort.key === "customer"
            ? a.clienteNombre
            : sort.key === "carrier"
              ? a.carrier
              : stageLabels.get(rowStage(a)) || rowStage(a);
        const bValue = sort.key === "tracking"
          ? b.tracking
          : sort.key === "customer"
            ? b.clienteNombre
            : sort.key === "carrier"
              ? b.carrier
              : stageLabels.get(rowStage(b)) || rowStage(b);
        const aText = normalizedText(aValue);
        const bText = normalizedText(bValue);
        if (!aText || !bText) {
          if (aText !== bText) return aText ? -1 : 1;
        } else {
          comparison = aText.localeCompare(bText, undefined, { sensitivity: "base", numeric: true });
        }
      }

      if (comparison === 0) return left.index - right.index;
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return rows.map(({ shipment }) => shipment);
  }, [filteredShipments, getStage, sort, stageLabels]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const resetFilters = () => {
    setTrackingSearch("");
    setCustomerSearch("");
    setAccountSearch("");
    setStageFilter(ALL_STAGE);
    setCustomerFilter("");
    setAccountFilter("");
    setCarrierFilter("");
    setExceptionsOnly(false);
  };

  const chooseSummary = (kind: "all" | "transit" | "delivered" | "exceptions") => {
    setExceptionsOnly(kind === "exceptions");
    setStageFilter(kind === "transit" ? "IN_TRANSIT" : kind === "delivered" ? "PICKED_UP" : ALL_STAGE);
  };

  const stageLabel = (shipment: ShipmentRow) => {
    const stage = rowStage(shipment);
    return stageLabels.get(stage) || readableStage(stage);
  };

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      className="shipments-sort-button"
      onClick={() => toggleSort(key)}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <SortIndicator active={sort.key === key} direction={sort.direction} />
    </button>
  );

  return (
    <section className="shipments-admin" aria-labelledby="shipments-admin-title">
      <style jsx>{`
        .shipments-admin {
          width: 100%;
          color: #102a43;
        }
        .shipments-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .shipments-kicker {
          margin: 0 0 0.3rem;
          color: #2563eb;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .shipments-title {
          margin: 0;
          color: #123e63;
          font-size: clamp(1.25rem, 2vw, 1.65rem);
          line-height: 1.15;
        }
        .shipments-subtitle {
          margin: 0.35rem 0 0;
          color: #64748b;
          font-size: 0.88rem;
        }
        .shipments-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.7rem;
          margin-bottom: 1rem;
        }
        .shipments-summary-card {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
          padding: 0.78rem 0.85rem;
          border: 1px solid #dbeafe;
          border-radius: 0.7rem;
          background: #ffffff;
          color: #123e63;
          text-align: left;
          cursor: pointer;
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }
        .shipments-summary-card:hover,
        .shipments-summary-card:focus-visible {
          border-color: #60a5fa;
          box-shadow: 0 5px 14px rgba(30, 64, 175, 0.1);
          outline: none;
          transform: translateY(-1px);
        }
        .summary-icon {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 0.55rem;
          background: #eff6ff;
          color: #2563eb;
        }
        .summary-icon.transit { background: #ecfeff; color: #0f766e; }
        .summary-icon.delivered { background: #ecfdf5; color: #15803d; }
        .summary-icon.exceptions { background: #fff7ed; color: #c2410c; }
        .summary-copy { min-width: 0; }
        .summary-label {
          display: block;
          overflow: hidden;
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .summary-value {
          display: block;
          margin-top: 0.08rem;
          color: #123e63;
          font-size: 1.28rem;
          line-height: 1;
        }
        .shipments-controls {
          padding: 0.85rem;
          border: 1px solid #d9e6f2;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.82);
        }
        .shipments-search-grid,
        .shipments-filter-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
        }
        .shipments-filter-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
          margin-top: 0.65rem;
          align-items: end;
        }
        .shipments-field {
          display: grid;
          min-width: 0;
          gap: 0.28rem;
        }
        .shipments-field label {
          color: #486581;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .shipments-field input,
        .shipments-field select {
          width: 100%;
          min-height: 2.25rem;
          padding: 0.42rem 0.6rem;
          border: 1px solid #bfd3e6;
          border-radius: 0.48rem;
          background: #fff;
          color: #123e63;
          font: inherit;
          font-size: 0.82rem;
        }
        .shipments-field input:focus,
        .shipments-field select:focus {
          border-color: #2563eb;
          outline: 2px solid #bfdbfe;
          outline-offset: 1px;
        }
        .shipments-reset {
          display: inline-flex;
          min-height: 2.25rem;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.42rem 0.72rem;
          border: 1px solid #93c5fd;
          border-radius: 0.48rem;
          background: #eff6ff;
          color: #1d4ed8;
          cursor: pointer;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .shipments-reset:hover,
        .shipments-reset:focus-visible { background: #dbeafe; outline: none; }
        .shipments-results-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin: 0.9rem 0 0.5rem;
          color: #64748b;
          font-size: 0.8rem;
        }
        .shipments-results-line strong { color: #123e63; }
        .shipments-table-wrap {
          overflow-x: auto;
          border: 1px solid #d9e6f2;
          border-radius: 0.75rem;
          background: #fff;
        }
        .shipments-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .shipments-table th {
          padding: 0.62rem 0.7rem;
          border-bottom: 1px solid #cbd5e1;
          background: #f4f8fc;
          color: #486581;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .shipments-table td {
          padding: 0.68rem 0.7rem;
          border-bottom: 1px solid #e5edf5;
          color: #243b53;
          vertical-align: middle;
        }
        .shipments-table tbody tr:last-child td { border-bottom: 0; }
        .shipments-table tbody tr:hover { background: #f8fbff; }
        .shipments-sort-button {
          display: inline-flex;
          align-items: center;
          gap: 0.28rem;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
          text-transform: inherit;
        }
        .shipments-sort-button:hover,
        .shipments-sort-button:focus-visible { color: #1d4ed8; outline: none; }
        .tracking-button {
          display: inline-flex;
          max-width: 16rem;
          flex-direction: column;
          align-items: flex-start;
          padding: 0;
          border: 0;
          background: transparent;
          color: #1d4ed8;
          cursor: pointer;
          font: inherit;
          text-align: left;
        }
        .tracking-button:hover,
        .tracking-button:focus-visible { text-decoration: underline; text-underline-offset: 3px; outline: none; }
        .tracking-main { overflow-wrap: anywhere; font-weight: 800; }
        .tracking-secondary { margin-top: 0.18rem; color: #78909c; font-size: 0.7rem; font-weight: 600; }
        .customer-name { font-weight: 700; }
        .customer-unassigned, .table-muted { color: #829ab1; }
        .account-number { font-variant-numeric: tabular-nums; }
        .stage-badge {
          display: inline-flex;
          max-width: 12rem;
          align-items: center;
          padding: 0.24rem 0.48rem;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 0.72rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .action-group { display: flex; align-items: center; gap: 0.3rem; }
        .action-button {
          display: inline-flex;
          width: 2rem;
          height: 2rem;
          align-items: center;
          justify-content: center;
          border: 1px solid #bfdbfe;
          border-radius: 0.42rem;
          background: #eff6ff;
          color: #1d4ed8;
          cursor: pointer;
        }
        .action-button:hover,
        .action-button:focus-visible { background: #dbeafe; outline: 2px solid #93c5fd; outline-offset: 1px; }
        .action-button.delete { border-color: #fecaca; background: #fff1f2; color: #be123c; }
        .action-button.delete:hover,
        .action-button.delete:focus-visible { background: #ffe4e6; outline-color: #fda4af; }
        .empty-state { padding: 2rem 1rem !important; color: #64748b !important; text-align: center; }
        @media (max-width: 850px) {
          .shipments-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .shipments-search-grid { grid-template-columns: 1fr; }
          .shipments-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .shipments-reset { width: 100%; }
        }
        @media (max-width: 520px) {
          .shipments-header { align-items: flex-start; }
          .shipments-summary { gap: 0.5rem; }
          .shipments-summary-card { padding: 0.65rem; }
          .summary-icon { width: 1.8rem; height: 1.8rem; }
          .summary-value { font-size: 1.1rem; }
          .shipments-filter-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="shipments-header">
        <div>
          <p className="shipments-kicker">Caribex Admin</p>
          <h2 id="shipments-admin-title" className="shipments-title">Shipments</h2>
          <p className="shipments-subtitle">Review shipment activity and open a record for its existing detail workflow.</p>
        </div>
      </div>

      <div className="shipments-summary" aria-label="Shipment summary">
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("all")} aria-label={`Show all ${counts.total} shipments`}>
          <span className="summary-icon"><Package aria-hidden="true" size={18} /></span>
          <span className="summary-copy"><span className="summary-label">Total shipments</span><strong className="summary-value">{counts.total}</strong></span>
        </button>
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("transit")} aria-label={`Show ${counts.inTransit} shipments in transit`}>
          <span className="summary-icon transit"><Truck aria-hidden="true" size={18} /></span>
          <span className="summary-copy"><span className="summary-label">In transit</span><strong className="summary-value">{counts.inTransit}</strong></span>
        </button>
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("delivered")} aria-label={`Show ${counts.delivered} delivered shipments`}>
          <span className="summary-icon delivered"><CheckCircle2 aria-hidden="true" size={18} /></span>
          <span className="summary-copy"><span className="summary-label">Delivered</span><strong className="summary-value">{counts.delivered}</strong></span>
        </button>
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("exceptions")} aria-label={`Show ${counts.exceptions} shipments with exceptions`}>
          <span className="summary-icon exceptions"><AlertTriangle aria-hidden="true" size={18} /></span>
          <span className="summary-copy"><span className="summary-label">Exceptions</span><strong className="summary-value">{counts.exceptions}</strong></span>
        </button>
      </div>

      <div className="shipments-controls">
        <div className="shipments-search-grid">
          <div className="shipments-field">
            <label htmlFor="shipments-search-tracking">Search tracking</label>
            <input id="shipments-search-tracking" type="search" value={trackingSearch} onChange={(event) => setTrackingSearch(event.target.value)} placeholder="Tracking number" />
          </div>
          <div className="shipments-field">
            <label htmlFor="shipments-search-customer">Search customer</label>
            <input id="shipments-search-customer" type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Customer name" />
          </div>
          <div className="shipments-field">
            <label htmlFor="shipments-search-account">Search account</label>
            <input id="shipments-search-account" type="search" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Account number" inputMode="numeric" />
          </div>
        </div>
        <div className="shipments-filter-grid">
          <div className="shipments-field">
            <label htmlFor="shipments-stage-filter">Stage</label>
            <select id="shipments-stage-filter" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
              {stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="shipments-field">
            <label htmlFor="shipments-customer-filter">Customer</label>
            <select id="shipments-customer-filter" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
              <option value="">All customers</option>
              {customerOptions.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
            </select>
          </div>
          <div className="shipments-field">
            <label htmlFor="shipments-account-filter">Account #</label>
            <select id="shipments-account-filter" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
              <option value="">All accounts</option>
              {accountOptions.map((account) => <option key={account} value={account}>#{account}</option>)}
            </select>
          </div>
          <div className="shipments-field">
            <label htmlFor="shipments-carrier-filter">Carrier</label>
            <select id="shipments-carrier-filter" value={carrierFilter} onChange={(event) => setCarrierFilter(event.target.value)}>
              <option value="">All carriers</option>
              {carrierOptions.map((carrier) => <option key={carrier} value={carrier}>{carrier}</option>)}
            </select>
          </div>
          <button type="button" className="shipments-reset" onClick={resetFilters} aria-label="Reset shipment filters">
            <RotateCcw aria-hidden="true" size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="shipments-results-line" aria-live="polite">
        <span>Showing <strong>{sortedShipments.length}</strong> of <strong>{shipments.length}</strong> shipments</span>
        {exceptionsOnly && <span>Exceptions filter active</span>}
      </div>

      <div className="shipments-table-wrap">
        <table className="shipments-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={sort.key === "tracking" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("tracking", "Tracking")}</th>
              <th scope="col" aria-sort={sort.key === "customer" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("customer", "Customer name")}</th>
              <th scope="col" aria-sort={sort.key === "account" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("account", "Account #")}</th>
              <th scope="col" aria-sort={sort.key === "carrier" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("carrier", "Carrier")}</th>
              <th scope="col" aria-sort={sort.key === "stage" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("stage", "Stage")}</th>
              <th scope="col" aria-sort={sort.key === "created" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>{sortButton("created", "Created")}</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedShipments.length === 0 ? (
              <tr><td className="empty-state" colSpan={7}><Search aria-hidden="true" size={18} /> No shipments match these filters.</td></tr>
            ) : sortedShipments.map((shipment) => {
              const manualInvoice = isManualInvoice(shipment);
              const shipmentStage = rowStage(shipment);
              return (
                <tr key={shipment.id}>
                  <td>
                    <button type="button" className="tracking-button" onClick={() => onView(shipment.id)} aria-label={`View shipment ${shipment.tracking}`}>
                      <span className="tracking-main">{shipment.tracking || "—"}</span>
                      <span className="tracking-secondary">{manualInvoice ? "Manual invoice" : compactText(shipment.tipo_paquete) || "Shipment"}</span>
                    </button>
                  </td>
                  <td>
                    {compactText(shipment.clienteNombre) ? <span className="customer-name">{shipment.clienteNombre}</span> : <span className="customer-unassigned">Unassigned</span>}
                  </td>
                  <td className="account-number">{shipment.clienteNumero != null ? `#${shipment.clienteNumero}` : <span className="table-muted">—</span>}</td>
                  <td>{compactText(shipment.carrier) || <span className="table-muted">—</span>}</td>
                  <td><span className={`stage-badge ${stageClassName(shipmentStage)}`} style={stageBadgeStyle(shipmentStage)} title={stageLabel(shipment)}>{stageLabel(shipment)}</span></td>
                  <td>{formatCreatedDate(shipment.creado_en)}</td>
                  <td>
                    <div className="action-group" aria-label={`Actions for ${shipment.tracking}`}>
                      <button type="button" className="action-button" onClick={() => onView(shipment.id)} aria-label={`View ${shipment.tracking}`} title="View"><Eye aria-hidden="true" size={15} /></button>
                      {onEdit && <button type="button" className="action-button" onClick={() => onEdit(shipment)} aria-label={`Edit ${shipment.tracking}`} title="Edit"><Pencil aria-hidden="true" size={15} /></button>}
                      {onDelete && <button type="button" className="action-button delete" onClick={() => onDelete(shipment.id)} aria-label={`Delete ${shipment.tracking}`} title="Delete"><Trash2 aria-hidden="true" size={15} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
