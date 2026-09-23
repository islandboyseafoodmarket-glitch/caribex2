"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export type CaribexLabelData = {
  tracking: string;
  customerName?: string | null;
  accountNumber?: number | null;
  carrier?: string | null;
  packageType?: string | null;
  details?: string | null;
  boxCode?: string | null;
};

function createCaribexLabelCode() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return String(values[0] % 100000).padStart(5, "0");
  }
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}

type Props = {
  label: CaribexLabelData;
  onClose: () => void;
  isEs?: boolean;
  mode?: "qr-reprint" | "box";
};

export default function CaribexLabelPrint({ label, onClose, isEs = false, mode = "box" }: Props) {
  const [qrCode, setQrCode] = useState("");
  const [labelCode] = useState(createCaribexLabelCode);
  const isQrReprint = mode === "qr-reprint";

  useEffect(() => {
    let mounted = true;
    const qrPayload = JSON.stringify(
      isQrReprint
        ? { tracking: label.tracking.trim() }
        : { tracking: label.tracking.trim(), boxCode: label.boxCode || `${labelCode}-2026-Caribex` },
    );
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 300,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((url) => {
      if (mounted) setQrCode(url);
    }).catch(() => setQrCode(""));
    return () => { mounted = false; };
  }, [isQrReprint, label.boxCode, label.tracking, labelCode]);

  return (
    <div className="caribex-label-overlay" role="dialog" aria-modal="true">
      <style>{`
        .caribex-label-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(15, 23, 42, .55); }
        .caribex-label-sheet { width: min(420px, 100%); background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 24px 70px rgba(15,23,42,.3); }
        .caribex-label-card { border: 2px solid #0f4c81; border-radius: 10px; padding: 18px; text-align: center; color: #111827; }
        .caribex-label-brand { color: #0f4c81; font-size: 19px; font-weight: 800; letter-spacing: .03em; }
        .caribex-label-subtitle { margin-top: 3px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
        .caribex-label-qr { display: block; width: 210px; height: 210px; margin: 16px auto 10px; image-rendering: pixelated; }
        .caribex-label-tracking { font-size: 22px; font-weight: 800; letter-spacing: .08em; word-break: break-all; }
        .caribex-label-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 15px; text-align: left; font-size: 12px; }
        .caribex-label-meta div { padding: 7px; border-radius: 6px; background: #f1f5f9; }
        .caribex-label-meta strong { display: block; margin-bottom: 2px; color: #64748b; font-size: 10px; text-transform: uppercase; }
        .caribex-label-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
        .caribex-label-actions button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 14px; cursor: pointer; font-weight: 700; }
        .caribex-label-actions button:last-child { border-color: #0f4c81; background: #0f4c81; color: #fff; }
        @media print {
          body * { visibility: hidden !important; }
          .caribex-label-overlay, .caribex-label-overlay * { visibility: visible !important; }
          .caribex-label-overlay { position: static; padding: 0; background: #fff; }
          .caribex-label-sheet { width: 100%; padding: 0; box-shadow: none; }
          .caribex-label-card { margin: 0 auto; width: 3.5in; min-height: 4.5in; }
          .caribex-label-actions { display: none; }
        }
      `}</style>
      <div className="caribex-label-sheet">
        <div className="caribex-label-card">
          <div className="caribex-label-brand">Caribex</div>
          <div className="caribex-label-subtitle">
            {isQrReprint
              ? (isEs ? "Reimpresión QR" : "QR reprint")
              : (isEs ? "Etiqueta de caja" : "Box label")}
          </div>
          {qrCode ? <img className="caribex-label-qr" src={qrCode} alt={`QR code for ${label.tracking}`} /> : <div style={{ height: 210, display: "grid", placeItems: "center", color: "#64748b" }}>Generating QR…</div>}
          <div className="caribex-label-tracking">
            {isQrReprint ? label.tracking : (label.boxCode || `${labelCode}-2026-Caribex`)}
          </div>
        </div>
        <div className="caribex-label-actions">
          <button type="button" onClick={onClose}>{isEs ? "Cerrar" : "Close"}</button>
          <button type="button" onClick={() => window.print()}>{isEs ? "Imprimir etiqueta" : "Print label"}</button>
        </div>
      </div>
    </div>
  );
}
