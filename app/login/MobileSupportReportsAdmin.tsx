"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type SupportReport = {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  created_at: string;
  details: {
    report_message?: string;
    submitted_email?: string;
    source?: string;
  } | null;
};

function submittedAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tegucigalpa",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function hondurasDay(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export default function MobileSupportReportsAdmin() {
  const [reports, setReports] = useState<SupportReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your Admin session has expired. Sign in again to view support reports.");
      const response = await fetch("/api/admin/staff-action-logs?action=mobile_support_report&limit=500", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load mobile support reports.");
      setReports(Array.isArray(payload.logs) ? payload.logs : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load mobile support reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshNonce]);
  const todayKey = hondurasDay(new Date());
  const todayCount = reports.filter((report) => hondurasDay(report.created_at) === todayKey).length;

  return <section className="mobile-support-reports" aria-labelledby="mobile-support-reports-title">
    <style>{`
      .mobile-support-reports{display:grid;gap:12px;margin-top:18px;padding:16px;border:1px solid #d8e3ed;border-radius:12px;background:#f8fafc;color:#172b3a}
      .mobile-support-reports-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .mobile-support-reports-header h3{margin:0;color:#103b5c;font-size:1.05rem}
      .mobile-support-reports-header p{margin:4px 0 0;color:#64748b;font-size:.82rem}
      .mobile-support-reports-refresh{display:inline-flex;align-items:center;gap:6px;border:1px solid #b8c9d8;border-radius:8px;background:#fff;color:#103b5c;padding:7px 10px;font-weight:700;cursor:pointer}
      .mobile-support-reports-refresh:disabled{opacity:.55;cursor:wait}
      .mobile-support-report-list{display:grid;gap:9px}
      .mobile-support-report{display:grid;gap:8px;padding:12px;border:1px solid #dce5ec;border-radius:10px;background:#fff;min-width:0}
      .mobile-support-report-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .mobile-support-report-actor{font-weight:750;color:#173f64;overflow-wrap:anywhere}
      .mobile-support-report-meta{color:#64748b;font-size:.78rem;line-height:1.5;overflow-wrap:anywhere}
      .mobile-support-report-message{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5;color:#243746}
      .mobile-support-report-state{padding:14px;border-radius:9px;background:#fff;color:#64748b;text-align:center}
      .mobile-support-report-error{background:#fff1f2;color:#9f1239;text-align:left}
      @media(max-width:600px){.mobile-support-reports{padding:12px}.mobile-support-report-top{display:grid}}
    `}</style>
    <div className="mobile-support-reports-header">
      <div>
        <h3 id="mobile-support-reports-title">Mobile app support reports</h3>
        <p>{todayCount} submitted today · Showing {reports.length} recent mobile reports.</p>
      </div>
      <button className="mobile-support-reports-refresh" type="button" onClick={() => setRefreshNonce((value) => value + 1)} disabled={loading}>
        <RefreshCw size={15} aria-hidden="true" />{loading ? "Refreshing…" : "Refresh reports"}
      </button>
    </div>
    {error && <div className="mobile-support-report-state mobile-support-report-error" role="alert">{error} <button type="button" onClick={() => void load()}>Retry</button></div>}
    {loading && reports.length === 0 ? <div className="mobile-support-report-state" role="status">Loading mobile reports…</div> : !error && reports.length === 0 ? <div className="mobile-support-report-state">No mobile support reports have been submitted.</div> : reports.length > 0 && <div className="mobile-support-report-list">
      {reports.map((report) => {
        const details = report.details || {};
        return <article className="mobile-support-report" key={report.id}>
          <div className="mobile-support-report-top">
            <div>
              <div className="mobile-support-report-actor">{report.actor_name || report.actor_email || "Unknown user"}</div>
              <div className="mobile-support-report-meta">{[report.actor_email, report.actor_role, submittedAt(report.created_at)].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <p className="mobile-support-report-message">{details.report_message || "No report text was saved."}</p>
          {details.submitted_email && <div className="mobile-support-report-meta">Contact email provided: {details.submitted_email}</div>}
        </article>;
      })}
    </div>}
  </section>;
}
