import { NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set. Email sending will fail.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { to, name, clientNumberDisplay } = body as {
      to: string;
      name: string;
      clientNumberDisplay: string;
    };

    if (!to || !clientNumberDisplay) {
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

    const safeName = name && name.trim().length > 0 ? name.trim() : "Cliente";

    const subject = `Tu n\u00famero de cliente Caribex: ${clientNumberDisplay}`;

    const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827;">
    <h1 style="font-size:20px; font-weight:700; margin-bottom:16px;">Hola ${safeName},</h1>
    <p style="margin-bottom:12px;">Gracias por registrarte en <strong>Caribex Logistics Group</strong>.</p>
    <p style="margin-bottom:12px;">Tu <strong>n\u00famero de cliente</strong> es:</p>
    <p style="font-size:28px; font-weight:700; color:#2563eb; margin-bottom:16px;">${clientNumberDisplay}</p>
    <p style="margin-bottom:12px;">Por favor, guarda este n\u00famero. Lo necesitar\u00e1s para gestionar tus env\u00edos y consultas.</p>
    <hr style="margin:16px 0; border:none; border-top:1px solid #e5e7eb;" />
    <p style="font-size:12px; color:#6b7280;">Este es un correo autom\u00e1tico, por favor no respondas a este mensaje.</p>
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
      console.error("Resend API error (send-client-number):", errText);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error in /api/send-client-number:", e);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
