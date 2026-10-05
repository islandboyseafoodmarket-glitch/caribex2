import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
function publicOrigin(_request: Request) {
  return "https://www.caribexlogisticsgroup.com";
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getManifest(token: string) {
  const supabaseAdmin = getAdminClient();
  const { data: manifest, error: manifestError } = await supabaseAdmin
    .from("ferry_manifests")
    .select("id, token, semana_inicio, semana_fin, estado, contenedor_id")
    .eq("token", token)
    .maybeSingle();
  if (manifestError) throw manifestError;
  if (!manifest) return null;

  const [{ data: entries, error: entriesError }, { data: container, error: containerError }] = await Promise.all([
    supabaseAdmin
      .from("ferry_manifest_entries")
      .select("id, manifiesto_id, paquete_id, numero_cliente_id, puerto, numero_cuenta, nombre_cliente, etiqueta_cantidad, numero_reserva, nombre_receptor, enviado_en")
      .eq("manifiesto_id", manifest.id)
      .order("puerto", { ascending: true })
      .order("nombre_cliente", { ascending: true }),
    supabaseAdmin.from("contenedores").select("codigo").eq("id", manifest.contenedor_id).maybeSingle(),
  ]);
  if (entriesError) throw entriesError;
  if (containerError) throw containerError;

  const grouped = new Map<string, any>();
  for (const entry of entries || []) {
    const key = `${entry.numero_cliente_id}:${entry.puerto}`;
    const current = grouped.get(key);
    if (current) {
      current.package_count += 1;
      current.package_ids.push(entry.paquete_id);
      if (!current.numero_reserva && entry.numero_reserva) current.numero_reserva = entry.numero_reserva;
      if (!current.nombre_receptor && entry.nombre_receptor) current.nombre_receptor = entry.nombre_receptor;
      if (!current.enviado_en && entry.enviado_en) current.enviado_en = entry.enviado_en;
    } else {
      grouped.set(key, {
        ...entry,
        package_count: 1,
        package_ids: [entry.paquete_id],
        etiqueta_cantidad: "BOX= 1",
      });
    }
  }
  Array.from(grouped.values()).forEach((entry) => {
    entry.etiqueta_cantidad = `BOX= ${entry.package_count}`;
  });
  return { manifest: { ...manifest, container_codigo: container?.codigo || null }, entries: Array.from(grouped.values()) };
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    if (!params.token || params.token.length < 32) return NextResponse.json({ error: "Invalid manifest link" }, { status: 400 });
    const result = await getManifest(params.token);
    if (!result) return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not load manifest" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { token: string } }) {
  try {
    if (!params.token || params.token.length < 32) return NextResponse.json({ error: "Invalid manifest link" }, { status: 400 });
    const body = await request.json();
    const entryId = String(body?.entry_id || "");
    const bookingNumber = String(body?.numero_reserva || "").trim();
    const adminEdit = body?.admin_edit === true;
    const sendNotification = body?.notify === true;
    if (!entryId || !bookingNumber) return NextResponse.json({ error: "A booking number is required" }, { status: 400 });
    if (bookingNumber.length > 100) return NextResponse.json({ error: "The submitted value is too long" }, { status: 400 });

    const supabaseAdmin = getAdminClient();
    if (adminEdit) {
      const bearer = request.headers.get("authorization") || "";
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(bearer.replace(/^Bearer\s+/i, ""));
      if (authError || !authData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      const { data: admin } = await supabaseAdmin.from("administradores").select("id").eq("id", authData.user.id).maybeSingle();
      if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }
    const { data: manifest, error: manifestError } = await supabaseAdmin
      .from("ferry_manifests")
      .select("id, estado")
      .eq("token", params.token)
      .maybeSingle();
    if (manifestError) throw manifestError;
    if (!manifest) return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    if (manifest.estado !== "active" && !adminEdit) return NextResponse.json({ error: "This manifest is read-only" }, { status: 409 });

    const { data: entry, error: entryLookupError } = await supabaseAdmin
      .from("ferry_manifest_entries")
      .select("id, paquete_id, numero_cliente_id, numero_cuenta, nombre_cliente, puerto")
      .eq("id", entryId)
      .eq("manifiesto_id", manifest.id)
      .maybeSingle();
    if (entryLookupError) throw entryLookupError;
    if (!entry) return NextResponse.json({ error: "Manifest entry not found" }, { status: 404 });

    const { data: customerEntries, error: customerEntriesError } = await supabaseAdmin
      .from("ferry_manifest_entries")
      .select("id, paquete_id")
      .eq("manifiesto_id", manifest.id)
      .eq("numero_cliente_id", entry.numero_cliente_id)
      .eq("puerto", entry.puerto);
    if (customerEntriesError) throw customerEntriesError;

    const { error } = await supabaseAdmin
      .from("ferry_manifest_entries")
      .update({ numero_reserva: bookingNumber, enviado_en: new Date().toISOString() })
      .eq("manifiesto_id", manifest.id)
      .eq("numero_cliente_id", entry.numero_cliente_id)
      .eq("puerto", entry.puerto);
    if (error) throw error;

    let emailSent = false;
    const isNotFound = bookingNumber.toUpperCase() === "NO";
    if (sendNotification && !isNotFound && RESEND_API_KEY && entry.numero_cliente_id) {
      const [{ data: customer }, { data: packageRow }] = await Promise.all([
        supabaseAdmin.from("numero_cliente").select("nombre, email, puerto").eq("id", entry.numero_cliente_id).maybeSingle(),
        supabaseAdmin.from("paquetes_registro").select("tracking, contenido, notas").in("id", (customerEntries || []).map((item) => item.paquete_id)),
      ]);
      if (customer?.email) {
        const safeName = escapeHtml(customer.nombre || entry.nombre_cliente || "Customer");
        const safeBooking = escapeHtml(bookingNumber);
        const safeTracking = escapeHtml((packageRow || []).map((item: any) => item.tracking).filter(Boolean).join(", ") || "your shipment");
        const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:620px;margin:auto"><h1 style="color:#0f4c81">Caribex Logistics Group</h1><h2>Ferry booking confirmed</h2><p>Hello ${safeName},</p><p>Your ferry booking number has been confirmed for ${customerEntries?.length || 1} shipment${(customerEntries?.length || 1) === 1 ? "" : "s"}.</p><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px"><p><strong>Booking number:</strong> ${safeBooking}</p><p><strong>Tracking:</strong> ${safeTracking}</p><p><strong>Port:</strong> ${escapeHtml(customer.puerto || entry.puerto || "-")}</p></div><p>Please keep this booking number for pickup and future reference. You can view your shipment status and ferry bookings in the <a href="${escapeHtml(`${publicOrigin(request)}/portal/login`)}">Caribex Customer Portal</a>.</p><p>Thank you,<br />Caribex Logistics Group</p></div>`;
        const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "info@caribexlogisticsgroup.com", to: customer.email, subject: `Ferry booking confirmed: ${bookingNumber}`, html }) });
        emailSent = sent.ok;
      }
    }
    return NextResponse.json({ ok: true, email_sent: emailSent });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not submit booking" }, { status: 500 });
  }
}
