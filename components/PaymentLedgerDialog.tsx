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
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers }, cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The payment request could not be completed.");
  return payload;
}

export default function PaymentLedgerDialog({ invoice, mode, onClose, onChanged, isEs = false, canReverse = true }: {
  invoice: InvoiceReference;
  mode: "record" | "history";
  onClose: () => void;
  onChanged: (summary: PaymentSummary) => void;
  isEs?: boolean;
  canReverse?: boolean;
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
      if (cents > Math.round(Number(summary.balance) * 100)) throw new Error(isEs ? "El pago no puede superar el saldo pendiente." : "The payment cannot exceed the outstanding balance.");
      if (!method) throw new Error(isEs ? "Seleccione un método de pago." : "Select a payment method.");
      if (!date) throw new Error(isEs ? "Seleccione la fecha de pago." : "Select the payment date.");
      setSaving(true);
      const payload = await requestLedger("/api/admin/payments", { method: "POST", body: JSON.stringify({ invoice_id: invoice.id, amount, method, reference, notes, payment_date: date, customer_invoice_note: customerNote, idempotency_key: paymentKey }) });
      setSummary(payload.invoice);
      onChanged(payload.invoice);
      setNotice(payload.replayed
        ? (isEs ? "Este pago ya estaba registrado; no se agregó un duplicado." : "This payment was already recorded; no duplicate was added.")
        : (isEs ? "Pago registrado. Este registro no se puede editar ni eliminar." : "Payment recorded. This entry cannot be edited or deleted."));
      setCurrentMode("history");
      await loadHistory();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (isEs ? "No se pudo registrar el pago. Reintente el mismo envío para evitar duplicados." : "Could not record payment. Retry the same submission to avoid duplicates."));
    } finally { setSaving(false); }
  };

  const recordReversal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reversing || saving) return;
    if (!reason.trim()) { setError(isEs ? "Se requiere un motivo para la reversión." : "A reason is required for a reversal."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = await requestLedger("/api/admin/payments", { method: "POST", body: JSON.stringify({ action: "reverse", payment_id: reversing.id, reason: reason.trim(), payment_date: date, idempotency_key: reversalKey }) });
      setSummary(payload.invoice);
      onChanged(payload.invoice);
      setReversing(null);
      setReason("");
      setNotice(isEs ? "Reversión registrada. El pago original permanece en el historial." : "Reversal recorded. The original payment remains in history.");
      await loadHistory();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (isEs ? "No se pudo registrar la reversión." : "Could not record the reversal."));
    } finally { setSaving(false); }
  };

  const reversed = new Set(entries.filter((entry) => entry.entry_type === "REVERSAL").map((entry) => entry.original_payment_id));
  const outstanding = Number(summary?.balance || 0);
  const text = isEs ? {
    record: "Registrar pago", history: "Historial de pagos", close: "Cerrar", customer: "Cliente", invoice: "Factura",
    immutable: "Los pagos registrados no se pueden editar ni eliminar. Para corregir un error, registre una reversión; el pago original permanece en el historial.",
    loading: "Cargando pagos guardados…", total: "Total", paid: "Pagado", balance: "Saldo",
    amount: "Monto recibido (USD)", fullOrPartial: "Pago total o parcial, hasta el saldo pendiente.", method: "Método de pago", selectMethod: "Seleccione un método",
    date: "Fecha de pago", reference: "Referencia bancaria / de pago", notes: "Notas internas del pago", customerNote: "Nota para el cliente (opcional)",
    historyButton: "Historial de pagos", confirm: "Confirmar y registrar pago", recording: "Registrando…", noBalance: "Esta factura no tiene saldo pendiente.",
    dateColumn: "Fecha", entryColumn: "Movimiento", amountColumn: "Monto", methodColumn: "Método", notesColumn: "Referencia / notas", correction: "Corrección",
    dateMissing: "Fecha no registrada", reversal: "Reversión", imported: "Pago anterior importado", payment: "Pago", reversed: "Revertido",
    recordReversal: "Registrar reversión", noPayments: "No hay pagos registrados para esta factura.",
    reverseQuestion: "¿Revertir el pago de", receivedOn: "recibido el", unrecordedDate: "una fecha no registrada", reversalWarning: "Esto registra una reversión separada por el monto total. No edita ni elimina el pago.",
    reason: "Motivo de la reversión", cancel: "Cancelar", confirmReversal: "Confirmar y registrar reversión",
  } : {
    record: "Record payment", history: "Payment history", close: "Close", customer: "Customer", invoice: "Invoice",
    immutable: "Recorded payments cannot be edited or deleted. Correct a mistake by recording a reversal; the original entry stays in history.",
    loading: "Loading saved payments…", total: "Total", paid: "Paid", balance: "Balance",
    amount: "Amount received (USD)", fullOrPartial: "Full or partial payment, up to the balance.", method: "Payment method", selectMethod: "Select a method",
    date: "Payment date", reference: "Bank / payment reference", notes: "Internal payment notes", customerNote: "Customer-facing invoice note (optional)",
    historyButton: "Payment history", confirm: "Confirm and record payment", recording: "Recording…", noBalance: "This invoice has no outstanding balance.",
    dateColumn: "Date", entryColumn: "Entry", amountColumn: "Amount", methodColumn: "Method", notesColumn: "Reference / Notes", correction: "Correction",
    dateMissing: "Date not recorded", reversal: "Reversal", imported: "Imported legacy payment", payment: "Payment", reversed: "Reversed",
    recordReversal: "Record reversal", noPayments: "No payments have been recorded for this invoice.",
    reverseQuestion: "Reverse the payment of", receivedOn: "received on", unrecordedDate: "an unrecorded date", reversalWarning: "This records a separate reversal for the full original amount. It does not edit or delete the payment.",
    reason: "Reason for reversal", cancel: "Cancel", confirmReversal: "Confirm and record reversal",
  };
  const paymentMethodLabel = (value: string) => isEs ? ({
    Cash: "Efectivo", "Bank Transfer": "Transferencia bancaria", Wire: "Transferencia", "Credit granted": "Crédito otorgado",
  } as Record<string, string>)[value] || value : value;

  return <div className="pa-modal-overlay">
    <div className="pa-modal" style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }} role="dialog" aria-modal="true" aria-labelledby="payment-ledger-title">
      <div className="pa-modal-header"><h2 id="payment-ledger-title" className="pa-modal-title">{currentMode === "record" ? text.record : text.history}</h2><button type="button" className="pa-close-btn" onClick={onClose} disabled={saving} aria-label={text.close}>×</button></div>
      <p style={{ color: "#475569", margin: "0 0 .8rem" }}>{invoice.clienteNombre || text.customer} {invoice.clienteNumero != null ? `(#${invoice.clienteNumero})` : ""} · {text.invoice} {invoice.tracking}</p>
      <p style={{ color: "#64748b", fontSize: ".86rem" }}>{text.immutable}</p>
      {loading && <p role="status">{text.loading}</p>}
      {error && <p role="alert" style={{ padding: ".75rem", background: "#fef2f2", color: "#991b1b", borderRadius: ".5rem" }}>{error}</p>}
      {notice && <p role="status" style={{ padding: ".75rem", background: "#f0fdf4", color: "#166534", borderRadius: ".5rem" }}>{notice}</p>}
      {summary && <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", padding: ".8rem 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", marginBottom: "1rem" }}><span>{text.total} <strong>{money(summary.billing_total)}</strong></span><span>{text.paid} <strong style={{ color: "#166534" }}>{money(summary.paid)}</strong></span><span>{text.balance} <strong style={{ color: outstanding > 0 ? "#b45309" : "#166534" }}>{money(summary.balance)}</strong></span></div>}
      {currentMode === "record" && summary && outstanding > 0 && <form onSubmit={recordPayment}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".8rem" }}>
          <div className="pa-field"><label htmlFor="ledger-payment-amount">{text.amount}</label><input id="ledger-payment-amount" className="pa-input" type="number" inputMode="decimal" min="0.01" max={outstanding} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required disabled={saving} /><small style={{ color: "#64748b" }}>{text.fullOrPartial}</small></div>
          <div className="pa-field"><label htmlFor="ledger-payment-method">{text.method}</label><select id="ledger-payment-method" className="pa-input" value={method} onChange={(event) => setMethod(event.target.value)} required disabled={saving}><option value="">{text.selectMethod}</option>{PAYMENT_METHODS.map((option) => <option key={option} value={option}>{paymentMethodLabel(option)}</option>)}</select></div>
          <div className="pa-field"><label htmlFor="ledger-payment-date">{text.date}</label><input id="ledger-payment-date" className="pa-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={saving} /></div>
          <div className="pa-field"><label htmlFor="ledger-payment-reference">{text.reference}</label><input id="ledger-payment-reference" className="pa-input" maxLength={500} value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving} /></div>
        </div>
        <div className="pa-field"><label htmlFor="ledger-payment-notes">{text.notes}</label><textarea id="ledger-payment-notes" className="pa-input" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} /></div>
        <div className="pa-field"><label htmlFor="ledger-customer-note">{text.customerNote}</label><textarea id="ledger-customer-note" className="pa-input" rows={2} maxLength={2000} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} disabled={saving} /></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1rem" }}><button type="button" className="pa-secondary-btn" onClick={() => setCurrentMode("history")} disabled={saving}>{text.historyButton}</button><button type="submit" className="pa-primary-btn" disabled={saving}>{saving ? text.recording : text.confirm}</button></div>
      </form>}
      {currentMode === "record" && summary && outstanding <= 0 && <p>{text.noBalance}</p>}
      {currentMode === "history" && !loading && <div style={{ overflowX: "auto" }}><table className="admin-table" style={{ minWidth: 760, width: "100%" }}><thead><tr><th>{text.dateColumn}</th><th>{text.entryColumn}</th><th>{text.amountColumn}</th><th>{text.methodColumn}</th><th>{text.notesColumn}</th><th>{text.correction}</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{entry.payment_date || text.dateMissing}<br /><small>{new Date(entry.created_at).toLocaleString(isEs ? "es-HN" : "en-US", { timeZone: "America/Tegucigalpa" })}</small></td><td>{entry.entry_type === "REVERSAL" ? text.reversal : entry.is_legacy ? text.imported : text.payment}</td><td style={{ color: entry.entry_type === "REVERSAL" ? "#b45309" : "#166534", fontWeight: 700 }}>{entry.entry_type === "REVERSAL" ? "−" : ""}{money(entry.amount)}</td><td>{entry.method ? paymentMethodLabel(entry.method) : "—"}</td><td>{entry.reference || "—"}{entry.notes && <small style={{ display: "block", whiteSpace: "pre-wrap" }}>{entry.notes}</small>}</td><td>{entry.entry_type === "PAYMENT" && (reversed.has(entry.id) ? <span>{text.reversed}</span> : canReverse ? <button type="button" className="pa-secondary-btn" disabled={saving} onClick={() => { setReversing(entry); setReason(""); setReversalKey(crypto.randomUUID()); setError(null); }}>{text.recordReversal}</button> : "—")}</td></tr>)}</tbody></table>{entries.length === 0 && <p style={{ color: "#64748b" }}>{text.noPayments}</p>}</div>}
      {canReverse && reversing && <form onSubmit={recordReversal} style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #fcd34d", borderRadius: ".7rem", background: "#fffbeb" }}><strong>{text.reverseQuestion} {money(reversing.amount)} {text.receivedOn} {reversing.payment_date || text.unrecordedDate}?</strong><p style={{ color: "#78350f", fontSize: ".85rem" }}>{text.reversalWarning}</p><div className="pa-field"><label htmlFor="ledger-reversal-reason">{text.reason}</label><textarea id="ledger-reversal-reason" className="pa-input" rows={2} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} required disabled={saving} /></div><div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem" }}><button type="button" className="pa-secondary-btn" disabled={saving} onClick={() => setReversing(null)}>{text.cancel}</button><button type="submit" className="pa-primary-btn" disabled={saving}>{saving ? text.recording : text.confirmReversal}</button></div></form>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}><button type="button" className="pa-secondary-btn" onClick={onClose} disabled={saving}>{text.close}</button></div>
    </div>
  </div>;
}
