import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set. Email sending will fail.");
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bearer = request.headers.get("authorization") || "";
    if (!url || !serviceKey || !bearer.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const authClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: authData } = await authClient.auth.getUser(bearer.slice(7));
    if (!authData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const [{ data: admin }, { data: staff }] = await Promise.all([
      authClient.from("administradores").select("id").eq("id", authData.user.id).maybeSingle(),
      authClient.from("personal").select("id").eq("id", authData.user.id).maybeSingle(),
    ]);
    if (!admin && !staff) return NextResponse.json({ error: "Admin or staff access required" }, { status: 403 });
    const body = await request.json();

    const {
      to,
      subject,
      clientName,
      clientNumber,
      tracking,
      typeLabel,
      contents,
      subtotal,
      tax,
      total,
      extraCharges,
      isConsolidationBox,
      consolidatedPackagesCount,
      serviceDate,
    } = body as {
      to: string;
      subject: string;
      clientName?: string | null;
      clientNumber?: number | null;
      tracking: string;
      typeLabel: string;
      contents?: string | null;
      subtotal: number;
      tax: number;
      total: number;
      extraCharges?: string[];
      isConsolidationBox?: boolean;
      consolidatedPackagesCount?: number | null;
      serviceDate?: string | null;
    };

    if (!to || !subject || !tracking) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 },
      );
    }

    type InvoiceItem = { tracking: string; typeLabel: string; contents?: string | null; subtotal: number; tax: number; total: number };
    let invoiceItems: InvoiceItem[] = [{
      tracking,
      typeLabel,
      contents,
      subtotal: Number(subtotal) || 0,
      tax: Number(tax) || 0,
      total: Number(total) || 0,
    }];
    let resolvedServiceDate = serviceDate || null;
    let groupedShipmentIds: string[] = [];

    // Invoices are grouped by customer and operational container. This keeps
    // one customer from receiving a separate email for every item in the same
    // shipment/container while preserving each item's tracking and charge.
    const { data: currentShipment } = await authClient
      .from("paquetes_registro")
      .select("id, tracking, numero_cliente_id, estado, billing_subtotal, billing_tax, billing_total")
      .eq("tracking", tracking)
      .neq("estado", "Archivado")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (currentShipment) {
      const [{ data: currentLink }, { data: currentCheckin }] = await Promise.all([
        authClient
        .from("contenedor_paquetes")
        .select("contenedor_id")
        .eq("paquete_id", currentShipment.id)
        .limit(1)
        .maybeSingle(),
        authClient
          .from("paquetes_checkin")
          .select("parent_box_id")
          .eq("paquete_id", currentShipment.id)
          .order("creado_en", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      let containerId = currentLink?.contenedor_id || null;
      if (!containerId && currentCheckin?.parent_box_id) {
        const { data: parentLink } = await authClient
          .from("contenedor_paquetes")
          .select("contenedor_id")
          .eq("paquete_id", currentCheckin.parent_box_id)
          .limit(1)
          .maybeSingle();
        containerId = parentLink?.contenedor_id || null;
      }
      if (containerId) {
        const [{ data: container }, { data: links }] = await Promise.all([
          authClient.from("contenedores").select("creado_en").eq("id", containerId).limit(1).maybeSingle(),
          authClient.from("contenedor_paquetes").select("paquete_id").eq("contenedor_id", containerId).limit(5000),
        ]);
        resolvedServiceDate = resolvedServiceDate || container?.creado_en || null;
        const packageIds = (links || []).map((link) => link.paquete_id).filter(Boolean);
        if (packageIds.length) {
          const { data: directRows } = await authClient
            .from("paquetes_registro")
            .select("id, tracking, tipo_paquete, contenido, numero_cliente_id, estado, billing_subtotal, billing_tax, billing_total")
            .in("id", packageIds)
            .eq("numero_cliente_id", currentShipment.numero_cliente_id)
            .neq("estado", "Archivado")
            .limit(5000);
          const direct = directRows || [];
          const directIds = direct.map((row) => row.id);
          const { data: childLinks } = directIds.length
            ? await authClient.from("paquetes_checkin").select("paquete_id, parent_box_id").in("parent_box_id", directIds).limit(5000)
            : { data: [] };
          const childIds = Array.from(new Set((childLinks || []).map((link) => link.paquete_id).filter((id) => !directIds.includes(id))));
          const { data: childRows } = childIds.length
            ? await authClient
                .from("paquetes_registro")
                .select("id, tracking, tipo_paquete, contenido, numero_cliente_id, estado, billing_subtotal, billing_tax, billing_total")
                .in("id", childIds)
                .eq("numero_cliente_id", currentShipment.numero_cliente_id)
                .neq("estado", "Archivado")
                .limit(5000)
            : { data: [] };
          const rows = [...direct, ...(childRows || [])];
          if (rows.length > 1) {
            groupedShipmentIds = rows.map((row) => row.id);
            invoiceItems = rows.map((row) => {
              const isCurrent = row.id === currentShipment.id;
              return {
                tracking: row.tracking,
                typeLabel: childIds.includes(row.id) ? `Consolidated ${row.tipo_paquete || "Package"}` : row.tipo_paquete || "Shipment",
                contents: row.contenido || null,
                subtotal: Number(isCurrent && !Number(row.billing_subtotal) ? subtotal : row.billing_subtotal) || 0,
                tax: Number(isCurrent && !Number(row.billing_tax) ? tax : row.billing_tax) || 0,
                total: Number(isCurrent && !Number(row.billing_total) ? total : row.billing_total) || 0,
              };
            });
          }
        }
      }
    }
    const invoiceSubtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const invoiceTax = invoiceItems.reduce((sum, item) => sum + item.tax, 0);
    const invoiceTotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

    const safeClientName = clientName && clientName.trim().length > 0 ? clientName : "-";
    const safeClientNumber =
      typeof clientNumber === "number" ? `#${clientNumber}` : "-";
    const parsedServiceDate = resolvedServiceDate ? new Date(resolvedServiceDate) : null;
    const safeServiceDate = parsedServiceDate && Number.isFinite(parsedServiceDate.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Tegucigalpa",
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }).format(parsedServiceDate)
      : "-";

    const extrasList = Array.isArray(extraCharges) ? extraCharges : [];

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

    let baseAmount = invoiceSubtotal;
    let handlingAmount = 0;

    if (invoiceItems.length === 1 && invoiceSubtotal > 0) {
      if (hasHandling) {
        const rawBase = (invoiceSubtotal - sumFixedExtras) / 1.15;
        if (!Number.isNaN(rawBase) && rawBase > 0) {
          baseAmount = rawBase;
          handlingAmount = baseAmount * 0.15;
        }
      } else {
        const rawBase = invoiceSubtotal - sumFixedExtras;
        if (!Number.isNaN(rawBase) && rawBase > 0) {
          baseAmount = rawBase;
        }
      }
    }

    const getExtraAmountForLabel = (label: string): number => {
      if (label === "Handling fees") {
        return handlingAmount > 0 ? handlingAmount : 0;
      }
      const fixed = FIXED_EXTRA_AMOUNTS[label];
      return typeof fixed === "number" ? fixed : 0;
    };

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0f172a; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; width:100%; background-color:#020617; color:#f9fafb; border-radius:12px 12px 0 0; padding:16px 24px; font-size:13px; text-transform:uppercase; letter-spacing:0.08em;">
            <tr>
              <td>Invoice</td>
              <td align="right">Tracking ${tracking}</td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; color:#111827; border-radius:0 0 12px 12px; padding:24px 28px 24px 28px;">
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td valign="top" style="padding-right:12px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="font-size:12px; color:#4b5563;">
                            <img src="https://www.caribexlogisticsgroup.com/imagenes/logo-pages.png" alt="Caribex Logistics Group" width="180" style="display:block; width:180px; height:auto; margin-bottom:10px;" />
                            <div style="font-size:18px; font-weight:700; color:#111827; margin-bottom:4px;">Caribex Logistics Group</div>
                            <div>Roatán, Bay Islands, Honduras</div>
                            <div>billing@caribexlogisticsgroup.com</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td valign="top" align="right" style="font-size:12px; color:#4b5563;">
                      <div style="margin-bottom:4px;">Invoice</div>
                      <div>Tracking</div>
                      <div style="font-weight:600;">${tracking}</div>
                    </td>
                  </tr>
                </table>

                <div style="height:2px; background-color:#f97316; margin-bottom:20px;"></div>

                <h1 style="font-size:20px; font-weight:700; margin:0 0 20px 0;">Invoice for ${safeClientName}${
                  safeClientNumber !== "-" ? ` (${safeClientNumber})` : ""
                }</h1>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px; font-size:13px;">
                  <tr>
                    <td valign="top" style="padding-right:16px;">
                      <div style="font-weight:600; margin-bottom:6px;">Customer</div>
                      <div>${safeClientName}</div>
                      <div>${safeClientNumber}</div>
                    </td>
                    <td valign="top" style="padding-right:16px;">
                      <div style="font-weight:600; margin-bottom:6px;">Invoice details</div>
                      <div>Subtotal</div>
                      <div>$${invoiceSubtotal.toFixed(2)}</div>
                      <div style="margin-top:8px;">Date of service</div>
                      <div>${safeServiceDate}</div>
                    </td>
                    <td valign="top" align="right">
                      <div style="font-weight:600; margin-bottom:6px;">Payment</div>
                      <div>Due on delivery</div>
                      <div>$${total.toFixed(2)}</div>
                    </td>
                  </tr>
                </table>

                <div style="font-weight:600; font-size:14px; margin-bottom:8px;">Items</div>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px; margin-bottom:20px;">
                  <thead>
                    <tr style="border-bottom:1px solid #e5e7eb;">
                      <th align="left" style="padding:6px 0; font-weight:600; font-size:12px;">Item</th>
                      <th align="right" style="padding:6px 0; font-weight:600; font-size:12px; width:110px;">Price</th>
                      <th align="right" style="padding:6px 0; font-weight:600; font-size:12px; width:110px;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${invoiceItems.map((item) => `<tr style="border-bottom:1px solid #e5e7eb;">
                      <td style="padding:8px 0;"><div>${item.typeLabel}</div><div style="font-size:12px; color:#6b7280; font-style:italic;">${item.contents && item.contents.trim().length > 0 ? item.contents : item.tracking}</div><div style="font-size:11px; color:#6b7280;">Tracking: ${item.tracking}</div></td>
                      <td align="right">$${item.subtotal.toFixed(2)}</td>
                      <td align="right">$${item.subtotal.toFixed(2)}</td>
                    </tr>`).join("")}
                    ${extrasList
                      .map((label) => {
                        const amount = getExtraAmountForLabel(label);
                        return `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;"><div>${label}</div></td><td align="right">$${amount.toFixed(
                          2,
                        )}</td><td align="right">$${amount.toFixed(2)}</td></tr>`;
                      })
                      .join("")}
                    ${
                      isConsolidationBox && typeof consolidatedPackagesCount === "number"
                        ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;"><div>Consolidation box$${
                            consolidatedPackagesCount > 0
                              ? ` with ${consolidatedPackagesCount} packages`
                              : ""
                          }</div></td><td align="right">$0.00</td><td align="right">$0.00</td></tr>`
                        : ""
                    }
                  </tbody>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                  <tr>
                    <td align="right">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:260px; font-size:13px;">
                        <tr>
                          <td style="padding:2px 0;">Subtotal</td>
                          <td align="right" style="padding:2px 0;">$${invoiceSubtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style="padding:2px 0 6px 0; border-bottom:1px solid #e5e7eb;">Fee</td>
                          <td align="right" style="padding:2px 0 6px 0; border-bottom:1px solid #e5e7eb;">$${invoiceTax.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style="padding-top:8px; font-weight:700; font-size:15px;">Total Due</td>
                          <td align="right" style="padding-top:8px; font-weight:700; font-size:15px;">$${invoiceTotal.toFixed(2)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div>
                  <div style="font-size:13px; font-weight:600; margin-bottom:4px;">Note</div>
                  <p style="font-size:12px; color:#4b5563; margin:0;">Fee is not a sales tax, but a configurable charge per item to cover customs/duty or handling costs.</p>
                </div>

                <div style="margin-top:24px; padding:16px; background-color:#eff6ff; border-radius:10px; text-align:center;">
                  <div style="font-size:14px; font-weight:700; color:#1e3a8a; margin-bottom:6px;">View your shipments and invoices online</div>
                  <div style="font-size:12px; color:#475569; margin-bottom:12px;">Sign in to your Caribex customer portal to review your shipment history, status, and invoice history.</div>
                  <a href="https://www.caribexlogisticsgroup.com/portal/login" style="display:inline-block; padding:10px 18px; background-color:#2563eb; color:#ffffff; border-radius:7px; font-size:13px; font-weight:700; text-decoration:none;">Access customer portal</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CARIBEX <billing@caribexlogisticsgroup.com>",
        to,
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend API error:", errText);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 502 },
      );
    }

    if (groupedShipmentIds.length) {
      const { error: groupedStatusError } = await authClient
        .from("paquetes_registro")
        .update({ invoice_status: "SENT" })
        .in("id", groupedShipmentIds);
      if (groupedStatusError) throw groupedStatusError;
    }

    const { data: actorProfile } = await authClient
      .from("personal")
      .select("nombre, nombre_personal, rol")
      .eq("id", authData.user.id)
      .maybeSingle();
    await authClient.from("staff_action_logs").insert({
      actor_id: authData.user.id,
      actor_name: actorProfile?.nombre || actorProfile?.nombre_personal || authData.user.email || null,
      actor_email: authData.user.email || null,
      actor_role: admin ? "admin" : "staff",
      action: "send_invoice",
      entity_type: "invoice_email",
      tracking,
      customer_name: clientName || null,
      customer_account_number: typeof clientNumber === "number" ? clientNumber : null,
      success: true,
      details: { recipient: to, subject, total, sender: "CARIBEX <billing@caribexlogisticsgroup.com>" },
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ ok: true, groupedItemCount: invoiceItems.length });
  } catch (e: any) {
    console.error("Error in /api/send-invoice:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
