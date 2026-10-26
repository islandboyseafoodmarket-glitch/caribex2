"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { PAYMENT_METHODS, parseAmountCents, type PaymentLedgerEntry, type PaymentSummary } from "../lib/payment-ledger";

type InvoiceReference = { id: string; tracking: string; total: number | null; clienteNombre: string | null; clienteNumero: number | null };

function today() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}
const money = (value: unknown) => `$${Number(value || 0).toFixed(2)}`;

async function requestLedger(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your Admin session has expired. Please sign in again.");
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers }, cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The payment request could not be completed.");
  return payload;
}

export default function PaymentLedgerDialog({ invoice, mode, onClose, onChanged }: {
  invoice: InvoiceReference;
  mode: "record" | "history";
  onClose: () => void;
  onChanged: (summary: PaymentSummary) => void;
}) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [entries, setEntries] = useState<PaymentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today);
  const [customerNote, setCustomerNote] = useState("");
  const [paymentKey] = useState(() => crypto.randomUUID());
  const [reversing, setReversing] = useState<PaymentLedgerEntry | null>(null);
  const [reason, setReason] = useState("");
  const [reversalKey, setReversalKey] = useState(() => crypto.randomUUID());

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    const payload = await requestLedger(`/api/admin/payments?invoice_id=${encodeURIComponent(invoice.id)}`, { signal });
    if (signal?.aborted) return;
    setSummary(payload.invoice);
    setEntries(payload.entries || []);
    setAmount((previous) => previous || Number(payload.invoice.balance || 0).toFixed(2));
    return payload;
  }, [invoice.id]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal).catch((failure) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load payment history.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loadHistory]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary || saving) return;
    setError(null);
    try {
      const cents = parseAmountCents(amount);
      if (cents > Math.round(Number(summary.balance) * 100)) throw new Error("The payment cannot exceed the outstanding balance.");
      if (!method) throw new Error("Select a payment method.");
      if (!date) throw new Error("Select the payment date.");
      setSaving(true);
      const payload = await requestLedger("/api/admin/payments", { method: "POST", body: JSON.stringify({ invoice_id: invoice.id, amount, method, reference, notes, payment_date: date, customer_invoice_note: customerNote, idempotency_key: paymentKey }) });
      setSummary(payload.invoice);
      onChanged(payload.invoice);
      setNotice(payload.replayed ? "This payment was already recorded; no duplicate was added." : "Payment recorded. This entry cannot be edited or deleted.");
      setCurrentMode("history");
      await loadHistory();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not record payment. Retry the same submission to avoid duplicates.");
    } finally { setSaving(false); }
  };

  const recordReversal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reversing || saving) return;
    if (!reason.trim()) { setError("A reason is required for a reversal."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = await requestLedger("/api/admin/payments", { method: "POST", body: JSON.stringify({ action: "reverse", payment_id: reversing.id, reason: reason.trim(), payment_date: date, idempotency_key: reversalKey }) });
      setSummary(payload.invoice);
      onChanged(payload.invoice);
      setReversing(null);
      setReason("");
      setNotice("Reversal recorded. The original payment remains in history.");
      await loadHistory();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not record the reversal.");
    } finally { setSaving(false); }
  };

  const reversed = new Set(entries.filter((entry) => entry.entry_type === "REVERSAL").map((entry) => entry.original_payment_id));
  const outstanding = Number(summary?.balance || 0);

  return <div className="pa-modal-overlay">
    <div className="pa-modal" style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }} role="dialog" aria-modal="true" aria-labelledby="payment-ledger-title">
      <div className="pa-modal-header"><h2 id="payment-ledger-title" className="pa-modal-title">{currentMode === "record" ? "Record payment" : "Payment history"}</h2><button type="button" className="pa-close-btn" onClick={onClose} disabled={saving} aria-label="Close payment dialog">×</button></div>
      <p style={{ color: "#475569", margin: "0 0 .8rem" }}>{invoice.clienteNombre || "Customer"} {invoice.clienteNumero != null ? `(#${invoice.clienteNumero})` : ""} · Invoice {invoice.tracking}</p>
      <p style={{ color: "#64748b", fontSize: ".86rem" }}>Recorded payments cannot be edited or deleted. Correct a mistake by recording a reversal; the original entry stays in history.</p>
      {loading && <p role="status">Loading saved payments…</p>}
      {error && <p role="alert" style={{ padding: ".75rem", background: "#fef2f2", color: "#991b1b", borderRadius: ".5rem" }}>{error}</p>}
      {notice && <p role="status" style={{ padding: ".75rem", background: "#f0fdf4", color: "#166534", borderRadius: ".5rem" }}>{notice}</p>}
      {summary && <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", padding: ".8rem 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", marginBottom: "1rem" }}><span>Total <strong>{money(summary.billing_total)}</strong></span><span>Paid <strong style={{ color: "#166534" }}>{money(summary.paid)}</strong></span><span>Balance <strong style={{ color: outstanding > 0 ? "#b45309" : "#166534" }}>{money(summary.balance)}</strong></span></div>}
      {currentMode === "record" && summary && outstanding > 0 && <form onSubmit={recordPayment}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".8rem" }}>
          <div className="pa-field"><label htmlFor="ledger-payment-amount">Amount received (USD)</label><input id="ledger-payment-amount" className="pa-input" type="number" inputMode="decimal" min="0.01" max={outstanding} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={saving} /><small style={{ color: "#64748b" }}>Full or partial payment, up to the balance.</small></div>
          <div className="pa-field"><label htmlFor="ledger-payment-method">Payment method</label><select id="ledger-payment-method" className="pa-input" value={method} onChange={(event) => setMethod(event.target.value)} required disabled={saving}><option value="">Select a method</option>{PAYMENT_METHODS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
          <div className="pa-field"><label htmlFor="ledger-payment-date">Payment date</label><input id="ledger-payment-date" className="pa-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={saving} /></div>
          <div className="pa-field"><label htmlFor="ledger-payment-reference">Bank / payment reference</label><input id="ledger-payment-reference" className="pa-input" maxLength={500} value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} /></div>
        </div>
        <div className="pa-field"><label htmlFor="ledger-payment-notes">Internal payment notes</label><textarea id="ledger-payment-notes" className="pa-input" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} /></div>
        <div className="pa-field"><label htmlFor="ledger-customer-note">Customer-facing invoice note (optional)</label><textarea id="ledger-customer-note" className="pa-input" rows={2} maxLength={2000} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} disabled={saving} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}><button type="button" className="pa-secondary-btn" onClick={() => setCurrentMode("history")} disabled={saving}>Payment history</button><button type="submit" className="pa-primary-btn" disabled={saving}>{saving ? "Recording…" : "Confirm and record payment"}</button></div>
      </form>}
      {currentMode === "record" && summary && outstanding <= 0 && <p>This invoice has no outstanding balance.</p>}
      {currentMode === "history" && !loading && <div style={{ overflowX: "auto" }}><table className="admin-table" style={{ minWidth: 760, width: "100%" }}><thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Method</th><th>Reference / Notes</th><th>Correction</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.payment_date || "Date not recorded"}<br /><small>{new Date(entry.created_at).toLocaleString("en-US", { timeZone: "America/Tegucigalpa" })}</small></td><td>{entry.entry_type === "REVERSAL" ? "Reversal" : entry.is_legacy ? "Imported legacy payment" : "Payment"}</td><td style={{ color: entry.entry_type === "REVERSAL" ? "#b45309" : "#166534", fontWeight: 700 }}>{entry.entry_type === "REVERSAL" ? "−" : ""}{money(entry.amount)}</td><td>{entry.method || "—"}</td><td>{entry.reference || "—"}{entry.notes && <small style={{ display: "block", whiteSpace: "pre-wrap" }}>{entry.notes}</small>}</td><td>{entry.entry_type === "PAYMENT" && (reversed.has(entry.id) ? <span>Reversed</span> : <button type="button" className="pa-secondary-btn" disabled={saving} onClick={() => { setReversing(entry); setReason(""); setReversalKey(crypto.randomUUID()); setError(null); }}>Record reversal</button>)}</td></tr>)}</tbody></table>{entries.length === 0 && <p style={{ color: "#64748b" }}>No payments have been recorded for this invoice.</p>}</div>}
      {reversing && <form onSubmit={recordReversal} style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #fcd34d", borderRadius: ".7rem", background: "#fffbeb" }}><strong>Reverse the payment of {money(reversing.amount)} received on {reversing.payment_date || "an unrecorded date"}?</strong><p style={{ color: "#78350f", fontSize: ".85rem" }}>This records a separate reversal for the full original amount. It does not edit or delete the payment.</p><div className="pa-field"><label htmlFor="ledger-reversal-reason">Reason for reversal</label><textarea id="ledger-reversal-reason" className="pa-input" rows={2} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} required disabled={saving} /></div><div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem" }}><button type="button" className="pa-secondary-btn" disabled={saving} onClick={() => setReversing(null)}>Cancel</button><button type="submit" className="pa-primary-btn" disabled={saving}>{saving ? "Recording…" : "Confirm and record reversal"}</button></div></form>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}><button type="button" className="pa-secondary-btn" onClick={onClose} disabled={saving}>Close</button></div>
    </div>
  </div>;
}
