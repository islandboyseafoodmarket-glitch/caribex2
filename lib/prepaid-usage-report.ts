import { PDFDocument, PDFPage, PDFFont, PDFImage, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PrepaidReportCustomer {
  id: string;
  name: string | null;
  accountNumber: string | number | null;
  port: string | null;
  email: string;
}

export interface PrepaidReportShipment {
  id: string;
  tracking: string | null;
  carrier: string | null;
  type: string | null;
  stage: string | null;
  contents: string | null;
  length: number | string | null;
  width: number | string | null;
  height: number | string | null;
  storedCubicFeet: number | string | null;
  date: string | null;
  containerLabels: string[];
}

export interface PrepaidUsageReportInput {
  customer: PrepaidReportCustomer;
  allowance: number;
  used: number;
  remaining: number;
  rate: number;
  shipments: PrepaidReportShipment[];
}

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 28;
const FOOTER_HEIGHT = 22;
const BODY_BOTTOM = MARGIN + FOOTER_HEIGHT;
const BODY_TOP = PAGE_HEIGHT - MARGIN;
const BODY_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_LEADING = 11;

const COLORS = {
  ink: rgb(0.07, 0.10, 0.16),
  muted: rgb(0.28, 0.34, 0.42),
  blue: rgb(0.08, 0.30, 0.51),
  line: rgb(0.82, 0.86, 0.91),
  paleBlue: rgb(0.93, 0.96, 1),
  paleRed: rgb(1, 0.95, 0.95),
  paleGreen: rgb(0.94, 0.99, 0.95),
  paleAmber: rgb(1, 0.99, 0.92),
  palePurple: rgb(0.97, 0.96, 1),
};

function latinText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00d7/g, "x")
    .replace(/\u00b3/g, "3")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7e\x80-\xff]/g, "?");
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function cubicFeetForPrepaidShipment(shipment: Pick<PrepaidReportShipment, "storedCubicFeet" | "length" | "width" | "height">): number {
  const stored = finiteNumber(shipment.storedCubicFeet);
  if (stored > 0) return stored;
  const dimensions = [shipment.length, shipment.width, shipment.height].map((value) => finiteNumber(value));
  if (!dimensions.every((value) => value > 0)) return 0;
  return Number(((dimensions[0] * dimensions[1] * dimensions[2]) / 1728).toFixed(2));
}

function formatNumber(value: unknown, digits = 2): string {
  return finiteNumber(value).toFixed(digits);
}

function formatDimensions(shipment: PrepaidReportShipment): string {
  const values = [shipment.length, shipment.width, shipment.height].map((value) => finiteNumber(value));
  return values.every((value) => value > 0) ? `${formatNumber(values[0])} x ${formatNumber(values[1])} x ${formatNumber(values[2])} in` : "-";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return latinText(value);
  return parsed.toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function wrapText(value: unknown, font: PDFFont, size: number, maxWidth: number): string[] {
  const text = latinText(value).trim() || "-";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  const pushLongWord = (word: string) => {
    let piece = "";
    for (const character of word) {
      const candidate = piece + character;
      if (piece && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(piece);
        piece = character;
      } else {
        piece = candidate;
      }
    }
    if (piece) line = piece;
  };

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      pushLongWord(word);
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function drawFooter(page: PDFPage, pageNumber: number, font: PDFFont) {
  page.drawLine({ start: { x: MARGIN, y: MARGIN + FOOTER_HEIGHT - 5 }, end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + FOOTER_HEIGHT - 5 }, thickness: 0.5, color: COLORS.line });
  page.drawText(`Caribex Logistics Group | Prepaid usage report | Page ${pageNumber}`, { x: MARGIN, y: MARGIN + 3, size: 10, font, color: COLORS.muted });
}

function drawHeader(page: PDFPage, input: PrepaidUsageReportInput, regular: PDFFont, bold: PDFFont, logo: PDFImage | null) {
  const customerName = latinText(input.customer.name || "Customer");
  const account = latinText(input.customer.accountNumber ?? "-");
  let titleX = MARGIN;
  if (logo) {
    const scaled = logo.scale(Math.min(1, 72 / logo.width));
    page.drawImage(logo, { x: MARGIN, y: BODY_TOP - scaled.height, width: scaled.width, height: scaled.height });
    titleX = MARGIN + scaled.width + 12;
  }
  page.drawText("Prepaid Cubic-Foot Usage", { x: titleX, y: BODY_TOP - 15, size: 16, font: bold, color: COLORS.blue });
  page.drawText(`${customerName} | Account #${account} | ${latinText(input.customer.port || "Port not provided")}`, { x: titleX, y: BODY_TOP - 32, size: 10, font: regular, color: COLORS.muted });
  page.drawText("Generated by Caribex Logistics Group", { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize("Generated by Caribex Logistics Group", 10), y: BODY_TOP - 15, size: 10, font: regular, color: COLORS.muted });
}

function drawSummary(page: PDFPage, input: PrepaidUsageReportInput, regular: PDFFont, bold: PDFFont, y: number): number {
  const cards = [
    { label: "Allowance", value: `${formatNumber(input.allowance)} ft3`, fill: COLORS.paleBlue },
    { label: "Used", value: `${formatNumber(input.used)} ft3`, fill: COLORS.paleRed },
    { label: "Remaining", value: `${formatNumber(input.remaining)} ft3`, fill: COLORS.paleGreen },
    { label: "Rate", value: `$${formatNumber(input.rate)}/ft3`, fill: COLORS.paleAmber },
    { label: "Report shipments", value: String(input.shipments.length), fill: COLORS.palePurple },
  ];
  const gap = 8;
  const width = (BODY_WIDTH - gap * (cards.length - 1)) / cards.length;
  const height = 54;
  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap);
    page.drawRectangle({ x, y: y - height, width, height, color: card.fill, borderColor: COLORS.line, borderWidth: 0.7 });
    page.drawText(card.label, { x: x + 8, y: y - 17, size: 10, font: regular, color: COLORS.muted });
    page.drawText(card.value, { x: x + 8, y: y - 39, size: 14, font: bold, color: COLORS.ink });
  });
  return y - height - 16;
}

const COLUMNS: Array<{ key: string; label: string; width: number }> = [
  { key: "tracking", label: "Tracking", width: 88 },
  { key: "carrier", label: "Carrier", width: 70 },
  { key: "type", label: "Type", width: 62 },
  { key: "stage", label: "Stage", width: 68 },
  { key: "contents", label: "Contents", width: 126 },
  { key: "dimensions", label: "Dimensions", width: 84 },
  { key: "cubicFeet", label: "Cubic feet", width: 58 },
  { key: "usageValue", label: "Usage value", width: 72 },
  { key: "date", label: "Date", width: 100 },
];

function rowValues(shipment: PrepaidReportShipment, rate: number): Record<string, string> {
  const cubicFeet = cubicFeetForPrepaidShipment(shipment);
  return {
    tracking: shipment.tracking || "-",
    carrier: shipment.carrier || "-",
    type: shipment.type || "-",
    stage: shipment.stage || "-",
    contents: shipment.contents || "-",
    dimensions: formatDimensions(shipment),
    cubicFeet: `${formatNumber(cubicFeet)} ft3`,
    usageValue: `$${formatNumber(cubicFeet * finiteNumber(rate))}`,
    date: formatDate(shipment.date),
  };
}

function drawTableHeader(page: PDFPage, y: number, regular: PDFFont, bold: PDFFont): number {
  const height = 22;
  let x = MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - height, width: BODY_WIDTH, height, color: COLORS.blue });
  COLUMNS.forEach((column) => {
    page.drawText(column.label, { x: x + 4, y: y - 15, size: 10, font: bold, color: rgb(1, 1, 1), maxWidth: column.width - 8 });
    x += column.width;
  });
  return y - height;
}

function drawRow(page: PDFPage, y: number, shipment: PrepaidReportShipment, rate: number, regular: PDFFont): number {
  const values = rowValues(shipment, rate);
  const wrapped = COLUMNS.map((column) => wrapText(values[column.key], regular, 10, column.width - 8));
  const lineCount = Math.max(...wrapped.map((lines) => lines.length));
  const height = Math.max(22, lineCount * ROW_LEADING + 8);
  let x = MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - height, width: BODY_WIDTH, height, color: rgb(1, 1, 1), borderColor: COLORS.line, borderWidth: 0.45 });
  COLUMNS.forEach((column, columnIndex) => {
    const lines = wrapped[columnIndex];
    lines.forEach((line, lineIndex) => {
      page.drawText(line, { x: x + 4, y: y - 14 - lineIndex * ROW_LEADING, size: 10, font: regular, color: COLORS.ink });
    });
    x += column.width;
  });
  return y - height;
}

export async function createPrepaidUsageReportPdf(input: PrepaidUsageReportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | null = null;
  try {
    const logoBytes = await readFile(path.join(process.cwd(), "public", "imagenes", "logo-clean.png"));
    logo = await pdf.embedPng(logoBytes);
  } catch {
    // The PDF remains valid and branded by text if an optional local logo is unavailable.
  }

  let pageNumber = 0;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pageNumber += 1;
  drawHeader(page, input, regular, bold, logo);
  let y = BODY_TOP - 64;
  y = drawSummary(page, input, regular, bold, y);

  const groups = new Map<string, PrepaidReportShipment[]>();
  for (const shipment of input.shipments) {
    const labels = Array.from(new Set((shipment.containerLabels || []).map((label) => latinText(label).trim()).filter(Boolean)));
    const groupLabel = labels.length ? labels.join(", ") : "No container assigned";
    const group = groups.get(groupLabel) || [];
    group.push(shipment);
    groups.set(groupLabel, group);
  }
  if (!groups.size) groups.set("No shipments", []);

  const addPage = () => {
    drawFooter(page, pageNumber, regular);
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    drawHeader(page, input, regular, bold, logo);
    y = BODY_TOP - 64;
  };
  const ensureSpace = (height: number) => {
    if (y - height < BODY_BOTTOM) addPage();
  };

  for (const [groupLabel, shipments] of Array.from(groups.entries())) {
    ensureSpace(42);
    page.drawText(groupLabel, { x: MARGIN, y: y - 13, size: 12, font: bold, color: COLORS.blue });
    page.drawText(`${shipments.length} shipment${shipments.length === 1 ? "" : "s"}`, { x: MARGIN, y: y - 29, size: 10, font: regular, color: COLORS.muted });
    y -= 38;
    if (!shipments.length) {
      page.drawText("No shipments recorded for this prepaid account.", { x: MARGIN, y: y - 12, size: 10, font: regular, color: COLORS.muted });
      y -= 28;
      continue;
    }
    ensureSpace(24);
    y = drawTableHeader(page, y, regular, bold);
    for (const shipment of shipments) {
      const values = rowValues(shipment, input.rate);
      const wrapped = COLUMNS.map((column) => wrapText(values[column.key], regular, 10, column.width - 8));
      const rowHeight = Math.max(22, Math.max(...wrapped.map((lines) => lines.length)) * ROW_LEADING + 8);
      if (y - rowHeight < BODY_BOTTOM) {
        addPage();
        page.drawText(`${groupLabel} (continued)`, { x: MARGIN, y: y - 13, size: 12, font: bold, color: COLORS.blue });
        y -= 24;
        y = drawTableHeader(page, y, regular, bold);
      }
      y = drawRow(page, y, shipment, input.rate, regular) - 4;
    }
    y -= 8;
  }

  drawFooter(page, pageNumber, regular);
  pdf.setTitle(`Prepaid Cubic-Foot Usage - ${latinText(input.customer.name || "Customer")}`);
  pdf.setAuthor("Caribex Logistics Group");
  pdf.setSubject("Prepaid usage report");
  return pdf.save();
}
