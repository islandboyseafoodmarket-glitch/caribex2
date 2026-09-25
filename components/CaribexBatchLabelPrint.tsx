"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export type BatchBoxLabel = {
  tracking: string;
  boxCode: string;
};

type Props = {
  labels: BatchBoxLabel[];
  onClose: () => void;
};

export default function CaribexBatchLabelPrint({ labels, onClose }: Props) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    Promise.all(labels.map(async (label) => {
      const url = await QRCode.toDataURL(JSON.stringify({ tracking: label.tracking.trim() }), {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 360,
        color: { dark: "#111827", light: "#ffffff" },
      });
      return [label.boxCode, url] as const;
    })).then((entries) => {
      if (mounted) setQrCodes(Object.fromEntries(entries));
    }).catch(() => setQrCodes({}));
    return () => { mounted = false; };
  }, [labels]);

  return (
    <div className="caribex-batch-label-overlay" role="dialog" aria-modal="true">
      <style>{`
        .caribex-batch-label-overlay { position: fixed; inset: 0; z-index: 110; overflow: auto; padding: 24px; background: rgba(15,23,42,.55); }
        .caribex-batch-label-sheet { max-width: 900px; margin: 0 auto; padding: 18px; background: #fff; border-radius: 16px; }
        .caribex-batch-label-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
        .caribex-batch-label-actions button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 14px; cursor: pointer; font-weight: 700; }
        .caribex-batch-label-actions button:last-child { border-color: #0f4c81; background: #0f4c81; color: #fff; }
        .caribex-batch-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .caribex-batch-label { break-inside: avoid; border: 2px solid #0f4c81; border-radius: 10px; padding: 16px; text-align: center; color: #111827; }
        .caribex-batch-label strong { display: block; color: #0f4c81; font-size: 19px; letter-spacing: .03em; }
        .caribex-batch-label small { display: block; margin-top: 3px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
        .caribex-batch-label img { display: block; width: 240px; height: 240px; margin: 14px auto 9px; image-rendering: pixelated; }
        .caribex-batch-label-code { font-size: 18px; font-weight: 800; word-break: break-all; }
        @media print {
          body * { visibility: hidden !important; }
          .caribex-batch-label-overlay, .caribex-batch-label-overlay * { visibility: visible !important; }
          .caribex-batch-label-overlay { position: static; padding: 0; background: #fff; }
          .caribex-batch-label-sheet { width: 100%; padding: 0; }
          .caribex-batch-label-actions { display: none; }
        }
        @media (max-width: 640px) { .caribex-batch-grid { grid-template-columns: 1fr; } }
      `}</style>
      <div className="caribex-batch-label-sheet">
        <div className="caribex-batch-label-actions">
          <button type="button" onClick={onClose}>Close</button>
          <button type="button" onClick={() => window.print()}>Print new-box labels</button>
        </div>
        <div className="caribex-batch-grid">
          {labels.map((label) => (
            <div className="caribex-batch-label" key={label.boxCode}>
              <strong>Caribex</strong>
              <small>For new boxes only</small>
              {qrCodes[label.boxCode] ? <img src={qrCodes[label.boxCode]} alt={`QR for ${label.tracking}`} /> : <div style={{ height: 240, display: "grid", placeItems: "center" }}>Generating QR…</div>}
              <div className="caribex-batch-label-code">{label.boxCode}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
