import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function auth(request: Request, supabase: SupabaseClient) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication is required");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authentication token");
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(),
    supabase.from("personal").select("id").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!admin && !staff) throw new Error("Staff access is required");
  return { user: data.user, role: admin ? "admin" : "staff" };
}
export async function POST(request: Request) {
  try {
    const supabase = client();
    const staff = await auth(request, supabase);
    const body = await request.json();
    const paths = Array.isArray(body?.signature_paths) ? body.signature_paths.filter((path: unknown) => typeof path === "string" && path.length < 200000) : [];
    let shipmentIds = Array.isArray(body?.shipment_ids) ? body.shipment_ids.filter((id: unknown) => typeof id === "string") : [];
    const trackings = Array.isArray(body?.trackings) ? body.trackings.filter((tracking: unknown) => typeof tracking === "string") : [];
    if (!shipmentIds.length && trackings.length) {
      const { data: shipments } = await supabase.from("paquetes_registro").select("id").in("tracking", trackings).limit(100);
      shipmentIds = (shipments || []).map((shipment: { id: string }) => shipment.id);
    }
    if (!paths.length || !shipmentIds.length) return NextResponse.json({ error: "A signature and at least one shipment are required" }, { status: 400 });
    const { data, error } = await supabase.from("pickup_signatures").insert({ numero_cliente_id: body?.customer_id || null, shipment_ids: shipmentIds, trackings, signature_paths: paths, captured_by: staff.user.id, captured_by_role: staff.role }).select("id, signed_at, shipment_ids, trackings").single();
    if (error) throw error;
    await supabase.from("staff_action_logs").insert({ actor_id: staff.user.id, actor_name: staff.role === "admin" ? "Admin" : "Staff", actor_email: staff.user.email || null, actor_role: staff.role, action: "pickup_signature_saved", entity_type: "pickup_signatures", entity_id: data.id, success: true, details: { shipment_count: shipmentIds.length } });
    return NextResponse.json({ ok: true, signature: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save pickup signature";
    return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 });
  }
}
