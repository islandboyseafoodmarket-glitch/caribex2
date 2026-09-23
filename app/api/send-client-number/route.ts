import { NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

if (!RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set. Email sending will fail.");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { to, name, clientNumberDisplay, initialPassword } = body as {
      to: string;
      name: string;
      clientNumberDisplay: string;
      initialPassword?: string;
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

    const safeName = escapeHtml(name && name.trim().length > 0 ? name.trim() : "Customer");
    const safeAccount = escapeHtml(clientNumberDisplay);
    const safePassword = escapeHtml(initialPassword || "Use the password shown after registration");

    const subject = `Caribex Logistics — Your customer account ${clientNumberDisplay}`;

    const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px;"><div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,.08);">
    <div style="text-align:center;margin-bottom:24px;"><div style="font-size:24px;font-weight:800;color:#0f4c81;">Caribex Logistics Group</div><div style="font-size:12px;color:#64748b;margin-top:4px;">Reliable shipping from the United States to Honduras</div></div>
    <h1 style="font-size:22px;margin:0 0 16px;">Welcome, ${safeName}</h1>
    <p style="line-height:1.6;margin:0 0 14px;">Thank you for creating your Caribex customer account. Your account is ready.</p>
    <p style="line-height:1.6;margin:0 0 14px;">Gracias por crear tu cuenta de cliente Caribex. Tu cuenta ya está lista.</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px;margin:22px 0;"><p style="margin:0 0 8px;font-size:13px;color:#475569;">Customer number / Número de cliente</p><p style="font-size:26px;font-weight:800;color:#1d4ed8;margin:0;">${safeAccount}</p></div>
    <p style="line-height:1.6;margin:0 0 8px;">Use your email address and this temporary password to sign in to the Customer Portal:</p>
    <p style="line-height:1.6;margin:0 0 8px;">Usa tu correo electrónico y esta contraseña temporal para entrar al Portal del Cliente:</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:14px 0 20px;"><p style="margin:0;font-size:12px;color:#64748b;">Temporary password / Contraseña temporal</p><p style="font-size:20px;font-weight:800;margin:6px 0 0;color:#111827;">${safePassword}</p></div>
    <p style="line-height:1.6;margin:0 0 14px;"><strong>For your security, you must create a new password after your first sign-in.</strong><br /><strong>Por tu seguridad, debes crear una nueva contraseña después de tu primer ingreso.</strong></p>
    <p style="line-height:1.6;margin:0;">Need help? Contact Caribex at <strong>+50489467476</strong>.<br />¿Necesitas ayuda? Comunícate con Caribex al <strong>+50489467476</strong>.</p>
  </div><p style="font-size:12px;color:#64748b;text-align:center;margin:16px 0 0;">This is an automatic message. Please do not reply to this email.</p></div>
</body></html>`;

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
