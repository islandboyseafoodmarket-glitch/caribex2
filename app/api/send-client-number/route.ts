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

    const { to, name, phone, port, accountType, clientNumberDisplay, initialPassword, portalUrl } = body as {
      to: string;
      name: string;
      phone?: string;
      port?: string;
      accountType?: string;
      clientNumberDisplay: string;
      initialPassword?: string;
      portalUrl?: string;
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
    const safeEmail = escapeHtml(to.trim().toLowerCase());
    const safePhone = escapeHtml(phone?.trim() || "Not provided");
    const safePort = escapeHtml(port?.trim() || "Not provided");
    const safeAccountType = escapeHtml(accountType?.trim() || "Business");
    const isBusinessAccount = /business|negocio|empresa/i.test(accountType || "");
    const accountDescription = isBusinessAccount ? "business shipping account" : "customer shipping account";
    const accountDescriptionEs = isBusinessAccount ? "cuenta comercial de envíos" : "cuenta personal de envíos";
    const safeAccount = escapeHtml(clientNumberDisplay);
    const safePassword = escapeHtml(initialPassword || "Use the password shown after registration");
    let portalLoginUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.caribexlogisticsgroup.com"}/portal/login`;
    try {
      const candidate = new URL(portalUrl || portalLoginUrl);
      const isLocalhost = candidate.hostname === "localhost" || candidate.hostname === "127.0.0.1" || candidate.hostname === "0.0.0.0";
      if ((candidate.protocol === "http:" || candidate.protocol === "https:") && !isLocalhost) {
        portalLoginUrl = `${candidate.origin}/portal/login`;
      }
    } catch {
      // Keep the server-derived portal URL when the client value is invalid.
    }
    const safePortalUrl = escapeHtml(portalLoginUrl);

    const subject = `Caribex Logistics — Your ${isBusinessAccount ? "business" : "personal"} account ${clientNumberDisplay}`;

    const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;padding:28px 16px;"><div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,.08);">
    <div style="text-align:center;margin-bottom:24px;"><div style="font-size:24px;font-weight:800;color:#0f4c81;">Caribex Logistics Group</div><div style="font-size:12px;color:#64748b;margin-top:4px;">Customer account activation</div></div>
    <h1 style="font-size:22px;margin:0 0 16px;">Welcome, ${safeName}</h1>
    <p style="line-height:1.6;margin:0 0 14px;">Thank you for opening a Caribex ${accountDescription}. Your account has been activated and is ready for use.</p>
    <p style="line-height:1.6;margin:0 0 18px;">Gracias por abrir una ${accountDescriptionEs} con Caribex. Tu cuenta ya está activa.</p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px;margin:22px 0;"><h2 style="font-size:16px;margin:0 0 12px;color:#1e3a8a;">Account profile / Perfil de cuenta</h2><p style="margin:6px 0;"><strong>Name / Nombre:</strong> ${safeName}</p><p style="margin:6px 0;"><strong>Email:</strong> ${safeEmail}</p><p style="margin:6px 0;"><strong>Phone / Teléfono:</strong> ${safePhone}</p><p style="margin:6px 0;"><strong>Port / Puerto:</strong> ${safePort}</p><p style="margin:6px 0;"><strong>Account type / Tipo de cuenta:</strong> ${safeAccountType}</p><p style="margin:14px 0 0;font-size:13px;color:#475569;">Customer account number / Número de cuenta</p><p style="font-size:26px;font-weight:800;color:#1d4ed8;margin:4px 0 0;">${safeAccount}</p></div>
    <h2 style="font-size:17px;margin:24px 0 10px;">Your Caribex receiving address</h2>
    <p style="line-height:1.6;margin:0 0 10px;">Use this address when ordering from U.S. retailers or suppliers:</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0 18px;font-weight:700;line-height:1.6;">${safeName}<br />1092 NE Industrial Blvd<br />Jensen Beach, FL 34957<br />United States</div>
    <p style="line-height:1.6;margin:0 0 14px;">Do not place the account number in the shipping address. Keep it only as your Caribex account and portal reference.</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin:18px 0;"><h2 style="font-size:16px;color:#9a3412;margin:0 0 8px;">Important order requirements</h2><p style="line-height:1.6;margin:0;">The name on every order must exactly match the name registered with Caribex, and the address must be entered correctly. Caribex is not responsible for shipments delayed, misrouted, lost, returned, refused, or otherwise affected because of a name mismatch, incorrect or incomplete address, misspelled information, or missing delivery details.</p><p style="line-height:1.6;margin:10px 0 0;">El nombre de cada pedido debe coincidir exactamente con el nombre registrado en Caribex y la dirección debe escribirse correctamente. Caribex no se responsabiliza por envíos afectados por diferencias en el nombre, una dirección incorrecta o incompleta, información mal escrita o datos faltantes.</p></div>
    <h2 style="font-size:17px;margin:24px 0 10px;">Customer Portal access</h2>
    <p style="line-height:1.6;margin:0 0 12px;">Use the portal to view shipment history, shipment statuses, shipment counts, invoices, and ferry bookings.</p>
    <p style="text-align:center;margin:18px 0;"><a href="${safePortalUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Open Customer Portal</a></p>
    <p style="line-height:1.6;margin:0 0 8px;">For your first sign-in, use your registered email and this temporary password:</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0 16px;"><p style="margin:0;font-size:12px;color:#64748b;">Temporary password / Contraseña temporal</p><p style="font-size:20px;font-weight:800;margin:6px 0 0;color:#111827;">${safePassword}</p></div>
    <p style="line-height:1.6;margin:0 0 14px;">After signing in, create a new password when prompted. Supabase automatically creates the secure authentication account connected to this customer profile.</p>
    <p style="line-height:1.6;margin:0;">Need help? Contact Caribex at <strong>+50489467476</strong>.<br />¿Necesitas ayuda? Comunícate con Caribex al <strong>+50489467476</strong>.</p>
  </div><p style="font-size:12px;color:#64748b;text-align:center;margin:16px 0 0;">This is an automatic account-activation message. Please retain it for your business records.</p></div>
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
