import { FERRY_PORT_LABELS, FERRY_PORT_ORDER, type FerryPort } from "./shipping-rules";

export type FerryManifestEntry = {
  id: string;
  puerto: FerryPort;
  numero_cuenta: string;
  nombre_cliente: string;
  etiqueta_cantidad: string;
  numero_reserva: string | null;
  nombre_receptor: string | null;
  enviado_en: string | null;
};

export type FerryManifestData = {
  manifest: {
    semana_inicio: string;
    semana_fin: string;
    estado: string;
    ubicacion?: string;
    container_codigo: string | null;
    container_creado_en?: string | null;
  };
  entries: FerryManifestEntry[];
};

type Port = FerryManifestEntry["puerto"];

export const FERRY_PORT_STYLES = {
  la_ceiba: { prefix: "L", color: "2563EB" },
  utila: { prefix: "U", color: "DC2626" },
  guanaja: { prefix: "G", color: "16A34A" },
  san_pedro_sula: { prefix: "S", color: "D97706" },
  tegucigalpa: { prefix: "T", color: "7C3AED" },
} as const;

export function formatFerryAccountNumber(value: string, port: Port): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const prefix = FERRY_PORT_STYLES[port].prefix;
  if (new RegExp(`^${prefix}(?:[-\\s])?\\d+$`, "i").test(raw)) return raw.replace(/^[a-z]/i, prefix);
  return /^\d+$/.test(raw) ? `${prefix}${raw}` : raw;
}

export const FERRY_MANIFEST_COLUMNS = [
  "PORT",
  "NO.",
  "ACCOUNT NUMBER",
  "CUSTOMER NAME",
  "QUANTITY",
  "BOOKING #",
  "RECEIVER NAME",
  "CONTAINER",
  "WEEK START",
  "WEEK END",
  "MANIFEST STATUS",
  "SUBMITTED AT",
] as const;

export function getFerryManifestExportRows(entries: FerryManifestEntry[], manifest: FerryManifestData["manifest"]) {
  return FERRY_PORT_ORDER.flatMap((port) =>
    entries
      .filter((entry) => entry.puerto === port)
      .map((entry, index) => ({
        port,
        values: [
          FERRY_PORT_LABELS[port],
          String(index + 1),
          formatFerryAccountNumber(entry.numero_cuenta, port),
          entry.nombre_cliente,
          entry.etiqueta_cantidad,
          entry.numero_reserva || "",
          entry.nombre_receptor || "",
          manifest.container_codigo || "",
          manifest.semana_inicio,
          manifest.semana_fin,
          manifest.estado || "",
          entry.enviado_en || "",
        ],
      })),
  );
}

type Cell = import("exceljs").Cell;
type Row = import("exceljs").Row;

type Font = {
  name: string;
  size: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: { argb: string };
};

const COLORS = {
  navy: "0F3D68",
  blue: "2563EB",
  paleBlue: "EFF6FF",
  border: "CBD5E1",
  text: "0F172A",
  muted: "475569",
  white: "FFFFFF",
};

const BODY_FONT: Font = { name: "Arial", size: 11, color: { argb: COLORS.text } };
const LABEL_FONT: Font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.muted } };
const HEADER_FONT: Font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.white } };

function setFont(cell: Cell, font: Font) {
  cell.font = font;
}

function setBaseCellStyle(cell: Cell) {
  cell.font = BODY_FONT;
  cell.alignment = { vertical: "middle", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function setTextCell(cell: Cell, value: string | null | undefined) {
  // ExcelJS serializes a primitive string as a shared/string cell, never as a
  // formula object. Keep the text number format so IDs retain leading zeros.
  cell.value = value == null ? "" : String(value);
  cell.numFmt = "@";
}

function setHeaderRowStyle(row: Row) {
  row.height = 28;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.blue } },
      left: { style: "thin", color: { argb: COLORS.blue } },
      bottom: { style: "thin", color: { argb: COLORS.blue } },
      right: { style: "thin", color: { argb: COLORS.blue } },
    };
  });
}

function formatContainerCreatedDate(value: string | null | undefined): string {
  if (!value) return "—";

  // Parse a date-only API value in local time so it cannot move back a day due
  // to UTC conversion. Date-time values are formatted from the supplied date.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function safeFilenamePart(value: string | null | undefined): string {
  return (value || "export")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "export";
}

function addManifestHeader(worksheet: import("exceljs").Worksheet, data: FerryManifestData) {
  worksheet.mergeCells("A1:E1");
  const title = worksheet.getCell("A1");
  title.value = "CARIBEX FERRY REPORT";
  setFont(title, { name: "Arial", size: 16, bold: true, color: { argb: COLORS.text } });
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.white } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 31;

  worksheet.mergeCells("A2:E2");
  const company = worksheet.getCell("A2");
  company.value = "Caribex Logistics Group";
  setFont(company, { name: "Arial", size: 12, bold: true, color: { argb: COLORS.navy } });
  company.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(2).height = 23;

  const metadata = [
    ["Container number", data.manifest.container_codigo || "—", "Date container created", formatContainerCreatedDate(data.manifest.container_creado_en), "Status", data.manifest.estado || "—"],
  ];
  metadata[0].forEach((value, index) => {
    const cell = worksheet.getCell(3, index + 1);
    cell.value = value;
    cell.font = index % 2 === 0 ? LABEL_FONT : BODY_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? COLORS.paleBlue : COLORS.white } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
    if (index === 1 || index === 5) setTextCell(cell, String(value));
  });
  worksheet.getRow(3).height = 30;

  worksheet.getRow(4).height = 10;
}

export async function downloadFerryManifestExcel(data: FerryManifestData): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Ferry manifest Excel export is only available in a browser.");
  }

  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "Caribex Logistics Group";
  workbook.lastModifiedBy = "Caribex Logistics Group";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Ferry Manifest", {
    properties: { defaultRowHeight: 22 },
    views: [{ showGridLines: false, state: "frozen", ySplit: 5, topLeftCell: "A6" }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalDpi: 300,
      verticalDpi: 300,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: "Page &P of &N" },
  });

  worksheet.columns = [
    { key: "port", width: 15 },
    { key: "number", width: 6 },
    { key: "account", width: 14 },
    { key: "customer", width: 23 },
    { key: "quantity", width: 11 },
    { key: "booking", width: 15 },
    { key: "receiver", width: 20 },
    { key: "container", width: 14 },
    { key: "weekStart", width: 13 },
    { key: "weekEnd", width: 13 },
    { key: "status", width: 14 },
    { key: "submittedAt", width: 20 },
  ];
  worksheet.pageSetup.printTitlesRow = "1:5";
  addManifestHeader(worksheet, data);
  const logoResponse = await fetch("/imagenes/logo-pages.png");
  if (!logoResponse.ok) throw new Error("The Caribex logo could not be loaded. Please try exporting again.");
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  let logoBinary = "";
  for (let index = 0; index < logoBytes.length; index += 1) logoBinary += String.fromCharCode(logoBytes[index]);
  const logoId = workbook.addImage({ base64: "data:image/png;base64," + btoa(logoBinary), extension: "png" });
  worksheet.addImage(logoId, { tl: { col: 5, row: 0 }, ext: { width: 140, height: 60 }, editAs: "absolute" });

  const headerRow = worksheet.getRow(5);
  headerRow.values = [...FERRY_MANIFEST_COLUMNS];
  setHeaderRowStyle(headerRow);
  let currentRow = 6;
  for (const exportRow of getFerryManifestExportRows(data.entries, data.manifest)) {
    const row = worksheet.getRow(currentRow);
    row.height = 32;
    exportRow.values.forEach((value, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      setBaseCellStyle(cell);
      setTextCell(cell, value);
      cell.alignment = {
        horizontal: columnIndex === 1 ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
    });
    row.getCell(1).font = { ...BODY_FONT, bold: true, color: { argb: `FF${FERRY_PORT_STYLES[exportRow.port].color}` } };
    row.getCell(3).font = { ...BODY_FONT, bold: true, color: { argb: `FF${FERRY_PORT_STYLES[exportRow.port].color}` } };
    if ((currentRow - 6) % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.paleBlue } };
      });
    }
    currentRow += 1;
  }

  worksheet.pageSetup.printArea = `A1:L${Math.max(currentRow - 1, 5)}`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `caribex-ferry-manifest-${safeFilenamePart(data.manifest.container_codigo)}.xlsx`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
