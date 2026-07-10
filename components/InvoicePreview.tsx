"use client";

import React from "react";

export type InvoicePreviewProps = {
  clientName?: string | null;
  clientNumber?: number | null;
  tracking: string;
  carrier?: string | null;
  typeLabel: string;
  contents?: string | null;
  extraCharges?: string[];
  isConsolidationBox?: boolean;
  consolidatedPackagesCount?: number;
  billingSubtotal?: number | null;
  billingTax?: number | null;
  billingTotal?: number | null;
};

const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  clientName,
  clientNumber,
  tracking,
  carrier,
  typeLabel,
  contents,
  extraCharges,
  isConsolidationBox,
  consolidatedPackagesCount,
  billingSubtotal,
  billingTax,
  billingTotal,
}) => {
  const safeClientName = clientName && clientName.trim().length > 0 ? clientName : "-";
  const safeClientNumber =
    typeof clientNumber === "number" ? `#${clientNumber}` : "-";

  const subtotal =
    typeof billingSubtotal === "number" && !Number.isNaN(billingSubtotal)
      ? billingSubtotal
      : 0;
  const fee =
    typeof billingTax === "number" && !Number.isNaN(billingTax) ? billingTax : 0;
  const total =
    typeof billingTotal === "number" && !Number.isNaN(billingTotal)
      ? billingTotal
      : subtotal + fee;

  // Calcular desglose de BASE y cargos extra a partir del subtotal y la lista
  // de extraCharges. Esto es solo para mostrar la factura; no modifica los
  // montos ya guardados en la BD.
  const extrasList = extraCharges || [];

  // Montos fijos conocidos por etiqueta
  const FIXED_EXTRA_AMOUNTS: Record<string, number> = {
    "Consolidation fee ($2.5)": 2.5,
    "Forklift charge ($100)": 100,
    "Miscellaneous fee ($10)": 10,
  };

  const hasHandling = extrasList.includes("Handling fees");

  const sumFixedExtras = extrasList.reduce((acc, label) => {
    const v = FIXED_EXTRA_AMOUNTS[label];
    return acc + (typeof v === "number" ? v : 0);
  }, 0);

  let baseAmount = subtotal;
  let handlingAmount = 0;

  if (subtotal > 0) {
    if (hasHandling) {
      // Fórmula: subtotal = base + extrasFijos + 0.15 * base = 1.15 * base + extrasFijos
      // => base = (subtotal - extrasFijos) / 1.15
      const rawBase = (subtotal - sumFixedExtras) / 1.15;
      if (!Number.isNaN(rawBase) && rawBase > 0) {
        baseAmount = rawBase;
        handlingAmount = baseAmount * 0.15;
      }
    } else {
      // Sin manejo de carga: subtotal = base + extrasFijos
      const rawBase = subtotal - sumFixedExtras;
      if (!Number.isNaN(rawBase) && rawBase > 0) {
        baseAmount = rawBase;
      }
    }
  }

  // Helper para obtener el monto de cada cargo extra individual
  const getExtraAmountForLabel = (label: string): number => {
    if (label === "Handling fees") {
      return handlingAmount > 0 ? handlingAmount : 0;
    }
    const fixed = FIXED_EXTRA_AMOUNTS[label];
    return typeof fixed === "number" ? fixed : 0;
  };

  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111827",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/imagenes/logo.png"
            alt="Caribex logo"
            style={{ width: 40, height: 40, objectFit: "contain" }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              Caribex Logistics Group
            </div>
            <div style={{ fontSize: 12, color: "#4b5563" }}>
              <div>Roatán, Bay Islands, Honduras</div>
              <div>billing@caribexlogistics.com</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 12, color: "#4b5563" }}>
          <div style={{ marginBottom: 4 }}>Invoice preview</div>
          <div>Tracking</div>
          <div style={{ fontWeight: 600 }}>{tracking}</div>
        </div>
      </header>

      <div
        style={{
          height: 2,
          backgroundColor: "#f97316",
          marginBottom: 20,
        }}
      />

      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 20,
        }}
      >
        Invoice for {safeClientName} {safeClientNumber !== "-" ? `(${safeClientNumber})` : ""}
      </h1>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 20,
          marginBottom: 24,
          fontSize: 13,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Customer</div>
          <div>{safeClientName}</div>
          <div>{safeClientNumber}</div>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Invoice details</div>
          <div>Preview only</div>
          <div>${subtotal.toFixed(2)}</div>
        </div>

        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Payment</div>
          <div>Due on delivery</div>
          <div>${total.toFixed(2)}</div>
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Items</div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "6px 0" }}>Item</th>
              <th style={{ textAlign: "right", padding: "6px 0", width: 110 }}>
                Price
              </th>
              <th style={{ textAlign: "right", padding: "6px 0", width: 110 }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "8px 0" }}>
                <div>{typeLabel}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    fontStyle: "italic",
                  }}
                >
                  {contents && contents.trim().length > 0 ? contents : tracking}
                </div>
              </td>
              <td style={{ textAlign: "right" }}>${baseAmount.toFixed(2)}</td>
              <td style={{ textAlign: "right" }}>${baseAmount.toFixed(2)}</td>
            </tr>

            {extrasList.map((label, idx) => {
              const amount = getExtraAmountForLabel(label);
              const hasAmount = typeof amount === "number" && amount > 0;

              return (
                <tr key={`extra-${idx}`} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 0" }}>
                    <div>{label}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {hasAmount ? `$${amount.toFixed(2)}` : ""}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {hasAmount ? `$${amount.toFixed(2)}` : ""}
                  </td>
                </tr>
              );
            })}

            {isConsolidationBox && typeof consolidatedPackagesCount === "number" && (
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 0" }}>
                  <div>
                    Consolidation box
                    {consolidatedPackagesCount > 0
                      ? ` with ${consolidatedPackagesCount} packages`
                      : ""}
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>$0.00</td>
                <td style={{ textAlign: "right" }}>$0.00</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 16,
        }}
      >
        <div style={{ width: 260, fontSize: 13 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "2px 0",
            }}
          >
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "2px 0 6px 0",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <span>Fee</span>
            <span>${fee.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 8,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            <span>Total Due</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <section>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Note</div>
        <p style={{ fontSize: 12, color: "#4b5563", margin: 0 }}>
          Fee is not a sales tax, but a configurable charge per item to cover
          customs/duty or handling costs.
        </p>
      </section>
    </div>
  );
};

export default InvoicePreview;
