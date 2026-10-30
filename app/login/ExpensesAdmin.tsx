"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  payee: string;
  amount: number | string;
  status: "PAID" | "UNPAID";
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  idempotency_key: string;
  voided: boolean;
  void_reason: string | null;
  voided_at: string | null;
};

type Metrics = {
  invoiced_income?: number | string;
  total_recorded_active_expenses?: number | string;
  net_invoiced_income?: number | string;
  known_cash_received?: number | string;
  unclassified_payments?: number | string;
  paid_expenses_cash?: number | string;
  paid_expenses_non_cash?: number | string;
  unpaid_expenses?: number | string;
  net_cashflow?: number | string;
};

type Lang = "en" | "es";
type FormState = { expense_date: string; category: string; payee: string; amount: string; status: "PAID" | "UNPAID"; payment_method: string; notes: string };

const PAYMENT_METHODS = ["Zelle", "PayPal", "Cash", "Bank Transfer", "Wire", "Credit granted"];
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const initialForm = (): FormState => ({ expense_date: today(), category: "", payee: "", amount: "", status: "PAID", payment_method: "Cash", notes: "" });
const MONEY_FIELDS: Array<[keyof Metrics, string, string]> = [
  ["invoiced_income", "Invoiced income", "Ingresos facturados"],
  ["total_recorded_active_expenses", "Active expenses", "Gastos activos"],
  ["net_invoiced_income", "Net invoiced income", "Ingreso neto facturado"],
  ["known_cash_received", "Known cash received", "Efectivo recibido conocido"],
  ["unclassified_payments", "Unclassified payments", "Pagos sin clasificar"],
  ["paid_expenses_cash", "Paid in cash", "Pagado en efectivo"],
  ["paid_expenses_non_cash", "Paid non-cash", "Pagado sin efectivo"],
  ["unpaid_expenses", "Unpaid expenses", "Gastos pendientes"],
  ["net_cashflow", "Net cash flow", "Flujo neto de efectivo"],
];

const COPY = {
  en: {
    title: "Admin expenses", subtitle: "Append-only expense register. Entries can only be voided with a reason.",
    loading: "Loading expenses…", retry: "Retry", language: "Español", addTitle: "Record an expense", date: "Date", category: "Category", payee: "Payee", amount: "Amount (USD)", status: "Status", paid: "Paid", unpaid: "Unpaid", method: "Payment method", notes: "Notes", optional: "Optional", save: "Record expense", saving: "Recording…", entries: "Expense entries", allEntries: "{n} total", empty: "No expenses recorded yet.", prev: "Previous", next: "Next", page: "Page {n}", void: "Void", voided: "Voided", reason: "Void reason", reasonHelp: "This is permanently recorded; existing entries cannot be edited or deleted.", cancel: "Cancel", confirmVoid: "Void expense", voiding: "Voiding…", actions: "Actions", dateCol: "Date", amountCol: "Amount", methodCol: "Payment", notesCol: "Notes", statusCol: "Status", payeeCol: "Payee", categoryCol: "Category", required: "Complete the required fields.", session: "Your admin session has expired.", unknown: "The request could not be completed. Try again.", done: "Expense recorded.", voidDone: "Expense voided.", pagination: "Showing {from}–{to} of {total}",
  },
  es: {
    title: "Gastos de administración", subtitle: "Registro de gastos de solo anexado. Las entradas solo se pueden anular con un motivo.",
    loading: "Cargando gastos…", retry: "Reintentar", language: "English", addTitle: "Registrar un gasto", date: "Fecha", category: "Categoría", payee: "Beneficiario", amount: "Importe (USD)", status: "Estado", paid: "Pagado", unpaid: "Pendiente", method: "Método de pago", notes: "Notas", optional: "Opcional", save: "Registrar gasto", saving: "Registrando…", entries: "Entradas de gastos", allEntries: "{n} en total", empty: "Aún no hay gastos registrados.", prev: "Anterior", next: "Siguiente", page: "Página {n}", void: "Anular", voided: "Anulado", reason: "Motivo de anulación", reasonHelp: "Se registra de forma permanente; las entradas existentes no se pueden editar ni eliminar.", cancel: "Cancelar", confirmVoid: "Anular gasto", voiding: "Anulando…", actions: "Acciones", dateCol: "Fecha", amountCol: "Importe", methodCol: "Pago", notesCol: "Notas", statusCol: "Estado", payeeCol: "Beneficiario", categoryCol: "Categoría", required: "Complete los campos obligatorios.", session: "La sesión de administrador venció.", unknown: "No se pudo completar la solicitud. Inténtelo de nuevo.", done: "Gasto registrado.", voidDone: "Gasto anulado.", pagination: "Mostrando {from}–{to} de {total}",
  },
} as const;

const ERROR_COPY: Record<string, [string, string]> = {
  AUTHENTICATION_REQUIRED: ["Please sign in to continue.", "Inicie sesión para continuar."],
  INVALID_AUTHENTICATION: ["Your session is invalid or expired.", "La sesión no es válida o venció."],
  ADMIN_ACCESS_REQUIRED: ["Administrator access is required.", "Se requiere acceso de administrador."],
  INVALID_EXPENSE_DATE: ["Enter a valid expense date.", "Ingrese una fecha válida."],
  INVALID_CATEGORY: ["Enter a category (up to 120 characters).", "Ingrese una categoría (hasta 120 caracteres)."],
  INVALID_PAYEE: ["Enter a payee (up to 240 characters).", "Ingrese un beneficiario (hasta 240 caracteres)."],
  INVALID_NOTES: ["Notes must be 2,000 characters or fewer.", "Las notas no pueden superar 2,000 caracteres."],
  INVALID_EXPENSE_AMOUNT: ["Enter a positive amount with up to two decimal places.", "Ingrese un importe positivo con hasta dos decimales."],
  INVALID_EXPENSE_STATUS: ["Choose paid or unpaid status.", "Elija pagado o pendiente."],
  INVALID_EXPENSE_PAYMENT_METHOD: ["Choose a valid payment method.", "Elija un método de pago válido."],
  VOID_REASON_REQUIRED: ["Enter a reason to void this expense.", "Ingrese un motivo para anular este gasto."],
  INVALID_VOID_REASON: ["Enter a reason (up to 2,000 characters).", "Ingrese un motivo (hasta 2,000 caracteres)."],
  EXPENSE_ALREADY_VOIDED: ["This expense has already been voided.", "Este gasto ya fue anulado."],
  EXPENSE_NOT_FOUND: ["The expense could not be found.", "No se encontró el gasto."],
  IDEMPOTENCY_CONFLICT: ["This request conflicts with an earlier submission.", "La solicitud entra en conflicto con un envío anterior."],
};

function money(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number.isFinite(number) ? number : 0);
}
function dateLabel(value: string, lang: Lang) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(lang === "es" ? "es" : "en", { year: "numeric", month: "short", day: "numeric" }).format(parsed);
}
function errorMessage(payload: { error?: string; code?: string }, lang: Lang) {
  const translated = payload.code ? ERROR_COPY[payload.code] : undefined;
  return translated?.[lang === "en" ? 0 : 1] || payload.error || COPY[lang].unknown;
}

export default function ExpensesAdmin() {
  const [lang, setLang] = useState<Lang>("en");
  const [entries, setEntries] = useState<Expense[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const pageSize = 25;
  const copy = COPY[lang];

  const authorizedFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error(copy.session);
    const response = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(errorMessage(payload, lang));
    return payload;
  }, [copy.session, lang]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await authorizedFetch(`/api/admin/expenses?limit=${pageSize}&offset=${offset}`);
      setEntries(payload.entries || []);
      setTotal(Number(payload.totalCount || 0));
      setMetrics(payload.metrics || {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : COPY[lang].unknown);
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, lang, offset]);

  useEffect(() => { void load(); }, [load]);

  const updateForm = (key: keyof FormState, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const metricCards = useMemo(() => MONEY_FIELDS.map(([key, english, spanish]) => ({
    label: lang === "en" ? english : spanish,
    value: money(metrics[key]),
    key,
  })), [lang, metrics]);

  async function record(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.expense_date || !form.category.trim() || !form.payee.trim() || !form.amount || (form.status === "PAID" && !form.payment_method)) {
      setError(copy.required);
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await authorizedFetch("/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({ action: "record", ...form, payment_method: form.status === "PAID" ? form.payment_method : null, idempotency_key: crypto.randomUUID() }),
      });
      setForm(initialForm());
      setOffset(0);
      setNotice(copy.done);
      if (offset !== 0) setOffset(0); else await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.unknown);
    } finally { setBusy(false); }
  }

  async function voidExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!voidTarget || !voidReason.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await authorizedFetch("/api/admin/expenses", {
        method: "POST",
        body: JSON.stringify({ action: "void", expense_id: voidTarget.id, reason: voidReason.trim(), idempotency_key: crypto.randomUUID() }),
      });
      setVoidTarget(null); setVoidReason(""); setNotice(copy.voidDone); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.unknown);
    } finally { setBusy(false); }
  }

  return (
    <section className="expenses-admin" aria-labelledby="expenses-title">
      <style>{`
        .expenses-admin{--navy:#103b5c;--blue:#0f4c81;--ink:#172b3a;--muted:#64748b;--line:#dce5ec;display:grid;gap:16px;color:var(--ink)}
        .expense-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.expense-head h1{margin:0;color:var(--navy);font-size:1.35rem}.expense-head p{margin:5px 0 0;color:var(--muted);font-size:.84rem;max-width:650px}
        .expense-lang{border:1px solid var(--line);border-radius:8px;background:#fff;padding:7px 10px;color:var(--blue);font-weight:700;cursor:pointer;white-space:nowrap}
        .expense-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.expense-metric{border:1px solid var(--line);border-radius:10px;background:#f8fafc;padding:11px 12px;min-width:0}.expense-metric strong{display:block;color:var(--blue);font-size:1.08rem;overflow:hidden;text-overflow:ellipsis}.expense-metric span{display:block;margin-top:3px;color:var(--muted);font-size:.76rem}
        .expense-panel{border:1px solid var(--line);border-radius:12px;background:#fff;padding:15px}.expense-panel h2{margin:0 0 12px;color:var(--navy);font-size:1rem}.expense-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.expense-field{display:grid;gap:5px;min-width:0}.expense-field label{font-size:.77rem;font-weight:700;color:#405567}.expense-field input,.expense-field select,.expense-field textarea{width:100%;min-height:38px;box-sizing:border-box;border:1px solid #cad6df;border-radius:8px;background:#fff;padding:8px 10px;color:var(--ink);font:inherit;font-size:.86rem}.expense-field textarea{resize:vertical;min-height:38px}.expense-span-2{grid-column:span 2}.expense-span-4{grid-column:span 4}.expense-button{border:0;border-radius:8px;background:var(--blue);color:#fff;padding:9px 13px;font-weight:750;cursor:pointer}.expense-button:disabled{opacity:.6;cursor:not-allowed}.expense-button.secondary{background:#e9eff4;color:var(--ink)}.expense-button.danger{background:#a52d2d;padding:6px 9px;font-size:.78rem}.expense-submit{justify-self:start}
        .expense-notice,.expense-error{border-radius:9px;padding:10px 12px;font-size:.86rem}.expense-notice{background:#effaf3;color:#166534}.expense-error{background:#fef2f2;color:#991b1b}
        .expense-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px}.expense-table{width:100%;min-width:1050px;border-collapse:collapse;font-size:.82rem}.expense-table th,.expense-table td{padding:9px 10px;border-bottom:1px solid #e9eef2;text-align:left;vertical-align:top}.expense-table th{background:#f7fafc;color:#4d6272;text-transform:uppercase;letter-spacing:.035em;font-size:.69rem;white-space:nowrap}.expense-table tr:last-child td{border-bottom:0}.expense-status{display:inline-block;border-radius:999px;padding:3px 8px;background:#e8f5ee;color:#21623c;font-size:.72rem;font-weight:750;white-space:nowrap}.expense-status.unpaid{background:#fff4dd;color:#875b00}.expense-status.voided{background:#fce8e8;color:#a12d2d}.expense-muted{color:var(--muted);font-size:.78rem;margin-top:4px;max-width:240px;white-space:pre-wrap}.expense-pagination{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:11px;color:var(--muted);font-size:.8rem}.expense-pagination-controls{display:flex;gap:7px}.expense-empty,.expense-loading{padding:24px;text-align:center;color:var(--muted)}
        .expense-modal-backdrop{position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.52);display:grid;place-items:center;padding:18px}.expense-modal{width:min(440px,100%);border-radius:14px;background:#fff;padding:19px;box-shadow:0 20px 60px rgba(15,23,42,.25)}.expense-modal h2{margin:0 0 6px;color:var(--navy);font-size:1.05rem}.expense-modal p{font-size:.83rem;color:var(--muted);line-height:1.5}.expense-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
        @media(max-width:850px){.expense-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.expense-form{grid-template-columns:repeat(2,minmax(0,1fr))}.expense-span-4{grid-column:span 2}}
        @media(max-width:520px){.expense-head h1{font-size:1.18rem}.expense-panel{padding:11px}.expense-metrics{gap:7px}.expense-metric{padding:9px}.expense-metric strong{font-size:.98rem}.expense-pagination{align-items:flex-start;flex-direction:column}}
      `}</style>

      <header className="expense-head">
        <div><h1 id="expenses-title">{copy.title}</h1><p>{copy.subtitle}</p></div>
        <button className="expense-lang" type="button" onClick={() => setLang((value) => value === "en" ? "es" : "en")}>{copy.language}</button>
      </header>

      {error && <div className="expense-error" role="alert">{error} <button className="expense-button secondary" type="button" onClick={() => void load()}>{copy.retry}</button></div>}
      {notice && <div className="expense-notice" role="status">{notice}</div>}

      <div className="expense-metrics" aria-label={lang === "en" ? "Expense metrics" : "Métricas de gastos"}>
        {metricCards.map((metric) => <div className="expense-metric" key={metric.key}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
      </div>

      <section className="expense-panel">
        <h2>{copy.addTitle}</h2>
        <form className="expense-form" onSubmit={record}>
          <div className="expense-field"><label htmlFor="expense-date">{copy.date}</label><input id="expense-date" type="date" required value={form.expense_date} onChange={(event) => updateForm("expense_date", event.target.value)} /></div>
          <div className="expense-field"><label htmlFor="expense-category">{copy.category}</label><input id="expense-category" maxLength={120} required value={form.category} onChange={(event) => updateForm("category", event.target.value)} /></div>
          <div className="expense-field"><label htmlFor="expense-payee">{copy.payee}</label><input id="expense-payee" maxLength={240} required value={form.payee} onChange={(event) => updateForm("payee", event.target.value)} /></div>
          <div className="expense-field"><label htmlFor="expense-amount">{copy.amount}</label><input id="expense-amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} /></div>
          <div className="expense-field"><label htmlFor="expense-status">{copy.status}</label><select id="expense-status" value={form.status} onChange={(event) => setForm((state) => ({ ...state, status: event.target.value as FormState["status"], payment_method: event.target.value === "PAID" ? state.payment_method || "Cash" : "" }))}><option value="PAID">{copy.paid}</option><option value="UNPAID">{copy.unpaid}</option></select></div>
          <div className="expense-field"><label htmlFor="expense-method">{copy.method}</label><select id="expense-method" value={form.payment_method} disabled={form.status === "UNPAID"} required={form.status === "PAID"} onChange={(event) => updateForm("payment_method", event.target.value)}><option value="">—</option>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></div>
          <div className="expense-field expense-span-2"><label htmlFor="expense-notes">{copy.notes} <span style={{ fontWeight: 400 }}>({copy.optional})</span></label><input id="expense-notes" maxLength={2000} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} /></div>
          <div className="expense-span-4"><button className="expense-button expense-submit" disabled={busy} type="submit">{busy ? copy.saving : copy.save}</button></div>
        </form>
      </section>

      <section className="expense-panel">
        <h2>{copy.entries} <span style={{ color: "#64748b", fontSize: ".78rem", fontWeight: 500 }}>{copy.allEntries.replace("{n}", String(total))}</span></h2>
        {loading ? <div className="expense-loading">{copy.loading}</div> : entries.length === 0 ? <div className="expense-empty">{copy.empty}</div> : <>
          <div className="expense-table-wrap"><table className="expense-table">
            <thead><tr><th>{copy.dateCol}</th><th>{copy.categoryCol}</th><th>{copy.payeeCol}</th><th>{copy.amountCol}</th><th>{copy.statusCol}</th><th>{copy.methodCol}</th><th>{copy.notesCol}</th><th>{copy.actions}</th></tr></thead>
            <tbody>{entries.map((entry) => <tr key={entry.id}>
              <td>{dateLabel(entry.expense_date, lang)}</td><td>{entry.category}</td><td>{entry.payee}</td><td><strong>{money(entry.amount)}</strong></td>
              <td><span className={`expense-status ${entry.voided ? "voided" : entry.status === "UNPAID" ? "unpaid" : ""}`}>{entry.voided ? copy.voided : entry.status === "PAID" ? copy.paid : copy.unpaid}</span>{entry.void_reason && <div className="expense-muted">{entry.void_reason}</div>}</td>
              <td>{entry.payment_method || "—"}</td><td>{entry.notes || "—"}</td>
              <td>{entry.voided ? "—" : <button className="expense-button danger" type="button" disabled={busy} onClick={() => { setVoidTarget(entry); setVoidReason(""); }}>{copy.void}</button>}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="expense-pagination"><span>{copy.pagination.replace("{from}", String(offset + 1)).replace("{to}", String(Math.min(offset + entries.length, total))).replace("{total}", String(total))}</span><div className="expense-pagination-controls"><button className="expense-button secondary" type="button" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>{copy.prev}</button><span style={{ padding: "9px 2px" }}>{copy.page.replace("{n}", String(Math.floor(offset / pageSize) + 1))}</span><button className="expense-button secondary" type="button" disabled={offset + entries.length >= total || loading} onClick={() => setOffset((value) => value + pageSize)}>{copy.next}</button></div></div>
        </>}
      </section>

      {voidTarget && <div className="expense-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setVoidTarget(null); }}>
        <form className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-void-title" onSubmit={voidExpense}>
          <h2 id="expense-void-title">{copy.confirmVoid}</h2>
          <p><strong>{voidTarget.payee}</strong> · {money(voidTarget.amount)}<br />{copy.reasonHelp}</p>
          <div className="expense-field"><label htmlFor="expense-void-reason">{copy.reason}</label><textarea id="expense-void-reason" required maxLength={2000} rows={3} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} autoFocus /></div>
          <div className="expense-modal-actions"><button className="expense-button secondary" type="button" disabled={busy} onClick={() => setVoidTarget(null)}>{copy.cancel}</button><button className="expense-button danger" type="submit" disabled={busy || !voidReason.trim()}>{busy ? copy.voiding : copy.confirmVoid}</button></div>
        </form>
      </div>}
    </section>
  );
}
