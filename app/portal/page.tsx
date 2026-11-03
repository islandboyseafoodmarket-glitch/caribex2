"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Archive, Box, CheckCircle2, ChevronRight, CircleHelp, Download, FileText, KeyRound, LogOut, MapPin, PackageCheck, Search, Ship, UserRound, Warehouse } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { PORTAL_COPY, readPortalLanguage, savePortalLanguage, type PortalLanguage } from "./portal-copy";

type PortalShipment = {
  id: string;
  tracking: string | null;
  nombre_paqueteria: string | null;
  tipo_paquete: string | null;
  contenido?: string | null;
  estado: string | null;
  hora_fecha: string | null;
  fecha_transito?: string | null;
  fecha_descargado?: string | null;
  fecha_entregado?: string | null;
  hora_entregado?: string | null;
  registro?: string | null;
  cubic_feet?: number | null;
  prepaid_review_required?: boolean | null;
  prepaid_review_status?: string | null;
};

type PortalInvoice = {
  id: string;
  tracking: string | null;
  nombre_paqueteria?: string | null;
  tipo_paquete?: string | null;
  contenido?: string | null;
  billing_subtotal: number | null;
  billing_tax: number | null;
  billing_total: number | null;
  approval_status?: string | null;
  invoice_status?: string | null;
  payment_method?: string | null;
  payment_date?: string | null;
  registro?: string | null;
  creado_en?: string | null;
};

type PortalData = {
  client: {
    nombre: string;
    numero_cliente: number;
    email: string;
    telefono: string | null;
    puerto: string | null;
    tipo_cuenta: string | null;
    prepaid_allowance_cubic_feet?: number | null;
    prepaid_used_cubic_feet?: number | null;
  };
  packages: PortalShipment[];
  invoices: PortalInvoice[];
  ferry: Array<{ id: string; puerto: string | null; numero_reserva: string | null; nombre_receptor: string | null; enviado_en: string | null }>;
};

type StageKey = "ready" | "transit" | "checkedIn" | "received" | "pickedUp" | "other";
type PortalSection = "packages" | "history" | "pickedUp" | "invoices" | "receipts" | "account" | "ferry";
type LookupResult = { found: boolean; onAccount?: boolean; status?: string | null; lastScannedAt?: string | null };

function normalizedStatus(value: unknown) {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function classifyShipment(status: unknown): StageKey {
  const value = normalizedStatus(status);
  if (value.includes("entregado") || value.includes("recogido") || value.includes("picked up")) return "pickedUp";
  if (value.includes("descargado") || value === "ready for pickup") return "ready";
  if (value.includes("transito") || value.includes("in transit")) return "transit";
  if (value.includes("registrado") || value.includes("check in") || value.includes("check-in") || value.includes("checked in")) return "checkedIn";
  if (value.includes("recibido") || value.includes("received")) return "received";
  return "other";
}

function formatPortalDate(value: string | null | undefined, language: PortalLanguage, includeTime = false) {
  if (!value) return "—";
  const raw = String(value);
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00-06:00` : raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  const options: Intl.DateTimeFormatOptions = includeTime
    ? { timeZone: "America/Tegucigalpa", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { timeZone: "America/Tegucigalpa", year: "numeric", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(language === "es" ? "es-HN" : "en-US", options).format(parsed);
}

function isPaid(invoice: PortalInvoice) {
  return String(invoice.invoice_status || "").trim().toUpperCase() === "PAID";
}

function LanguageToggle({ language, onChange, label }: { language: PortalLanguage; onChange: (value: PortalLanguage) => void; label: string }) {
  return (
    <div className="portal-language-toggle" role="group" aria-label={label}>
      <button type="button" className={language === "en" ? "is-active" : ""} aria-pressed={language === "en"} onClick={() => onChange("en")}>EN</button>
      <span aria-hidden="true">|</span>
      <button type="button" className={language === "es" ? "is-active" : ""} aria-pressed={language === "es"} onClick={() => onChange("es")}>ES</button>
    </div>
  );
}

export default function CustomerPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [language, setLanguage] = useState<PortalLanguage>("en");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [activeSection, setActiveSection] = useState<PortalSection>("packages");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PortalInvoice | null>(null);
  const [receiptDownloadId, setReceiptDownloadId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [prepaidReportLoading, setPrepaidReportLoading] = useState(false);
  const [prepaidReportError, setPrepaidReportError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<"shipment-report" | null>(null);
  const t = PORTAL_COPY[language];

  async function loadPortal() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/portal/login";
      return;
    }
    setMustChangePassword(Boolean(sessionData.session.user.user_metadata?.must_change_password));
    const response = await fetch("/api/customer-portal", {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok) setError(body.error || t.portalUnavailable);
    else {
      setData(body);
      setError(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    setLanguage(readPortalLanguage());
    const hash = window.location.hash;
    const recoveryLink = hash.includes("type=recovery") || hash.includes("access_token=");
    if (recoveryLink) {
      setRecoveryMode(true);
      void supabase.auth.getSession().then(({ data: sessionData }) => {
        if (sessionData.session) setLoading(false);
      });
    } else {
      void loadPortal();
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!pendingAnchor || activeSection !== "packages") return;
    const timer = window.setTimeout(() => {
      document.getElementById(pendingAnchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingAnchor(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeSection, pendingAnchor]);

  useEffect(() => {
    if (data && !selectedReceipt) setSelectedReceipt(data.invoices.find(isPaid) || null);
  }, [data, selectedReceipt]);

  useEffect(() => {
    if (!printMode) return;
    const afterPrint = () => setPrintMode(null);
    window.addEventListener("afterprint", afterPrint);
    const timer = window.setTimeout(() => window.print(), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [printMode]);

  const changeLanguage = (next: PortalLanguage) => {
    setLanguage(next);
    savePortalLanguage(next);
  };

  const changePassword = async () => {
    if (newPassword.length < 8) { setError(t.passwordMin); return; }
    setChanging(true);
    setError(null);
    setMessage(null);
    const { error: changeError } = await supabase.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (changeError) {
      setError(t.passwordError);
      return;
    }
    await supabase.auth.updateUser({ data: { must_change_password: false } });
    setMustChangePassword(false);
    setNewPassword("");
    setMessage(t.passwordUpdated);
    if (recoveryMode) {
      setRecoveryMode(false);
      await loadPortal();
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/portal/login";
  };

  const groups = useMemo(() => {
    const result: Record<StageKey, PortalShipment[]> = { ready: [], transit: [], checkedIn: [], received: [], pickedUp: [], other: [] };
    for (const shipment of data?.packages || []) result[classifyShipment(shipment.estado)].push(shipment);
    return result;
  }, [data]);

  const paidReceipts = useMemo(() => (data?.invoices || [])
    .filter(isPaid)
    .sort((a, b) => new Date(b.payment_date || b.creado_en || b.registro || 0).getTime() - new Date(a.payment_date || a.creado_en || a.registro || 0).getTime()), [data]);

  const isDeveloper = data?.client.tipo_cuenta === "Developer / Builder — Prepaid";
  const normalizedPort = String(data?.client.puerto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
  const isRoatan = normalizedPort === "roatan";
  const allowance = isDeveloper ? Number(data?.client.prepaid_allowance_cubic_feet || 0) : 0;
  const usedAllowance = isDeveloper ? Number(data?.client.prepaid_used_cubic_feet || 0) : 0;
  const remainingAllowance = Math.max(0, allowance - usedAllowance);
  const pendingPrepaidReviews = isDeveloper ? (data?.packages.filter((item) => item.prepaid_review_required && item.prepaid_review_status !== "APPROVED").length || 0) : 0;

  const stageLabel = (key: StageKey) => ({
    ready: t.readyForPickup,
    transit: t.inTransit,
    checkedIn: t.checkedIn,
    received: t.receivedFlorida,
    pickedUp: t.pickedUp,
    other: t.otherStage,
  }[key]);

  const packageStatusLabel = (status: string | null) => {
    const stage = classifyShipment(status);
    return stage === "other" ? status || t.pending : stageLabel(stage);
  };

  const invoiceStatusLabel = (invoice: PortalInvoice) => {
    const status = String(invoice.invoice_status || invoice.approval_status || "PENDING").trim().toUpperCase();
    if (status === "PAID") return t.paid;
    if (status === "SENT") return t.sent;
    if (status === "OVERDUE") return t.overdue;
    return t.pending;
  };

  const formatMoney = (value: number | null | undefined) => new Intl.NumberFormat(language === "es" ? "es-HN" : "en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  const dateLabel = (value: string | null | undefined, includeTime = false) => formatPortalDate(value, language, includeTime);

  const navigate = (section: PortalSection) => {
    setActiveSection(section);
    setPendingAnchor(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateToStage = (stage: StageKey) => {
    const anchor = `portal-stage-${stage}`;
    setActiveSection("packages");
    setPendingAnchor(anchor);
  };

  const submitTrackingSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const exactTracking = trackingInput.trim();
    if (!exactTracking) {
      setLookupError(t.exactTrackingHelp);
      setLookupResult(null);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        window.location.href = "/portal/login";
        return;
      }
      const response = await fetch("/api/customer-portal/tracking-lookup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tracking: exactTracking }),
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t.searchError);
      setLookupResult(body as LookupResult);
    } catch {
      setLookupError(t.searchError);
    } finally {
      setLookupLoading(false);
    }
  };

  const downloadPrepaidReport = async () => {
    if (!isDeveloper) return;
    setPrepaidReportLoading(true);
    setPrepaidReportError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("no-session");
      const response = await fetch("/api/customer-portal/prepaid-usage-report", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("download-failed");
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `caribex-prepaid-usage-${data?.client.numero_cliente || "account"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setPrepaidReportError(t.reportDownloadError);
    } finally {
      setPrepaidReportLoading(false);
    }
  };

  const downloadReceiptPdf = async (invoice: PortalInvoice) => {
    if (!data || !isPaid(invoice)) return;
    setReceiptDownloadId(invoice.id);
    setReceiptError(null);
    try {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([612, 792]);
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const dark = rgb(0.07, 0.13, 0.22);
      const muted = rgb(0.35, 0.41, 0.49);
      const blue = rgb(0.06, 0.30, 0.52);
      const line = rgb(0.82, 0.87, 0.92);
      let y = 742;
      try {
        const logoResponse = await fetch("/imagenes/logo-pages.png");
        if (logoResponse.ok) {
          const logo = await pdf.embedPng(await logoResponse.arrayBuffer());
          const scale = Math.min(118 / logo.width, 54 / logo.height);
          page.drawImage(logo, { x: 46, y: y - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
        }
      } catch {
        // Continue with the written CARIBEX LOGISTICS GROUP brand if the logo is unavailable.
      }
      page.drawText("CARIBEX LOGISTICS GROUP", { x: 190, y: 743, size: 13, font: bold, color: blue });
      page.drawText(language === "es" ? "RECIBO DE PAGO" : "PAID RECEIPT", { x: 190, y: 722, size: 11, font: bold, color: dark });
      page.drawLine({ start: { x: 46, y: 684 }, end: { x: 566, y: 684 }, thickness: 1.5, color: blue });
      y = 654;
      const safeText = (value: unknown) => String(value ?? "—").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "-").replace(/\s+/g, " ").slice(0, 82);
      const drawField = (label: string, value: unknown) => {
        page.drawText(safeText(label), { x: 48, y, size: 10, font: bold, color: muted });
        page.drawText(safeText(value), { x: 205, y, size: 10, font: regular, color: dark });
        y -= 27;
      };
      drawField(language === "es" ? "Cliente" : "Customer", data.client.nombre);
      drawField(language === "es" ? "Cuenta Caribex" : "Caribex account", `#${data.client.numero_cliente}`);
      drawField(language === "es" ? "Fecha de pago" : "Payment date", dateLabel(invoice.payment_date || invoice.creado_en || invoice.registro));
      drawField(language === "es" ? "Número de rastreo" : "Tracking number", invoice.tracking || t.shipment);
      drawField(language === "es" ? "Transportista" : "Carrier", invoice.nombre_paqueteria || t.carrierPending);
      drawField(language === "es" ? "Tipo de paquete" : "Package type", invoice.tipo_paquete || t.shipment);
      if (invoice.payment_method) drawField(t.paymentMethod, invoice.payment_method);
      y -= 2;
      page.drawLine({ start: { x: 46, y }, end: { x: 566, y }, thickness: 0.8, color: line });
      y -= 26;
      drawField(t.subtotal, formatMoney(invoice.billing_subtotal));
      drawField(t.tax, formatMoney(invoice.billing_tax));
      y -= 2;
      page.drawLine({ start: { x: 46, y }, end: { x: 566, y }, thickness: 1, color: line });
      y -= 30;
      page.drawText(t.total, { x: 48, y, size: 13, font: bold, color: dark });
      page.drawText(formatMoney(invoice.billing_total), { x: 445, y, size: 15, font: bold, color: blue });
      y -= 36;
      page.drawText(`${language === "es" ? "Estado" : "Status"}: ${t.paid}`, { x: 48, y, size: 10, font: bold, color: rgb(0.08, 0.42, 0.26) });
      page.drawText("CARIBEX LOGISTICS GROUP", { x: 48, y: 42, size: 8, font: regular, color: muted });
      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const reference = String(invoice.tracking || invoice.id).replace(/[^a-z0-9_-]/gi, "-").slice(0, 60);
      link.href = url;
      link.download = `caribex-receipt-${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setReceiptError(t.receiptDownloadError);
    } finally {
      setReceiptDownloadId(null);
    }
  };

  if (loading) {
    return <main className="portal-page portal-centered" lang={language}><section className="portal-loading-card"><Image src="/imagenes/logo-pages.png" alt={t.brand} width={220} height={94} /><LanguageToggle language={language} onChange={changeLanguage} label={t.languageLabel} /><p>{t.loading}</p></section></main>;
  }

  if (recoveryMode) {
    return <main className="portal-page portal-centered" lang={language}><section className="portal-card portal-first-login"><div className="portal-reset-top"><Image src="/imagenes/logo-pages.png" alt={t.brand} width={220} height={94} /><LanguageToggle language={language} onChange={changeLanguage} label={t.languageLabel} /></div><h1>{t.resetTitle}</h1><p>{t.resetDescription}</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t.newPassword} autoComplete="new-password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? t.saving : t.saveNewPassword}</button></div>{error && <small className="portal-error">{error}</small>}{message && <small className="portal-success">{message}</small>}</section></main>;
  }

  if (error || !data) {
    return <main className="portal-page portal-centered" lang={language}><section className="portal-card portal-first-login"><div className="portal-reset-top"><Image src="/imagenes/logo-pages.png" alt={t.brand} width={220} height={94} /><LanguageToggle language={language} onChange={changeLanguage} label={t.languageLabel} /></div><h1>{t.portalUnavailable}</h1><p>{error || t.signInAgain}</p><Link href="/portal/login" className="portal-button">{t.backToLogin}</Link></section></main>;
  }

  const packageRow = (item: PortalShipment) => (
    <div className="portal-row" key={item.id}>
      <div className="portal-row-main">
        <strong>{item.tracking || t.shipment}</strong>
        <span>{item.nombre_paqueteria || t.carrierPending} · {item.tipo_paquete || item.contenido || t.shipment}</span>
        {item.hora_fecha && <small>{t.received}: {dateLabel(item.hora_fecha, true)}</small>}
      </div>
      <span className="portal-status">{packageStatusLabel(item.estado)}</span>
    </div>
  );

  const stageCard = (stage: Exclude<StageKey, "pickedUp" | "other">, icon: React.ReactNode) => (
    <button type="button" className="portal-stage-card" onClick={() => navigateToStage(stage)} aria-controls={`portal-stage-${stage}`}>
      <span className="portal-stage-icon">{icon}</span>
      <span className="portal-stage-count">{groups[stage].length}</span>
      <span className="portal-stage-label">{stageLabel(stage)}</span>
      <span className="portal-stage-view">{t.view} <ChevronRight size={16} /></span>
      <ChevronRight className="portal-stage-arrow" size={17} aria-hidden="true" />
    </button>
  );

  const navButton = (section: PortalSection, label: string, icon: React.ReactNode, count?: number) => (
    <button type="button" className={`portal-nav-item ${activeSection === section ? "is-active" : ""}`} onClick={() => navigate(section)} aria-current={activeSection === section ? "page" : undefined}>
      {icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}
    </button>
  );

  const invoiceRow = (invoice: PortalInvoice) => (
    <div className="portal-row portal-invoice-row" key={invoice.id}>
      <div className="portal-row-main">
        <strong>{invoice.tracking || t.invoiceNumber}</strong>
        <span>{invoice.nombre_paqueteria || t.carrierPending} · {invoice.tipo_paquete || t.shipment}</span>
        <small>{t.invoiceStatus}: {invoiceStatusLabel(invoice)}</small>
      </div>
      <div className="portal-invoice-total"><strong>{formatMoney(invoice.billing_total)}</strong><span>{t.subtotal} {formatMoney(invoice.billing_subtotal)} · {t.tax} {formatMoney(invoice.billing_tax)}</span></div>
    </div>
  );

  const receiptRow = (invoice: PortalInvoice) => (
    <article className={`portal-receipt-row ${selectedReceipt?.id === invoice.id ? "is-selected" : ""}`} key={invoice.id}>
      <button type="button" className="portal-receipt-open" onClick={() => setSelectedReceipt(invoice)} aria-pressed={selectedReceipt?.id === invoice.id}>
        <span className="portal-receipt-icon"><FileText size={21} /></span>
        <span className="portal-receipt-main"><strong>{dateLabel(invoice.payment_date || invoice.creado_en || invoice.registro)}</strong><small>{invoice.tracking || t.invoiceNumber}</small></span>
        <span className="portal-paid-pill">{t.paid}</span>
        <strong className="portal-receipt-total">{formatMoney(invoice.billing_total)}</strong>
      </button>
      <div className="portal-receipt-actions"><button type="button" className="portal-secondary-button" onClick={() => setSelectedReceipt(invoice)}>{t.openReceipt}</button><button type="button" className="portal-button" disabled={receiptDownloadId === invoice.id} onClick={() => void downloadReceiptPdf(invoice)}><Download size={15} />{receiptDownloadId === invoice.id ? t.saving : t.downloadPdf}</button></div>
    </article>
  );

  return (
    <main className="portal-page" lang={language} data-print-mode={printMode || ""}>
      <header className="portal-header portal-wide">
        <Link href="/portal" className="portal-brand-lockup" aria-label={t.brand}>
          <Image src="/imagenes/logo-pages.png" alt={t.brand} width={220} height={94} priority />
          <strong>{t.brand}</strong>
        </Link>
        <div className="portal-header-actions">
          <span className="portal-header-label">{t.portal}</span>
          <LanguageToggle language={language} onChange={changeLanguage} label={t.languageLabel} />
          {!mustChangePassword && <button type="button" className="portal-report-button" onClick={() => setPrintMode("shipment-report")}><FileText size={16} />{t.printShipmentReport}</button>}
          <button type="button" className="portal-signout" onClick={() => void signOut()}><LogOut size={15} />{t.signOut}</button>
        </div>
      </header>

      {!mustChangePassword ? (
        <div className="portal-app-shell portal-wide">
          <aside className="portal-sidebar" aria-label={t.portal}>
            <nav className="portal-navigation">
              {navButton("packages", t.packages, <Box size={18} />, data.packages.length)}
              <button type="button" className="portal-nav-item portal-nav-sub" onClick={() => navigateToStage("ready")}><CheckCircle2 size={17} /><span>{t.readyForPickup}</span><small>{groups.ready.length}</small></button>
              <button type="button" className="portal-nav-item portal-nav-sub" onClick={() => navigateToStage("transit")}><Ship size={17} /><span>{t.inTransit}</span><small>{groups.transit.length}</small></button>
              <button type="button" className="portal-nav-item portal-nav-sub" onClick={() => navigateToStage("checkedIn")}><Warehouse size={17} /><span>{t.checkedIn}</span><small>{groups.checkedIn.length}</small></button>
              <button type="button" className="portal-nav-item portal-nav-sub" onClick={() => navigateToStage("received")}><MapPin size={17} /><span>{t.receivedFlorida}</span><small>{groups.received.length}</small></button>
              {navButton("history", t.history, <Archive size={18} />, data.packages.length)}
              {navButton("pickedUp", t.pickedUp, <PackageCheck size={18} />, groups.pickedUp.length)}
              {navButton("invoices", t.invoices, <FileText size={18} />, data.invoices.length)}
              {navButton("receipts", t.receipts, <Download size={18} />, paidReceipts.length)}
              {navButton("account", t.yourAccount, <UserRound size={18} />)}
              <button type="button" className="portal-nav-item" onClick={() => { navigate("account"); window.setTimeout(() => document.getElementById("portal-contact-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}><CircleHelp size={18} /><span>{t.contactDetails}</span></button>
              {!isRoatan && navButton("ferry", t.ferryBookings, <Ship size={18} />, data.ferry.length)}
            </nav>
            <div className="portal-sidebar-brand">{t.brand}</div>
          </aside>

          <section className="portal-content">
            <div className="portal-welcome"><div className="portal-avatar"><UserRound size={24} /></div><div><p>{t.welcome}</p><h1>{data.client.nombre}</h1><span>{t.accountNumber} #{data.client.numero_cliente} · {data.client.email}</span></div></div>

            {isDeveloper && <section className="portal-prepaid-card" aria-label={t.prepaidTitle}>
              <div className="portal-section-heading"><div><h2><Box size={19} />{t.prepaidTitle}</h2><p>{t.prepaidDescription}</p></div><button type="button" className="portal-button" disabled={prepaidReportLoading} onClick={() => void downloadPrepaidReport()}><Download size={16} />{prepaidReportLoading ? t.generatingReport : t.downloadUsagePdf}</button></div>
              <div className="portal-prepaid-metrics"><div><small>{t.allowance}</small><strong>{allowance.toFixed(2)} ft³</strong></div><div><small>{t.used}</small><strong>{usedAllowance.toFixed(2)} ft³</strong></div><div><small>{t.remaining}</small><strong className={remainingAllowance > 0 ? "is-positive" : "is-zero"}>{remainingAllowance.toFixed(2)} ft³</strong></div><div><small>{t.pendingReviews}</small><strong>{pendingPrepaidReviews}</strong></div></div>
              {prepaidReportError && <small className="portal-error">{prepaidReportError}</small>}
            </section>}

            {mustChangePassword ? <section className="portal-card portal-first-login"><h2><KeyRound size={18} />{t.firstTimeTitle}</h2><p>{t.firstTimeHelp}</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t.createPassword} autoComplete="new-password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? t.saving : t.setPassword}</button></div>{error && <small className="portal-error">{error}</small>}</section> : <>
              {activeSection === "packages" && <>
                <section className="portal-stage-area" aria-labelledby="portal-packages-title">
                  <div className="portal-content-title"><h2 id="portal-packages-title">{t.packages}</h2><p>{t.selectStage}</p></div>
                  <div className="portal-stage-grid">
                    {stageCard("ready", <Box size={23} />)}
                    {stageCard("transit", <Ship size={23} />)}
                    {stageCard("checkedIn", <Warehouse size={23} />)}
                    {stageCard("received", <MapPin size={23} />)}
                  </div>
                </section>
                <section className="portal-card portal-search-card">
                  <div className="portal-search-heading"><Search size={21} /><div><h2>{t.searchTitle}</h2><p>{t.exactTrackingHelp}</p></div></div>
                  <form className="portal-search-form" onSubmit={(event) => void submitTrackingSearch(event)}>
                    <label className="portal-visually-hidden" htmlFor="portal-tracking-search">{t.trackingNumber}</label>
                    <input id="portal-tracking-search" value={trackingInput} onChange={(event) => setTrackingInput(event.target.value)} maxLength={120} placeholder={t.trackingNumber} autoComplete="off" />
                    <button type="submit" className="portal-button" disabled={lookupLoading}><Search size={16} />{lookupLoading ? t.searching : t.search}</button>
                  </form>
                  {lookupError && <p className="portal-error">{lookupError}</p>}
                  {lookupResult && <div className={`portal-lookup-result ${lookupResult.found ? "has-match" : "no-match"}`} aria-live="polite">
                    <strong>{lookupResult.found ? (lookupResult.onAccount ? t.searchOnAccount : t.searchNotOnAccount) : t.searchNotFound}</strong>
                    {lookupResult.found && <div><span><b>{t.status}:</b> {packageStatusLabel(lookupResult.status || null)}</span><span><b>{t.lastScanned}:</b> {lookupResult.lastScannedAt ? dateLabel(lookupResult.lastScannedAt, true) : t.noScanDate}</span></div>}
                  </div>}
                </section>
                <section className="portal-stage-list" aria-labelledby="portal-stage-list-title">
                  <h2 id="portal-stage-list-title">{t.shipmentSections}</h2>
                  {(["ready", "transit", "checkedIn", "received"] as const).map((stage) => <section className="portal-stage-section" id={`portal-stage-${stage}`} key={stage}>
                    <h3>{stageLabel(stage)} <span>({groups[stage].length})</span></h3>
                    <div className="portal-stage-description">{stage === "checkedIn" ? (language === "es" ? "Paquetes en bodega, pendientes de cargar en el próximo contenedor." : "Packages in the warehouse, waiting to be loaded into the next container.") : stage === "transit" ? (language === "es" ? "Paquetes en un contenedor rumbo a su destino." : "Packages on a container on the way to your destination.") : stage === "received" ? (language === "es" ? "Paquetes recibidos en la bodega de Florida." : "Packages received at the Florida warehouse.") : (language === "es" ? "Paquetes descargados y listos para recoger." : "Packages unloaded and ready for pickup.")}</div>
                    {groups[stage].length ? <div className="portal-list">{groups[stage].map(packageRow)}</div> : <p className="portal-empty">{t.noPackages}</p>}
                  </section>)}
                  {groups.other.length > 0 && <section className="portal-stage-section" id="portal-stage-other"><h3>{t.otherStage} <span>({groups.other.length})</span></h3><div className="portal-list">{groups.other.map(packageRow)}</div></section>}
                </section>
              </>}

              {activeSection === "history" && <section className="portal-card portal-page-card"><h2>{t.history}</h2>{data.packages.length ? <div className="portal-list">{data.packages.map(packageRow)}</div> : <p className="portal-empty">{t.noShipments}</p>}</section>}
              {activeSection === "pickedUp" && <section className="portal-card portal-page-card"><h2>{t.pickedUp} ({groups.pickedUp.length})</h2>{groups.pickedUp.length ? <div className="portal-list">{groups.pickedUp.map(packageRow)}</div> : <p className="portal-empty">{t.noPackages}</p>}</section>}
              {activeSection === "invoices" && <section className="portal-card portal-page-card"><h2><FileText size={19} />{t.invoiceHistory}</h2>{data.invoices.length ? <div className="portal-list">{data.invoices.map(invoiceRow)}</div> : <p className="portal-empty">{t.noInvoices}</p>}</section>}
              {activeSection === "receipts" && <section className="portal-receipts-page">
                <div className="portal-content-title"><h2>{t.receiptsTitle}</h2><p>{t.receiptsIntro}</p></div>
                {paidReceipts.length ? <div className="portal-receipt-layout"><div className="portal-receipt-list">{paidReceipts.map(receiptRow)}</div>
                  <aside className="portal-card portal-receipt-detail" aria-label={t.receiptDetails}>
                    {selectedReceipt ? <>
                      <div className="portal-receipt-detail-heading"><div><p>{t.receipt}</p><h3>{dateLabel(selectedReceipt.payment_date || selectedReceipt.creado_en || selectedReceipt.registro)}</h3></div><span className="portal-paid-pill">{t.paid}</span></div>
                      <div className="portal-receipt-paper"><Image src="/imagenes/logo-pages.png" alt={t.brand} width={160} height={68} /><h4>{t.receipt}</h4><p>{t.accountName}: {data.client.nombre}</p><p>{t.accountNumber} #{data.client.numero_cliente}</p><p>{t.trackingNumber}: {selectedReceipt.tracking || t.noAccountData}</p><p>{t.paymentDate}: {dateLabel(selectedReceipt.payment_date || selectedReceipt.creado_en || selectedReceipt.registro)}</p><hr /><p>{t.subtotal}<strong>{formatMoney(selectedReceipt.billing_subtotal)}</strong></p><p>{t.tax}<strong>{formatMoney(selectedReceipt.billing_tax)}</strong></p><p className="portal-receipt-grand-total">{t.total}<strong>{formatMoney(selectedReceipt.billing_total)}</strong></p><span className="portal-paid-pill">{t.paid}</span></div>
                      <button type="button" className="portal-button portal-receipt-download" disabled={receiptDownloadId === selectedReceipt.id} onClick={() => void downloadReceiptPdf(selectedReceipt)}><Download size={16} />{receiptDownloadId === selectedReceipt.id ? t.saving : t.downloadPdf}</button>
                    </> : <p className="portal-empty">{t.noReceipts}</p>}
                    {receiptError && <small className="portal-error">{receiptError}</small>}
                  </aside></div> : <section className="portal-card"><p className="portal-empty">{t.noReceipts}</p></section>}
              </section>}
              {activeSection === "account" && <section className="portal-account-grid">
                <section className="portal-card" id="portal-contact-details"><h2><UserRound size={19} />{t.yourAccountTitle}</h2><dl className="portal-account-details"><div><dt>{t.accountNumber}</dt><dd>#{data.client.numero_cliente}</dd></div><div><dt>{t.accountName}</dt><dd>{data.client.nombre}</dd></div><div><dt>{t.email}</dt><dd>{data.client.email}</dd></div><div><dt>{t.phone}</dt><dd>{data.client.telefono || t.noAccountData}</dd></div><div><dt>{t.port}</dt><dd>{data.client.puerto || t.noAccountData}</dd></div></dl></section>
                <section className="portal-card portal-security"><h2><KeyRound size={19} />{t.changePassword}</h2><p>{t.changePasswordHelp}</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t.newPassword} autoComplete="new-password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? t.saving : t.updatePassword}</button></div>{message && <small className="portal-success">{message}</small>}{error && <small className="portal-error">{error}</small>}</section>
              </section>}
              {activeSection === "ferry" && !isRoatan && <section className="portal-card portal-page-card"><h2><Ship size={19} />{t.ferryTitle}</h2>{data.ferry.length ? <div className="portal-list">{data.ferry.map((item) => <div className="portal-row" key={item.id}><div className="portal-row-main"><strong>{item.numero_reserva || t.pending}</strong><span>{item.puerto === "la_ceiba" ? "La Ceiba" : "Utila"} · {t.receiver}: {item.nombre_receptor || t.notAssigned}</span><small>{item.enviado_en ? dateLabel(item.enviado_en, true) : "—"}</small></div></div>)}</div> : <p className="portal-empty">{t.noFerry}</p>}</section>}
            </>}
          </section>
        </div>
      ) : <section className="portal-card portal-first-login portal-wide"><h2><KeyRound size={18} />{t.firstTimeTitle}</h2><p>{t.firstTimeHelp}</p><div className="portal-password-row"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t.createPassword} autoComplete="new-password" /><button type="button" className="portal-button" disabled={changing} onClick={() => void changePassword()}>{changing ? t.saving : t.setPassword}</button></div>{error && <small className="portal-error">{error}</small>}</section>}

      <section className="portal-print-report" data-print-active={printMode === "shipment-report"} aria-label={t.shipmentReportTitle}>
        <div className="portal-print-brand"><Image src="/imagenes/logo-pages.png" alt={t.brand} width={220} height={94} /><div><strong>{t.shipmentReportTitle}</strong><span>{t.generatedAt}: {dateLabel(new Date().toISOString())}</span></div></div>
        <div className="portal-print-account"><h1>{data.client.nombre}</h1><p>{t.accountNumber} #{data.client.numero_cliente} · {data.client.email}</p>{data.client.puerto && <p>{t.destination}: {data.client.puerto}</p>}</div>
        {isDeveloper && <section className="portal-print-allowance"><h2>{t.prepaidTitle}</h2><div><span>{t.allowance}</span><strong>{allowance.toFixed(2)} ft³</strong><span>{t.used}</span><strong>{usedAllowance.toFixed(2)} ft³</strong><span>{t.remaining}</span><strong>{remainingAllowance.toFixed(2)} ft³</strong></div></section>}
        <h2>{t.history}</h2>
        {data.packages.length ? <table className="portal-print-table"><thead><tr><th>{t.trackingNumber}</th><th>{t.carrierPending}</th><th>{t.shipment}</th><th>{t.status}</th><th>{t.received}</th></tr></thead><tbody>{data.packages.map((item) => <tr key={item.id}><td>{item.tracking || "—"}</td><td>{item.nombre_paqueteria || t.carrierPending}</td><td>{item.tipo_paquete || item.contenido || t.shipment}</td><td>{packageStatusLabel(item.estado)}</td><td>{dateLabel(item.hora_fecha, true)}</td></tr>)}</tbody></table> : <p>{t.noShipments}</p>}
        <p className="portal-print-footnote">{t.reportFootnote}</p>
      </section>
    </main>
  );
}
