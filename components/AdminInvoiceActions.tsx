"use client";

export type AdminInvoiceAction = {
  id: string;
  label: string;
  group: "Invoice" | "Approval" | "Payments";
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

export default function AdminInvoiceActions({ tracking, onView, sendLabel, onSend, sendDisabled, onRecordPayment, recordPaymentDisabled, actions }: {
  tracking: string;
  onView: () => void;
  sendLabel: string;
  onSend: () => void | Promise<void>;
  sendDisabled?: boolean;
  onRecordPayment: () => void | Promise<void>;
  recordPaymentDisabled?: boolean;
  actions: AdminInvoiceAction[];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.4rem", minWidth: 0 }}>
      <button
        type="button"
        className="pa-secondary-btn"
        onClick={onView}
        aria-label={`View invoice ${tracking}`}
        style={{ padding: "0.35rem 0.65rem", minHeight: 32, fontSize: "0.78rem", whiteSpace: "nowrap" }}
      >
        View
      </button>
      <button
        type="button"
        className="pa-primary-btn"
        onClick={() => void onSend()}
        disabled={sendDisabled}
        aria-label={`${sendLabel} for invoice ${tracking}`}
        style={{ padding: "0.35rem 0.65rem", minHeight: 32, fontSize: "0.78rem", whiteSpace: "nowrap" }}
      >
        {sendLabel}
      </button>
      <button
        type="button"
        className="pa-secondary-btn"
        onClick={() => void onRecordPayment()}
        disabled={recordPaymentDisabled}
        aria-label={`Record a payment for invoice ${tracking}`}
        style={{ padding: "0.35rem 0.65rem", minHeight: 32, fontSize: "0.78rem", whiteSpace: "nowrap" }}
      >
        Record a payment
      </button>
      <select
        defaultValue=""
        aria-label={`Actions for invoice ${tracking}`}
        onChange={(event) => {
          const selected = actions.find((action) => action.id === event.currentTarget.value);
          event.currentTarget.value = "";
          if (selected && !selected.disabled) void selected.onSelect();
        }}
        style={{ minWidth: 112, minHeight: 32, padding: "0.35rem 0.5rem", border: "1px solid #cbd5e1", borderRadius: "0.5rem", background: "#fff", color: "#334155", fontSize: "0.78rem", cursor: "pointer" }}
      >
        <option value="" disabled>Actions</option>
        {(["Invoice", "Approval", "Payments"] as const).map((group) => {
          const groupActions = actions.filter((action) => action.group === group);
          if (!groupActions.length) return null;
          return (
            <optgroup key={group} label={group}>
              {groupActions.map((action) => (
                <option key={action.id} value={action.id} disabled={action.disabled}>{action.label}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
