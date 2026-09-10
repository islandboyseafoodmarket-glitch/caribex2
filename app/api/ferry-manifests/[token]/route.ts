import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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
      .select("id, manifiesto_id, puerto, numero_cuenta, nombre_cliente, etiqueta_cantidad, numero_reserva, nombre_receptor, enviado_en")
      .eq("manifiesto_id", manifest.id)
      .order("puerto", { ascending: true })
      .order("nombre_cliente", { ascending: true }),
    supabaseAdmin.from("contenedores").select("codigo").eq("id", manifest.contenedor_id).maybeSingle(),
  ]);
  if (entriesError) throw entriesError;
  if (containerError) throw containerError;

  return { manifest: { ...manifest, container_codigo: container?.codigo || null }, entries: entries || [] };
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
    const receiverName = String(body?.nombre_receptor || "").trim();
    if (!entryId || !bookingNumber) return NextResponse.json({ error: "A booking number is required" }, { status: 400 });
    if (bookingNumber.length > 100 || receiverName.length > 255) return NextResponse.json({ error: "The submitted value is too long" }, { status: 400 });

    const supabaseAdmin = getAdminClient();
    const { data: manifest, error: manifestError } = await supabaseAdmin
      .from("ferry_manifests")
      .select("id, estado")
      .eq("token", params.token)
      .maybeSingle();
    if (manifestError) throw manifestError;
    if (!manifest) return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    if (manifest.estado !== "active") return NextResponse.json({ error: "This manifest is read-only" }, { status: 409 });

    const { error } = await supabaseAdmin
      .from("ferry_manifest_entries")
      .update({ numero_reserva: bookingNumber, nombre_receptor: receiverName || null, enviado_en: new Date().toISOString() })
      .eq("id", entryId)
      .eq("manifiesto_id", manifest.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not submit booking" }, { status: 500 });
  }
}
