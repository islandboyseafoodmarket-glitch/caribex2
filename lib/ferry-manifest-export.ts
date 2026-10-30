export type FerryManifestEntry = {
  id: string;
  puerto: "la_ceiba" | "utila" | "guanaja";
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
} as const;

export function formatFerryAccountNumber(value: string, port: Port): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const prefix = FERRY_PORT_STYLES[port].prefix;
  if (new RegExp(`^${prefix}(?:[-\\s])?\\d+$`, "i").test(raw)) return raw.replace(/^[a-z]/i, prefix);
  return /^\d+$/.test(raw) ? `${prefix}${raw}` : raw;
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

type Border = {
  style: "thin" | "medium";
  color: { argb: string };
};

const PORTS: Array<{ key: Port; label: string }> = [
  { key: "la_ceiba", label: "La Ceiba Customers" },
  { key: "utila", label: "Utila Customers" },
  { key: "guanaja", label: "Guanaja Customers" },
];

const COLORS = {
  navy: "000000",
  blue: "000000",
  lightBlue: "FFFFFF",
  paleBlue: "FFFFFF",
  border: "000000",
  text: "000000",
  muted: "000000",
  white: "FFFFFF",
};

const BODY_FONT: Font = { name: "Arial", size: 11, color: { argb: COLORS.text } };
const LABEL_FONT: Font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.muted } };
const HEADER_FONT: Font = { name: "Arial", size: 11, bold: true, color: { argb: COLORS.text } };
const SECTION_FONT: Font = { name: "Arial", size: 12, bold: true, underline: true, color: { argb: COLORS.navy } };

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
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.white } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.navy } },
      left: { style: "thin", color: { argb: COLORS.navy } },
      bottom: { style: "thin", color: { argb: COLORS.navy } },
      right: { style: "thin", color: { argb: COLORS.navy } },
    };
  });
}

function setBandStyle(row: Row) {
  row.height = 25;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = SECTION_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lightBlue } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "medium", color: { argb: COLORS.blue } },
      bottom: { style: "medium", color: { argb: COLORS.blue } },
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
  worksheet.mergeCells("A1:D1");
  const title = worksheet.getCell("A1");
  title.value = "CARIBEX FERRY REPORT";
  setFont(title, { name: "Arial", size: 16, bold: true, color: { argb: COLORS.text } });
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.white } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 31;

  worksheet.mergeCells("A2:D2");
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
    views: [{ showGridLines: false, state: "frozen", ySplit: 4, topLeftCell: "A5" }],
    pageSetup: {
      orientation: "portrait",
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
    { key: "number", width: 5 },
    { key: "account", width: 11 },
    { key: "customer", width: 29 },
    { key: "quantity", width: 12 },
    { key: "booking", width: 16 },
    { key: "receiver", width: 27 },
  ];
  worksheet.pageSetup.printTitlesRow = "1:4";
  addManifestHeader(worksheet, data);
  const logoResponse = await fetch("/imagenes/logo-pages.png");
  if (!logoResponse.ok) throw new Error("The Caribex logo could not be loaded. Please try exporting again.");
  const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
  let logoBinary = "";
  for (let index = 0; index < logoBytes.length; index += 1) logoBinary += String.fromCharCode(logoBytes[index]);
  const logoId = workbook.addImage({ base64: "data:image/png;base64," + btoa(logoBinary), extension: "png" });
  worksheet.addImage(logoId, { tl: { col: 4, row: 0 }, ext: { width: 140, height: 60 }, editAs: "absolute" });

  let currentRow = 5;
  for (const port of PORTS) {
    const entries = data.entries.filter((entry) => entry.puerto === port.key);
    if (!entries.length) continue;

    const bandRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(currentRow, 1, currentRow, 6);
    const bandCell = worksheet.getCell(currentRow, 1);
    bandCell.value = port.label.toUpperCase();
    setBandStyle(bandRow);
    setFont(bandCell, SECTION_FONT);
    bandRow.height = 25;
    currentRow += 1;

    const sectionHeader = worksheet.getRow(currentRow);
    sectionHeader.values = ["No.", "Account Number", "Customer Name", "Quantity", "Booking #", "Receiver Name"];
    setHeaderRowStyle(sectionHeader);
    currentRow += 1;

    entries.forEach((entry, index) => {
      const row = worksheet.getRow(currentRow);
      row.height = 32;
      const values = [
        String(index + 1),
        formatFerryAccountNumber(entry.numero_cuenta, entry.puerto),
        entry.nombre_cliente,
        entry.etiqueta_cantidad,
        entry.numero_reserva || "",
        entry.nombre_receptor || "",
      ];
      values.forEach((value, columnIndex) => {
        const cell = row.getCell(columnIndex + 1);
        setBaseCellStyle(cell);
        if (columnIndex === 0) {
          setTextCell(cell, value);
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if (columnIndex === 1 || columnIndex === 4) {
          setTextCell(cell, value);
          cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        } else {
          cell.value = value;
          cell.alignment = { vertical: "middle", wrapText: true };
        }
      });

      row.getCell(2).font = { ...BODY_FONT, bold: true, color: { argb: `FF${FERRY_PORT_STYLES[entry.puerto].color}` } };
      const receiverCell = row.getCell(6);
      receiverCell.border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };
      currentRow += 1;
    });
  }

  worksheet.pageSetup.printArea = `A1:F${Math.max(currentRow - 1, 4)}`;
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
