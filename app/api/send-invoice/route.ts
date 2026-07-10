import { NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set. Email sending will fail.");
}

export async function POST(request: Request) {
  try {
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

    const safeClientName = clientName && clientName.trim().length > 0 ? clientName : "-";
    const safeClientNumber =
      typeof clientNumber === "number" ? `#${clientNumber}` : "-";

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

    let baseAmount = subtotal;
    let handlingAmount = 0;

    if (subtotal > 0) {
      if (hasHandling) {
        const rawBase = (subtotal - sumFixedExtras) / 1.15;
        if (!Number.isNaN(rawBase) && rawBase > 0) {
          baseAmount = rawBase;
          handlingAmount = baseAmount * 0.15;
        }
      } else {
        const rawBase = subtotal - sumFixedExtras;
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
              <td>Invoice preview</td>
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
                            <div style="font-size:18px; font-weight:700; color:#111827; margin-bottom:4px;">Caribex Logistics Group</div>
                            <div>Roatán, Bay Islands, Honduras</div>
                            <div>billing@caribexlogistics.com</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td valign="top" align="right" style="font-size:12px; color:#4b5563;">
                      <div style="margin-bottom:4px;">Invoice preview</div>
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
                      <div>Preview only</div>
                      <div>$${subtotal.toFixed(2)}</div>
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
                    <tr style="border-bottom:1px solid #e5e7eb;">
                      <td style="padding:8px 0;">
                        <div>${typeLabel}</div>
                        <div style="font-size:12px; color:#6b7280; font-style:italic;">${
                          contents && contents.trim().length > 0 ? contents : tracking
                        }</div>
                      </td>
                      <td align="right">$${baseAmount.toFixed(2)}</td>
                      <td align="right">$${baseAmount.toFixed(2)}</td>
                    </tr>
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
                          <td align="right" style="padding:2px 0;">$${subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style="padding:2px 0 6px 0; border-bottom:1px solid #e5e7eb;">Fee</td>
                          <td align="right" style="padding:2px 0 6px 0; border-bottom:1px solid #e5e7eb;">$${tax.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td style="padding-top:8px; font-weight:700; font-size:15px;">Total Due</td>
                          <td align="right" style="padding-top:8px; font-weight:700; font-size:15px;">$${total.toFixed(2)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div>
                  <div style="font-size:13px; font-weight:600; margin-bottom:4px;">Note</div>
                  <p style="font-size:12px; color:#4b5563; margin:0;">Fee is not a sales tax, but a configurable charge per item to cover customs/duty or handling costs.</p>
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
        from: "billing@caribexlogisticsgroup.com",
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

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error in /api/send-invoice:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
