"use client";

import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import type { CaribexLabelSize } from "./CaribexLabelPrint";
import { FERRY_PORT_LABELS, type FerryPort } from "../lib/shipping-rules";
import { formatAccountNumber } from "../lib/port-format";

const PORT_COLORS: Record<FerryPort, { color: string; tint: string }> = {
  la_ceiba: { color: "#2563eb", tint: "#eff6ff" },
  utila: { color: "#dc2626", tint: "#fef2f2" },
  guanaja: { color: "#16a34a", tint: "#f0fdf4" },
  san_pedro_sula: { color: "#d97706", tint: "#fff7ed" },
  tegucigalpa: { color: "#7c3aed", tint: "#faf5ff" },
};

export type BatchBoxLabel = {
  id?: string;
  tracking: string;
  boxCode: string;
  accountNumber?: string | null;
  destinationPort?: string | null;
};

type Props = {
  labels: BatchBoxLabel[];
  onClose: () => void;
  isEs?: boolean;
  labelSize?: CaribexLabelSize;
};

export default function CaribexBatchLabelPrint({ labels, onClose, isEs = false, labelSize = "4x6" }: Props) {
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

  const printLabels = () => {
    if (!labels.every((label) => qrCodes[label.boxCode])) {
      window.alert(isEs ? "Los códigos QR todavía se están cargando. Espere un momento e inténtelo de nuevo." : "The label QR codes are still loading. Please wait a moment and try again.");
      return;
    }
    const printWindow = window.open("", "_blank", "popup,width=900,height=700");
    if (!printWindow) {
      window.alert("Please allow pop-ups for Caribex to print labels. / Permita las ventanas emergentes de Caribex para imprimir etiquetas.");
      return;
    }
    const sizes: Record<CaribexLabelSize, { page: string; width: string; height: string; qr: string }> = {
      "1.5x2.25": { page: "1.5in 2.25in", width: "1.5in", height: "2.25in", qr: "0.85in" },
      "40x60mm": { page: "40mm 60mm", width: "40mm", height: "60mm", qr: "28mm" },
      "2x3": { page: "2in 3in", width: "2in", height: "3in", qr: "1.4in" },
      "2x2": { page: "2in 2in", width: "2in", height: "2in", qr: "0.9in" },
      "4x6": { page: "4in 6in", width: "4in", height: "6in", qr: "2.4in" },
      "a4-12": { page: "A4 portrait", width: "3.8in", height: "1.8in", qr: "0.9in" },
    };
    const size = sizes[labelSize];
    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    const labelMarkup = labels.map((label) => {
      const destination = label.destinationPort as FerryPort | null | undefined;
      const portName = destination && destination in FERRY_PORT_LABELS ? FERRY_PORT_LABELS[destination] : "";
      const portStyle = destination && destination in PORT_COLORS ? PORT_COLORS[destination] : { color: "#0f4c81", tint: "#eff6ff" };
      const account = label.accountNumber ? formatAccountNumber(label.accountNumber, destination) : "";
      const route = portName ? `<div class="label-route"><span class="route-badge">${escapeHtml(portName.charAt(0))}</span><span>${escapeHtml(portName)}</span></div>` : "";
      return `
        <article class="label" data-size="${labelSize}" style="--route-color:${portStyle.color};--route-tint:${portStyle.tint}">
          <div class="label-brand">CARIBEX LOGISTICS GROUP</div>
          <div class="label-tagline">YOUR CARGO · OUR COMMITMENT</div>
          ${(route || account) ? `<div class="label-personal">${route}${account ? `<strong class="label-account">${escapeHtml(account)}</strong>` : ""}</div>` : ""}
          <div class="label-type">STOCK</div>
          <div class="label-code">${escapeHtml(label.boxCode)}</div>
          <img src="${qrCodes[label.boxCode]}" alt="QR for ${escapeHtml(label.tracking)}">
          <div class="label-under-qr">${escapeHtml(label.boxCode)}</div>
          <div class="label-code">${escapeHtml(label.boxCode)}</div>
          <div class="label-vertical">${escapeHtml(label.boxCode)}</div>
        </article>
      `;
    }).join("");
    const sheetLayout = labelSize === "a4-12"
      ? ".label-grid{display:grid;grid-template-columns:repeat(2,3.8in);grid-template-rows:repeat(6,1.8in);gap:0;justify-content:center;align-content:center}.label{break-inside:avoid;page-break-inside:avoid}"
      : `.label-grid{display:block}.label{page-break-after:always;break-after:page}.label:last-child{page-break-after:auto;break-after:auto}`;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="${isEs ? "es" : "en"}"><head><meta charset="utf-8"><title>${isEs ? "Etiquetas Caribex" : "Caribex labels"}</title><style>
      @page{size:${size.page};margin:${labelSize === "a4-12" ? "0.12in" : "0"}}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:Arial,Helvetica,sans-serif}
      .label-grid{margin:0;padding:0}
      ${sheetLayout}
      .label{position:relative;width:${size.width};height:${size.height};margin:0;padding:.16in .38in .18in .18in;border:3px solid #000;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden;color:#000}
      .label-brand{width:100%;border-bottom:3px solid #000;padding-bottom:.07in;color:#000;font-size:21px;font-weight:900;letter-spacing:.06em;line-height:1.05}
      .label-tagline{font-size:9px;font-weight:700;letter-spacing:.08em}
      .label-personal{display:flex;align-items:center;justify-content:center;gap:.12in;min-height:.24in;color:var(--route-color);font-size:11px;font-weight:800}
      .label-route{display:flex;align-items:center;gap:.05in;white-space:nowrap}
      .route-badge{display:grid;place-items:center;width:.25in;height:.25in;border-radius:.05in;background:var(--route-color);color:#fff;font-size:11px}
      .label-account{font-size:14px;font-weight:900;white-space:nowrap}
      .label-type{font-size:21px;font-weight:900;letter-spacing:.3em}
      .label img{display:block;width:2.65in;height:2.65in;margin:auto;object-fit:contain;image-rendering:pixelated}
      .label-code{width:100%;font-size:31px;font-weight:900;line-height:1;word-break:break-all}
      .label-under-qr{font-size:27px;font-weight:900;line-height:1;word-break:break-all}
      .label-meta{width:100%;display:flex;justify-content:space-between;border-top:2px solid #000;padding-top:6px;font-size:10px;font-weight:700}
      .label-vertical{position:absolute;right:2px;top:1.48in;height:2.8in;display:flex;align-items:center;justify-content:center;font-size:27px;font-weight:900;letter-spacing:.03em;writing-mode:vertical-rl;transform:rotate(180deg)}
      ${labelSize === "a4-12" ? ".label-top{min-height:.3in}.label-brand{font-size:15px}.label-route{font-size:10px}.route-badge{width:.25in;height:.25in;font-size:10px}.label-account{font-size:12px}.label-code{font-size:13px}" : ""}
      @media print{html,body{width:auto!important;height:auto!important;overflow:visible!important}.label{break-inside:avoid;page-break-inside:avoid}}
    </style></head><body><main class="label-grid">${labelMarkup}</main><script>
      window.addEventListener('load',function(){var images=Array.from(document.images);Promise.all(images.map(function(image){return image.decode?image.decode().catch(function(){}):Promise.resolve()})).then(function(){window.focus();setTimeout(function(){window.print()},150)})});
      window.addEventListener('afterprint',function(){window.close()});
    </script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="caribex-batch-label-overlay" role="dialog" aria-modal="true">
      <style>{`
        .caribex-batch-label-overlay { position: fixed; inset: 0; z-index: 110; overflow: auto; padding: 24px; background: rgba(15,23,42,.55); }
        .caribex-batch-label-sheet { max-width: 900px; margin: 0 auto; padding: 18px; background: #fff; border-radius: 16px; }
        .caribex-batch-label-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
        .caribex-batch-label-actions button { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 14px; cursor: pointer; font-weight: 700; }
        .caribex-batch-label-actions button:last-child { border-color: #0f4c81; background: #0f4c81; color: #fff; }
        .caribex-batch-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .caribex-batch-label { --label-width: 4in; --label-height: 6in; position: relative; break-inside: avoid; border: 3px solid #000; border-radius: 0; padding: 14px 30px 16px 14px; text-align: center; color: #000; width: var(--label-width); height: var(--label-height); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-between; overflow: hidden; }
        .caribex-batch-label-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .caribex-batch-label-head strong { color: #000; font-size: 19px; letter-spacing: .03em; }
        .caribex-batch-label-route { display: inline-flex; align-items: center; gap: 5px; color: var(--route-color); font-size: 12px; font-weight: 800; }
        .caribex-batch-label-route b { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; background: var(--route-color); color: #fff; }
        .caribex-batch-label-account { color: var(--route-color); font-size: 18px; font-weight: 900; white-space: nowrap; }
        .caribex-batch-label img { display: block; width: 2.65in; height: 2.65in; margin: auto; image-rendering: pixelated; }
        .caribex-batch-label-code { font-size: 31px; font-weight: 900; line-height: 1; word-break: break-all; }
        .caribex-batch-label-brand { width: 100%; border-bottom: 3px solid #000; padding-bottom: 7px; font-size: 21px; font-weight: 900; letter-spacing: .06em; line-height: 1.05; }
        .caribex-batch-label-tagline { font-size: 9px; font-weight: 700; letter-spacing: .08em; }
        .caribex-batch-label-type { font-size: 21px; font-weight: 900; letter-spacing: .3em; }
        .caribex-batch-label-under-qr { font-size: 27px; font-weight: 900; line-height: 1; }
        .caribex-batch-label-meta { width: 100%; display: flex; justify-content: space-between; border-top: 2px solid #000; padding-top: 6px; font-size: 10px; font-weight: 700; }
        .caribex-batch-label-vertical { position: absolute; right: 2px; top: 1.48in; height: 2.8in; display: flex; align-items: center; justify-content: center; font-size: 27px; font-weight: 900; letter-spacing: .03em; writing-mode: vertical-rl; transform: rotate(180deg); }
        @media print {
          body * { visibility: hidden !important; }
          .caribex-batch-label-overlay, .caribex-batch-label-overlay * { visibility: visible !important; }
          .caribex-batch-label-overlay { position: static; padding: 0; background: #fff; }
          .caribex-batch-label-sheet { width: 100%; padding: 0; }
          .caribex-batch-label-actions { display: none; }
        }
        @media (max-width: 640px) { .caribex-batch-grid { grid-template-columns: 1fr; } }
        .caribex-batch-label[data-size="1.5x2.25"] { --label-width: 1.5in; --label-height: 2.25in; }
        .caribex-batch-label[data-size="40x60mm"] { --label-width: 40mm; --label-height: 60mm; }
        .caribex-batch-label[data-size="2x3"] { --label-width: 2in; --label-height: 3in; }
        .caribex-batch-label[data-size="2x2"] { --label-width: 2in; --label-height: 2in; }
        .caribex-batch-label[data-size="4x6"] { --label-width: 4in; --label-height: 6in; }
        .caribex-batch-label[data-size="1.5x2.25"] img { width: .85in; height: .85in; }
        .caribex-batch-label[data-size="2x2"] img { width: .9in; height: .9in; }
        .caribex-batch-label[data-size="a4-12"] { --label-width: 3.8in; --label-height: 1.8in; }
        .caribex-batch-label[data-size="a4-12"] img { width: .9in; height: .9in; }
      `}</style>
      <div className="caribex-batch-label-sheet">
        <div className="caribex-batch-label-actions">
          <button type="button" onClick={onClose}>{isEs ? "Cerrar" : "Close"}</button>
          <button type="button" onClick={printLabels}>{isEs ? "Imprimir etiquetas" : "Print new-box labels"}</button>
        </div>
        <div className="caribex-batch-grid">
          {labels.map((label) => (
            <div className="caribex-batch-label" data-size={labelSize} key={label.boxCode} style={{ "--route-color": label.destinationPort && label.destinationPort in PORT_COLORS ? PORT_COLORS[label.destinationPort as FerryPort].color : "#0f4c81", "--route-tint": label.destinationPort && label.destinationPort in PORT_COLORS ? PORT_COLORS[label.destinationPort as FerryPort].tint : "#eff6ff" } as CSSProperties}>
              <div className="caribex-batch-label-brand">CARIBEX LOGISTICS GROUP</div>
              <div className="caribex-batch-label-tagline">YOUR CARGO · OUR COMMITMENT</div>
              {(label.destinationPort || label.accountNumber) && <div className="caribex-batch-label-head">{label.destinationPort && label.destinationPort in FERRY_PORT_LABELS && <span className="caribex-batch-label-route"><b>{FERRY_PORT_LABELS[label.destinationPort as FerryPort].charAt(0)}</b>{FERRY_PORT_LABELS[label.destinationPort as FerryPort]}</span>}{label.accountNumber && <span className="caribex-batch-label-account">{formatAccountNumber(label.accountNumber, label.destinationPort)}</span>}</div>}
              <div className="caribex-batch-label-code">{label.boxCode}</div>
              {qrCodes[label.boxCode] ? <img src={qrCodes[label.boxCode]} alt={isEs ? `Código QR para ${label.tracking}` : `QR for ${label.tracking}`} /> : <div style={{ height: 240, display: "grid", placeItems: "center" }}>{isEs ? "Generando código QR…" : "Generating QR…"}</div>}
              <div className="caribex-batch-label-under-qr">{label.boxCode}</div>
              <div className="caribex-batch-label-code">{label.boxCode}</div>
              <div className="caribex-batch-label-vertical">{label.boxCode}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
