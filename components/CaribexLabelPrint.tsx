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

export type CaribexLabelSize = "1.5x2.25" | "40x60mm" | "2x3" | "2x2" | "4x6" | "a4-12";

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
  labelSize?: CaribexLabelSize;
};

export default function CaribexLabelPrint({ label, onClose, isEs = false, mode = "box", labelSize = "4x6" }: Props) {
  const [qrCode, setQrCode] = useState("");
  const [labelCode] = useState(createCaribexLabelCode);
  const isQrReprint = mode === "qr-reprint";

  useEffect(() => {
    let mounted = true;
    // Both label modes must scan back to the real shipment tracking number.
    // The internal box code is intentionally printed/displayed separately and
    // must never replace the tracking value in Package Registration.
    const qrPayload = JSON.stringify({ tracking: label.tracking.trim() });
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 360,
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
        .caribex-label-card { --label-width: 4in; --label-height: 6in; position: relative; border: 3px solid #000; border-radius: 0; padding: 14px 30px 16px 14px; text-align: center; color: #000; width: var(--label-width); min-height: var(--label-height); box-sizing: border-box; margin: 0 auto; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
        .caribex-label-brand { width: 100%; color: #000; border-bottom: 3px solid #000; padding-bottom: 7px; font-size: 21px; font-weight: 900; letter-spacing: .06em; line-height: 1.05; }
        .caribex-label-tagline { font-size: 9px; font-weight: 700; letter-spacing: .08em; }
        .caribex-label-type { font-size: 21px; font-weight: 900; letter-spacing: .3em; }
        .caribex-label-qr { display: block; width: 2.65in; height: 2.65in; margin: auto; image-rendering: pixelated; }
        .caribex-label-tracking { font-size: 31px; font-weight: 900; letter-spacing: .03em; line-height: 1; word-break: break-all; }
        .caribex-label-under-qr { font-size: 27px; font-weight: 900; letter-spacing: .03em; line-height: 1; }
        .caribex-label-vertical { position: absolute; right: 2px; top: 1.48in; height: 2.8in; display: flex; align-items: center; justify-content: center; font-size: 27px; font-weight: 900; letter-spacing: .03em; writing-mode: vertical-rl; transform: rotate(180deg); }
        .caribex-label-meta { width: 100%; display: flex; justify-content: space-between; border-top: 2px solid #000; padding-top: 6px; font-size: 10px; font-weight: 700; }
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
          .caribex-label-card { margin: 0 auto; width: var(--label-width); min-height: var(--label-height); }
          .caribex-label-qr { width: 2.65in; height: 2.65in; }
          .caribex-label-actions { display: none; }
        }
        .caribex-label-card[data-size="1.5x2.25"] { --label-width: 1.5in; --label-height: 2.25in; }
        .caribex-label-card[data-size="40x60mm"] { --label-width: 40mm; --label-height: 60mm; }
        .caribex-label-card[data-size="2x3"] { --label-width: 2in; --label-height: 3in; }
        .caribex-label-card[data-size="2x2"] { --label-width: 2in; --label-height: 2in; }
        .caribex-label-card[data-size="4x6"] { --label-width: 4in; --label-height: 6in; }
        .caribex-label-card[data-size="a4-12"] { --label-width: 2.48in; --label-height: 3.86in; }
      `}</style>
      <div className="caribex-label-sheet">
        <div className="caribex-label-card" data-size={labelSize}>
          <div className="caribex-label-brand">CARIBEX LOGISTICS GROUP</div>
          <div className="caribex-label-tagline">YOUR CARGO · OUR COMMITMENT</div>
          <div className="caribex-label-type">STOCK</div>
          <div className="caribex-label-tracking">{label.boxCode || label.tracking}</div>
          {qrCode ? <img className="caribex-label-qr" src={qrCode} alt={`QR code for ${label.tracking}`} /> : <div style={{ height: 260, display: "grid", placeItems: "center", color: "#64748b" }}>Generating QR…</div>}
          <div className="caribex-label-under-qr">{label.boxCode || label.tracking}</div>
          <div className="caribex-label-meta"><span>CARIBEX LABEL</span><span>LOGISTICS GROUP</span></div>
          <div className="caribex-label-tracking">{label.boxCode || label.tracking}</div>
          <div className="caribex-label-vertical">{label.boxCode || label.tracking}</div>
        </div>
        <div className="caribex-label-actions">
          <button type="button" onClick={onClose}>{isEs ? "Cerrar" : "Close"}</button>
          <button type="button" onClick={() => window.print()}>{isEs ? "Imprimir etiqueta" : "Print label"}</button>
        </div>
      </div>
    </div>
  );
}
