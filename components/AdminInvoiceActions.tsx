"use client";

export type AdminInvoiceAction = {
  id: string;
  label: string;
  group: "Invoice" | "Approval" | "Payments";
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

export default function AdminInvoiceActions({ tracking, onView, actions }: {
  tracking: string;
  onView: () => void;
  actions: AdminInvoiceAction[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
      <button
        type="button"
        className="pa-secondary-btn"
        onClick={onView}
        aria-label={`View invoice ${tracking}`}
        style={{ padding: "0.35rem 0.65rem", minHeight: 32, fontSize: "0.78rem", whiteSpace: "nowrap" }}
      >
        View
      </button>
      <select
        value=""
        aria-label={`More actions for invoice ${tracking}`}
        onChange={(event) => {
          const selected = actions.find((action) => action.id === event.currentTarget.value);
          event.currentTarget.value = "";
          if (selected && !selected.disabled) void selected.onSelect();
        }}
        style={{ width: 135, minHeight: 32, padding: "0.35rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", background: "#fff", color: "#334155", fontSize: "0.78rem", cursor: "pointer" }}
      >
        <option value="" disabled>More actions…</option>
        {(["Invoice", "Approval", "Payments"] as const).map((group) => (
          <optgroup key={group} label={group}>
            {actions.filter((action) => action.group === group).map((action) => (
              <option key={action.id} value={action.id} disabled={action.disabled}>{action.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
