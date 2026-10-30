"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  MoreHorizontal,
  Package,
  RotateCcw,
  Search,
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
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(ALL_STAGE);
  const [customerFilter, setCustomerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
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
    const searchTerm = normalizedText(appliedSearch);

    return shipments.filter((shipment) => {
      const tracking = normalizedText(shipment.tracking);
      const customer = normalizedText(shipment.clienteNombre);
      const account = normalizedText(`${accountValue(shipment)} ${shipment.numero_cliente_id || ""}`);
      const stage = rowStage(shipment);
      const carrier = normalizedText(shipment.carrier);

      return (
        (!searchTerm || tracking.includes(searchTerm) || customer.includes(searchTerm) || account.includes(searchTerm)) &&
        (!stageFilter || stageFilter === ALL_STAGE || stage === stageFilter) &&
        (!customerFilter || customer === normalizedText(customerFilter)) &&
        (!accountFilter || accountValue(shipment) === accountFilter) &&
        (!carrierFilter || carrier === normalizedText(carrierFilter)) &&
        (!exceptionsOnly || issueSet.has(shipment.id))
      );
    });
  }, [appliedSearch, accountFilter, carrierFilter, customerFilter, exceptionsOnly, getStage, issueSet, shipments, stageFilter]);

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
    setSearchInput("");
    setAppliedSearch("");
    setStageFilter(ALL_STAGE);
    setCustomerFilter("");
    setAccountFilter("");
    setCarrierFilter("");
    setExceptionsOnly(false);
    setOpenActionId(null);
  };

  const applySearch = () => setAppliedSearch(searchInput.trim());

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
          color: #263746;
          background: #fbfcfb;
          padding: clamp(16px, 2vw, 28px);
          border-radius: 8px;
        }
        .shipments-header {
          margin-bottom: 1.5rem;
        }
        .shipments-title {
          margin: 0;
          color: #273746;
          font-size: clamp(2rem, 3vw, 2.4rem);
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.12;
        }
        .shipments-subtitle {
          margin: 0.5rem 0 0;
          color: #64748b;
          font-size: 0.95rem;
        }
        .shipments-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .shipments-summary-card {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
          min-height: 5.6rem;
          padding: 1rem 1.1rem;
          border: 1px solid #e1e8e8;
          border-radius: 0.5rem;
          background: #fff;
          color: #273746;
          text-align: left;
          cursor: pointer;
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }
        .shipments-summary-card:hover,
        .shipments-summary-card:focus-visible {
          border-color: #8bcac4;
          box-shadow: 0 5px 14px rgba(15, 118, 110, 0.09);
          outline: none;
          transform: translateY(-1px);
        }
        .summary-icon {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 50%;
          background: #278b88;
          color: #ffffff;
        }
        .summary-icon.transit,
        .summary-icon.delivered,
        .summary-icon.exceptions { background: #278b88; color: #ffffff; }
        .summary-copy { min-width: 0; }
        .summary-label {
          display: block;
          overflow: hidden;
          color: #64748b;
          font-size: 0.78rem;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .summary-value {
          display: block;
          margin-top: 0.18rem;
          color: #273746;
          font-size: 1.45rem;
          font-weight: 700;
          line-height: 1;
        }
        .shipments-controls {
          margin-bottom: 1.35rem;
        }
        .shipments-search-grid {
          display: grid;
          grid-template-columns: minmax(280px, 2.2fr) repeat(4, minmax(130px, 1fr));
          gap: 0.75rem;
          align-items: end;
        }
        .shipments-filter-grid {
          display: contents;
        }
        .shipments-field {
          display: grid;
          min-width: 0;
          gap: 0.35rem;
        }
        .shipments-field label {
          color: #475569;
          font-size: 0.76rem;
          font-weight: 700;
        }
        .shipments-field input,
        .shipments-field select {
          width: 100%;
          min-height: 2.55rem;
          padding: 0.52rem 0.7rem;
          border: 1px solid #cbd5d5;
          border-radius: 0.42rem;
          background: #fff;
          color: #273746;
          font: inherit;
          font-size: 0.84rem;
        }
        .shipments-field input::placeholder { color: #94a3b8; }
        .shipments-field input:focus,
        .shipments-field select:focus {
          border-color: #0f9d92;
          outline: 2px solid #b9e3df;
          outline-offset: 1px;
        }
        .shipments-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.55rem;
          margin-top: 0.75rem;
        }
        .shipments-search,
        .shipments-reset {
          display: inline-flex;
          min-height: 2.45rem;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.48rem 0.9rem;
          border-radius: 0.42rem;
          cursor: pointer;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .shipments-search {
          border: 1px solid #0f766e;
          background: #0f766e;
          color: #fff;
        }
        .shipments-search:hover,
        .shipments-search:focus-visible { border-color: #0b625c; background: #0b625c; outline: 2px solid #b9e3df; outline-offset: 1px; }
        .shipments-reset {
          border: 1px solid #cbd5d5;
          background: #fff;
          color: #475569;
        }
        .shipments-reset:hover,
        .shipments-reset:focus-visible { border-color: #8bcac4; color: #0f766e; outline: 2px solid #d7efec; outline-offset: 1px; }
        .shipments-results-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin: 0 0 0.6rem;
          color: #64748b;
          font-size: 0.8rem;
        }
        .shipments-results-line strong { color: #273746; }
        .shipments-table-wrap {
          overflow-x: auto;
          border: 1px solid #e1e8e8;
          border-radius: 0.5rem;
          background: #fff;
        }
        .shipments-table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
          font-size: 0.84rem;
        }
        .shipments-table th {
          padding: 0.72rem 0.8rem;
          border-bottom: 1px solid #dbe3e3;
          background: #f5f7f7;
          color: #475569;
          font-size: 0.74rem;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }
        .shipments-table td {
          padding: 0.76rem 0.8rem;
          border-bottom: 1px solid #edf1f1;
          color: #334155;
          vertical-align: middle;
        }
        .shipments-table tbody tr:last-child td { border-bottom: 0; }
        .shipments-table tbody tr:hover { background: #fbfdfd; }
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
        }
        .shipments-sort-button svg { color: #94a3b8; opacity: 0.85; }
        .shipments-sort-button:hover,
        .shipments-sort-button:focus-visible { color: #0f766e; outline: none; }
        .tracking-button {
          display: inline-flex;
          max-width: 16rem;
          flex-direction: column;
          align-items: flex-start;
          padding: 0;
          border: 0;
          background: transparent;
          color: #0f766e;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          text-align: left;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
        }
        .tracking-button.tracking-paid { color: #15803d; }
        .tracking-button:hover,
        .tracking-button:focus-visible { color: #0b625c; outline: none; }
        .tracking-button.tracking-paid:hover,
        .tracking-button.tracking-paid:focus-visible { color: #166534; }
        .tracking-main { overflow-wrap: anywhere; }
        .tracking-secondary { margin-top: 0.18rem; color: #94a3b8; font-size: 0.7rem; font-weight: 500; text-decoration: none; }
        .customer-name { font-weight: 600; }
        .customer-unassigned, .table-muted { color: #94a3b8; }
        .account-number { font-variant-numeric: tabular-nums; }
        .stage-badge {
          display: inline-flex;
          max-width: 12rem;
          align-items: center;
          padding: 0.25rem 0.52rem;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .action-cell { position: relative; }
        .action-menu-wrap { position: relative; display: inline-flex; }
        .action-button {
          display: inline-flex;
          width: 2rem;
          height: 2rem;
          align-items: center;
          justify-content: center;
          border: 1px solid #cbd5d5;
          border-radius: 0.42rem;
          background: #fff;
          color: #64748b;
          cursor: pointer;
        }
        .action-button:hover,
        .action-button:focus-visible { border-color: #8bcac4; color: #0f766e; outline: 2px solid #d7efec; outline-offset: 1px; }
        .actions-menu {
          position: absolute;
          z-index: 10;
          top: calc(100% + 0.35rem);
          right: 0;
          display: grid;
          min-width: 7.5rem;
          padding: 0.3rem;
          border: 1px solid #e1e8e8;
          border-radius: 0.42rem;
          background: #fff;
          box-shadow: 0 8px 20px rgba(39, 55, 70, 0.14);
        }
        .actions-menu button {
          padding: 0.45rem 0.55rem;
          border: 0;
          border-radius: 0.25rem;
          background: transparent;
          color: #334155;
          cursor: pointer;
          font: inherit;
          font-size: 0.8rem;
          text-align: left;
        }
        .actions-menu button:hover,
        .actions-menu button:focus-visible { background: #e5f5f3; color: #0f766e; outline: none; }
        .actions-menu button.delete { color: #b91c1c; }
        .actions-menu button.delete:hover,
        .actions-menu button.delete:focus-visible { background: #fef2f2; color: #b91c1c; }
        .empty-state { padding: 2rem 1rem !important; color: #64748b !important; text-align: center; }
        @media (max-width: 1100px) {
          .shipments-search-grid { grid-template-columns: minmax(250px, 1.6fr) repeat(4, minmax(115px, 1fr)); }
        }
        @media (max-width: 900px) {
          .shipments-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .shipments-search-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .shipments-field:first-child { grid-column: 1 / -1; }
        }
        @media (max-width: 520px) {
          .shipments-title { font-size: 2rem; }
          .shipments-summary { gap: 0.65rem; }
          .shipments-summary-card { padding: 0.8rem; }
          .summary-icon { width: 2.4rem; height: 2.4rem; }
          .shipments-search-grid { grid-template-columns: 1fr; }
          .shipments-field:first-child { grid-column: auto; }
          .shipments-actions { justify-content: stretch; }
          .shipments-search, .shipments-reset { flex: 1; }
        }
      `}</style>

      <div className="shipments-header">
        <h2 id="shipments-admin-title" className="shipments-title">Shipments</h2>
        <p className="shipments-subtitle">Track and manage all inbound and outbound shipments.</p>
      </div>
      <div className="shipments-summary" aria-label="Shipment summary">
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("all")} aria-label={`Show all ${counts.total} shipments`}>
          <span className="summary-icon"><Package aria-hidden="true" size={21} /></span>
          <span className="summary-copy"><span className="summary-label">Total Shipments</span><strong className="summary-value">{counts.total}</strong></span>
        </button>
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("transit")} aria-label={`Show ${counts.inTransit} shipments in transit`}>
          <span className="summary-icon transit"><Truck aria-hidden="true" size={21} /></span>
          <span className="summary-copy"><span className="summary-label">In Transit</span><strong className="summary-value">{counts.inTransit}</strong></span>
        </button>
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("delivered")} aria-label={`Show ${counts.delivered} delivered shipments`}>
          <span className="summary-icon delivered"><CheckCircle2 aria-hidden="true" size={21} /></span>
          <span className="summary-copy"><span className="summary-label">Delivered</span><strong className="summary-value">{counts.delivered}</strong></span>
        </button>
        <button type="button" className="shipments-summary-card" onClick={() => chooseSummary("exceptions")} aria-label={`Show ${counts.exceptions} shipments with exceptions`}>
          <span className="summary-icon exceptions"><AlertTriangle aria-hidden="true" size={21} /></span>
          <span className="summary-copy"><span className="summary-label">Exceptions</span><strong className="summary-value">{counts.exceptions}</strong></span>
        </button>
      </div>
      <form
        className="shipments-controls"
        onSubmit={(event) => {
          event.preventDefault();
          applySearch();
        }}
      >
        <div className="shipments-search-grid">
          <div className="shipments-field">
            <label htmlFor="shipments-search">Search</label>
            <input
              id="shipments-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by tracking number, customer, or account #..."
            />
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
          </div>
        </div>
        <div className="shipments-actions">
          <button type="button" className="shipments-reset" onClick={resetFilters} aria-label="Reset shipment filters">
            <RotateCcw aria-hidden="true" size={14} /> Reset
          </button>
          <button type="submit" className="shipments-search">
            <Search aria-hidden="true" size={14} /> Search
          </button>
        </div>
      </form>
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
              const isPaid = normalizedText(shipment.invoice_status) === "paid";
              return (
                <tr key={shipment.id}>
                  <td>
                    <button type="button" className={`tracking-button${isPaid ? " tracking-paid" : ""}`} onClick={() => onView(shipment.id)} aria-label={`View shipment ${shipment.tracking}`}>
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
                  <td className="action-cell">
                    <div className="action-menu-wrap">
                      <button
                        type="button"
                        className="action-button"
                        onClick={() => setOpenActionId((current) => current === shipment.id ? null : shipment.id)}
                        aria-label={`Actions for ${shipment.tracking}`}
                        aria-expanded={openActionId === shipment.id}
                        aria-haspopup="menu"
                        title="Actions"
                      >
                        <MoreHorizontal aria-hidden="true" size={17} />
                      </button>
                      {openActionId === shipment.id && (
                        <div className="actions-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onView(shipment.id); }}>View</button>
                          {onEdit && <button type="button" role="menuitem" onClick={() => { setOpenActionId(null); onEdit(shipment); }}>Edit</button>}
                          {onDelete && <button type="button" role="menuitem" className="delete" onClick={() => { setOpenActionId(null); onDelete(shipment.id); }}>Delete</button>}
                        </div>
                      )}
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
