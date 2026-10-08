"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Keyboard, LogOut, PackageCheck, ScanLine, Search, UserRound, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { detectCarrier } from "../lib/carrierDetection";
import styles from "./scanner-workflow.module.css";

type WorkflowStep = { key: string; status: string; label: string; description: string };
type Shipment = { id: string; tracking: string; nombre_paqueteria: string | null; tipo_paquete: string | null; estado: string | null; numero_cliente?: { numero_cliente?: number; nombre?: string; puerto?: string | null } | { numero_cliente?: number; nombre?: string; puerto?: string | null }[] | null };
type WorkflowResponse = { shipment: Shipment; current: WorkflowStep; next: WorkflowStep | null; workflow: WorkflowStep[] };

function scannerErrorMessage(status: number, payload: any, scannedCode: string) {
  const serverMessage = typeof payload?.error === "string" ? payload.error : "The scanner action failed.";
  if (status === 404 || payload?.code === "NOT_FOUND") {
    return `No shipment was found for “${scannedCode}”. Scan the shipping barcode again, or verify that this tracking number was registered in Receiving.`;
  }
  if (status === 401) return "Your staff session has expired. Sign in again before scanning.";
  if (status === 400 && !payload?.error) return "The scanner sent an empty or invalid barcode. Scan the label again.";
  return serverMessage;
}

function parseCode(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    if (parsed?.tracking) {
      const tracking = String(parsed.tracking).trim();
      return detectCarrier(tracking).trackingNumber || tracking;
    }
    if (parsed?.id) return String(parsed.id).trim();
  } catch { /* plain tracking */ }
  const urlMatch = text.match(/pedidos\/([0-9a-f-]{36})/i);
  if (urlMatch?.[1]) return urlMatch[1];

  const plainCode = text.replace(/^CARIBEX:/i, "").trim();
  const detected = detectCarrier(plainCode);
  return detected.trackingNumber || plainCode;
}

export default function ScannerWorkflowPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [operator, setOperator] = useState("Staff");
  const [manualCode, setManualCode] = useState("");
  const [shipment, setShipment] = useState<WorkflowResponse | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) { router.replace("/login"); return; }
      const [{ data: admin }, { data: staff }] = await Promise.all([
        supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
        supabase.from("personal").select("nombre, nombre_personal").eq("id", data.user.id).maybeSingle(),
      ]);
      if (!admin && !staff) { await supabase.auth.signOut(); router.replace("/login"); return; }
      setOperator(staff?.nombre || staff?.nombre_personal || data.user.email || "Staff");
      setSessionReady(true);
    };
    void loadUser();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!sessionReady) return;
    const focusInput = () => manualInputRef.current?.focus();
    focusInput();
    const timer = window.setTimeout(focusInput, 250);
    return () => window.clearTimeout(timer);
  }, [sessionReady, shipment]);

  const lookup = useCallback(async (code: string) => {
    const parsedCode = parseCode(code);
    if (!parsedCode) return;
    setLoading(true); setMessage(null); setShipment(null); setManualCode(parsedCode);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`/api/scanner-workflow?code=${encodeURIComponent(parsedCode)}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(scannerErrorMessage(response.status, payload, parsedCode));
      setShipment(payload as WorkflowResponse);
      setMessage({ tone: "info", text: payload.next ? `Ready for: ${payload.next.label}` : "This shipment is already complete." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "The scanner could not look up this shipment." });
    } finally { setLoading(false); }
  }, []);

  const activateHandheldScanner = () => {
    setMessage({ tone: "info", text: "Scanner ready — scan the barcode now." });
    manualInputRef.current?.focus();
  };

  const advance = async () => {
    if (!shipment?.next) return;
    setUpdating(true); setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const response = await fetch("/api/scanner-workflow", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ shipment_id: shipment.shipment.id, next_key: shipment.next.key }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Status update failed");
      setShipment((current) => current ? { ...current, current: payload.current, next: null, shipment: { ...current.shipment, estado: payload.current.status } } : current);
      setMessage({ tone: "success", text: `${payload.tracking} moved to ${payload.current.label}.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Status update failed" });
    } finally { setUpdating(false); }
  };

  const scanNext = () => {
    setShipment(null);
    setManualCode("");
    setMessage(null);
    window.setTimeout(() => manualInputRef.current?.focus(), 0);
  };
  const logout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  if (!sessionReady) return <main className={styles.loading}>Loading workflow app…</main>;

  return <main className={styles.app}>
    <header className={styles.header}>
      <div className={styles.brand}><Image src="/imagenes/logo-pages.png" alt="Caribex Logistics Group" width={176} height={75} priority /><div><strong>Workflow App</strong><span>Status updates only</span></div></div>
      <div className={styles.headerActions}><span className={styles.operator}><UserRound size={16} /> {operator}</span><button className={styles.iconButton} onClick={() => void logout()} title="Log out" aria-label="Log out"><LogOut size={18} /></button></div>
    </header>
    <section className={styles.shell}>
      <div className={styles.hero}><div><p className={styles.eyebrow}>CARIBEX OPERATIONS</p><h1>Move a shipment through its workflow</h1><p>Scan a label, review the current status, and apply only the next allowed status.</p></div><div className={styles.heroIcon}><PackageCheck size={34} /></div></div>
      <div className={styles.workflow}>{(shipment?.workflow || [{ key: "RECEIVED", label: "Received" }, { key: "CHECK_IN", label: "Check In" }, { key: "IN_TRANSIT", label: "In Transit" }, { key: "UNLOADED", label: "Ready for Pickup" }, { key: "PICKED_UP", label: "Picked Up" }]).map((step: any, index: number) => { const activeIndex = shipment ? shipment.workflow.findIndex((item) => item.key === shipment.current.key) : -1; return <div className={`${styles.workflowStep} ${styles[`stage_${step.key}`] || ""} ${shipment && index === activeIndex ? styles.active : ""} ${shipment && index < activeIndex ? styles.completed : ""}`} key={step.key}><span>{index + 1}</span><small>{step.label}</small>{index < 4 && <ArrowRight size={15} />}</div>; })}</div>
      <div className={styles.scanCard}>
        <div className={styles.cardTitle}><div><h2>Scan shipment</h2><p>Use the dedicated handheld scanner or type the tracking number.</p></div><ScanLine size={25} /></div>
        <div className={styles.scanActions}><button type="button" className={styles.primaryButton} onClick={activateHandheldScanner}><ScanLine size={18} /> Activate scanner</button><div className={styles.or}><span>or</span></div><form className={styles.manualForm} onSubmit={(event) => { event.preventDefault(); void lookup(manualCode); }}><Keyboard size={18} /><input ref={manualInputRef} autoFocus autoComplete="off" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Scan or enter tracking number" aria-label="Tracking number" /><button type="submit" disabled={loading || !manualCode.trim()}><Search size={17} /> Find</button></form></div>
        {loading && <div className={styles.busy}>Looking up shipment…</div>}
        {message && <div className={`${styles.message} ${styles[message.tone]}`} role={message.tone === "error" ? "alert" : "status"} aria-live="assertive">{message.tone === "success" ? <CheckCircle2 size={20} /> : message.tone === "error" ? <XCircle size={20} /> : <ScanLine size={20} />}<div><strong>{message.tone === "error" ? "SCAN ERROR" : message.tone === "success" ? "SCAN COMPLETE" : "SCANNER READY"}</strong><span>{message.text}</span></div></div>}
      </div>
      {shipment && <section className={styles.shipmentCard}><div className={styles.shipmentTop}><div><p className={styles.eyebrow}>SHIPMENT FOUND</p><h2>{shipment.shipment.tracking}</h2><p>{shipment.shipment.nombre_paqueteria || "Carrier not recorded"} · {shipment.shipment.tipo_paquete || "Package"}</p></div><span className={styles.currentBadge}>{shipment.current.label}</span></div><div className={styles.details}><div><small>Customer</small><strong>{Array.isArray(shipment.shipment.numero_cliente) ? shipment.shipment.numero_cliente[0]?.nombre : shipment.shipment.numero_cliente?.nombre || "Unassigned"}</strong></div><div><small>Account</small><strong>{Array.isArray(shipment.shipment.numero_cliente) ? shipment.shipment.numero_cliente[0]?.numero_cliente || "—" : shipment.shipment.numero_cliente?.numero_cliente || "—"}</strong></div><div><small>Port / Location</small><strong>{Array.isArray(shipment.shipment.numero_cliente) ? shipment.shipment.numero_cliente[0]?.puerto || "—" : shipment.shipment.numero_cliente?.puerto || "—"}</strong></div><div><small>Current database status</small><strong>{shipment.shipment.estado || "—"}</strong></div></div><div className={styles.nextAction}>{shipment.next ? <><div><small>NEXT ALLOWED ACTION</small><h3>{shipment.next.label}</h3><p>{shipment.next.description}</p></div><button type="button" className={styles.advanceButton} onClick={() => void advance()} disabled={updating}><CheckCircle2 size={19} /> {updating ? "Updating…" : `Move to ${shipment.next.label}`}</button></> : <div className={styles.complete}><CheckCircle2 size={23} /><div><h3>Workflow complete</h3><p>This shipment is already marked picked up.</p></div></div>}</div><button type="button" className={styles.scanNextButton} onClick={scanNext}><ScanLine size={18} /> Scan next shipment</button></section>}
    </section>
  </main>;
}
