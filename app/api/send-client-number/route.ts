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

    const { to, name, phone, port, accountType, clientNumberDisplay, initialPassword } = body as {
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
    const isDeveloperAccount = /developer|builder|desarrollador|constructor/i.test(accountType || "");
    const accountDescription = isBusinessAccount ? "business shipping account" : "customer shipping account";
    const accountDescriptionEs = isBusinessAccount ? "cuenta comercial de envíos" : "cuenta personal de envíos";
    const safeAccount = escapeHtml(clientNumberDisplay);
    const safePassword = escapeHtml(initialPassword || "Use the password shown after registration");
    let portalLoginUrl = "https://www.caribexlogisticsgroup.com/portal/login";
    // The server-controlled production URL is authoritative; never trust a browser-supplied origin here.
    const safePortalUrl = escapeHtml(portalLoginUrl);

    const subject = isDeveloperAccount
      ? `Caribex Logistics — Developer / Builder account received ${clientNumberDisplay}`
      : `Caribex Logistics — Your ${isBusinessAccount ? "business" : "personal"} account ${clientNumberDisplay}`;
    const welcomeCopy = isDeveloperAccount
      ? `<p style="line-height:1.6;margin:0 0 14px;">Thank you for registering for a Caribex Developer / Builder prepaid account. Your account has been received and your prepaid allowance will be shown in the Customer Portal.</p><p style="line-height:1.6;margin:0 0 18px;">Gracias por registrarse para una cuenta prepaga de Desarrollador / Constructor de Caribex. Su cuenta fue recibida y su límite prepago aparecerá en el Portal del Cliente.</p>`
      : `<p style="line-height:1.6;margin:0 0 14px;">Thank you for opening a Caribex ${accountDescription}. Your account has been activated and is ready for use.</p><p style="line-height:1.6;margin:0 0 18px;">Gracias por abrir una ${accountDescriptionEs} con Caribex. Tu cuenta ya está activa.</p>`;
    const allowanceGuidance = isDeveloperAccount
      ? `<h2 style="font-size:17px;margin:24px 0 10px;">How the prepaid program works</h2><ol style="line-height:1.7;margin:0 0 16px;padding-left:22px;"><li>Caribex records your project, expected volume, and account information.</li><li>Caribex assigns a prepaid cubic-foot allowance to your account.</li><li>Your allowance is reduced as eligible shipments are received and measured.</li><li>You can view your allowance, used cubic feet, and remaining balance in the Customer Portal.</li><li>Shipments that exceed the remaining allowance may require Admin approval before operational completion.</li></ol><p style="line-height:1.6;margin:0 0 14px;">A prepaid allowance is not a guaranteed discount or an automatic rate approval. Your final rate and allowance are confirmed by Caribex.</p>`
      : "";

    const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;padding:28px 16px;"><div style="background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,.08);">
    <div style="text-align:center;margin-bottom:24px;"><div style="font-size:24px;font-weight:800;color:#0f4c81;">Caribex Logistics Group</div><div style="font-size:12px;color:#64748b;margin-top:4px;">Customer account activation</div></div>
    <h1 style="font-size:22px;margin:0 0 16px;">Welcome, ${safeName}</h1>
    ${welcomeCopy}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px;margin:22px 0;"><h2 style="font-size:16px;margin:0 0 12px;color:#1e3a8a;">Account profile / Perfil de cuenta</h2><p style="margin:6px 0;"><strong>Name / Nombre:</strong> ${safeName}</p><p style="margin:6px 0;"><strong>Email:</strong> ${safeEmail}</p><p style="margin:6px 0;"><strong>Phone / Teléfono:</strong> ${safePhone}</p><p style="margin:6px 0;"><strong>Port / Puerto:</strong> ${safePort}</p><p style="margin:6px 0;"><strong>Account type / Tipo de cuenta:</strong> ${safeAccountType}</p><p style="margin:14px 0 0;font-size:13px;color:#475569;">Customer account number / Número de cuenta</p><p style="font-size:26px;font-weight:800;color:#1d4ed8;margin:4px 0 0;">${safeAccount}</p></div>
    <h2 style="font-size:17px;margin:24px 0 10px;">Your Caribex receiving address</h2>
    <p style="line-height:1.6;margin:0 0 10px;">Use this address when ordering from U.S. retailers or suppliers:</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0 18px;font-weight:700;line-height:1.6;">${safeName}<br />1092 NE Industrial Blvd<br />Jensen Beach, FL 34957<br />United States</div>
    <p style="line-height:1.6;margin:0 0 14px;">Do not place the account number in the shipping address. Keep it only as your Caribex account and portal reference.</p>
    ${allowanceGuidance}
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin:18px 0;"><h2 style="font-size:16px;color:#9a3412;margin:0 0 8px;">Important order requirements</h2><p style="line-height:1.6;margin:0;">The name on every order must exactly match the name registered with Caribex, and the address must be entered correctly. Caribex is not responsible for shipments delayed, misrouted, lost, returned, refused, or otherwise affected because of a name mismatch, incorrect or incomplete address, misspelled information, or missing delivery details.</p><p style="line-height:1.6;margin:10px 0 0;">El nombre de cada pedido debe coincidir exactamente con el nombre registrado en Caribex y la dirección debe escribirse correctamente. Caribex no se responsabiliza por envíos afectados por diferencias en el nombre, una dirección incorrecta o incompleta, información mal escrita o datos faltantes.</p></div>
    <h2 style="font-size:17px;margin:24px 0 10px;">Customer Portal access</h2>
    <p style="line-height:1.6;margin:0 0 12px;">Use the portal to view your account status, shipment history, shipment statuses, shipment counts, invoices, and—when applicable—ferry information for your assigned port.</p>
    <p style="text-align:center;margin:18px 0;"><a href="${safePortalUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Open Customer Portal</a></p>
    <p style="line-height:1.6;margin:0 0 8px;">For your first sign-in, use your registered email and this temporary password:</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:12px 0 16px;"><p style="margin:0;font-size:12px;color:#64748b;">Temporary password / Contraseña temporal</p><p style="font-size:20px;font-weight:800;margin:6px 0 0;color:#111827;">${safePassword}</p></div>
    <p style="line-height:1.6;margin:0 0 14px;">After signing in, create a new password when prompted. Supabase automatically creates the secure authentication account connected to this customer profile.</p>
    ${isDeveloperAccount ? '<p style="line-height:1.6;margin:0 0 14px;"><strong>What you should do next:</strong> Keep this email, sign in to the portal, and send any requested project or account information to Caribex. We will update your account after the Admin review and allowance assignment are complete.</p>' : ''}
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
        from: "info@caribexlogisticsgroup.com",
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
