"use client";

import { useEffect, useState } from "react";
import InvoicePreview from "./InvoicePreview";
import { supabase } from "../lib/supabaseClient";

export type InvoiceViewData = {
  id: string;
  tracking: string;
  clientName?: string | null;
  clientNumber?: number | null;
  carrier?: string | null;
  typeLabel: string;
  contents?: string | null;
  billingSubtotal?: number | null;
  billingTax?: number | null;
  billingTotal?: number | null;
  serviceDate?: string | null;
};

type InvoiceDetails = {
  extraCharges: string[];
  boxSize: string | null;
  isConsolidationBox: boolean;
};

function parseExtraCharges(value: unknown) {
  return String(value || "")
    .split(",")
    .map((charge) => charge.trim())
    .filter(Boolean);
}

function parseBoxSize(data: { alto?: unknown; ancho?: unknown; largo?: unknown } | null) {
  const length = Number(data?.largo);
  const width = Number(data?.ancho);
  const height = Number(data?.alto);
  return [length, width, height].every((value) => Number.isFinite(value) && value > 0)
    ? `${length} x ${width} x ${height} in`
    : null;
}

export default function InvoiceViewModal({ invoice, onClose }: { invoice: InvoiceViewData; onClose: () => void }) {
  const [details, setDetails] = useState<InvoiceDetails>({ extraCharges: [], boxSize: null, isConsolidationBox: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setDetails({ extraCharges: [], boxSize: null, isConsolidationBox: false });

    const loadInvoiceDetails = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("paquetes_checkin")
          .select("alto, ancho, largo, cargos_adicionales, consolidacion")
          .eq("paquete_id", invoice.id)
          .order("creado_en", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (controller.signal.aborted || !active) return;
        if (queryError) throw queryError;

        setDetails({
          extraCharges: parseExtraCharges(data?.cargos_adicionales),
          boxSize: parseBoxSize(data),
          isConsolidationBox: Boolean(data?.consolidacion),
        });
      } catch (queryError) {
        if (controller.signal.aborted || !active) return;
        setError(queryError instanceof Error ? queryError.message : "Saved invoice item details could not be loaded.");
      } finally {
        if (!controller.signal.aborted && active) setLoading(false);
      }
    };

    void loadInvoiceDetails();
    return () => {
      active = false;
      controller.abort();
    };
  }, [invoice.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="pa-modal-overlay" role="presentation">
      <div className="pa-modal" style={{ maxWidth: 900, maxHeight: "90vh", overflowY: "auto" }} role="dialog" aria-modal="true" aria-labelledby="invoice-view-modal-title">
        <div className="pa-modal-header">
          <h2 id="invoice-view-modal-title" className="pa-modal-title">Invoice</h2>
          <button type="button" className="pa-close-btn" onClick={onClose} aria-label="Close invoice">×</button>
        </div>
        {loading && <p role="status" style={{ color: "#64748b", margin: "0 0 1rem" }}>Loading saved invoice items…</p>}
        {error && <p role="alert" style={{ color: "#b91c1c", margin: "0 0 1rem" }}>Saved invoice item details could not be loaded: {error}</p>}
        <InvoicePreview
          clientName={invoice.clientName}
          clientNumber={invoice.clientNumber}
          tracking={invoice.tracking}
          carrier={invoice.carrier}
          typeLabel={invoice.typeLabel}
          contents={invoice.contents}
          boxSize={details.boxSize}
          extraCharges={details.extraCharges}
          isConsolidationBox={details.isConsolidationBox}
          billingSubtotal={invoice.billingSubtotal}
          billingTax={invoice.billingTax}
          billingTotal={invoice.billingTotal}
          serviceDate={invoice.serviceDate}
        />
      </div>
    </div>
  );
}
