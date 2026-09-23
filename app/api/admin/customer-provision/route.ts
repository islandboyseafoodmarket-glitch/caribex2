import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const supabase = client();
    const bearer = request.headers.get("authorization") || "";
    const { data: authData } = await supabase.auth.getUser(bearer.startsWith("Bearer ") ? bearer.slice(7) : "");
    if (!authData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { data: admin } = await supabase.from("administradores").select("id").eq("id", authData.user.id).maybeSingle();
    if (!admin) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

    const { customer_id } = await request.json();
    const { data: customer } = await supabase.from("numero_cliente").select("id, nombre, email, numero_cliente, auth_user_id").eq("id", customer_id).maybeSingle();
    if (!customer?.email || !customer.numero_cliente) return NextResponse.json({ error: "Customer email and account number are required" }, { status: 400 });
    if (customer.auth_user_id) return NextResponse.json({ error: "This customer already has portal access" }, { status: 409 });

    const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.users.find((user) => user.email?.toLowerCase() === customer.email.toLowerCase());
    let userId = existing?.id;
    if (!userId) {
      const created = await supabase.auth.admin.createUser({ email: customer.email, password: `Caribex${customer.numero_cliente}`, email_confirm: true, user_metadata: { customer_account_number: customer.numero_cliente, must_change_password: true } });
      if (created.error || !created.data.user) return NextResponse.json({ error: created.error?.message || "Could not create customer portal account" }, { status: 400 });
      userId = created.data.user.id;
    }
    const { error: linkError } = await supabase.from("numero_cliente").update({ auth_user_id: userId }).eq("id", customer.id);
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
    await supabase.from("customer_portal_login_events").insert({
      email: customer.email,
      customer_name: customer.nombre,
      account_number: customer.numero_cliente,
      event_type: "portal_access_provisioned",
      success: true,
      reason: `Portal access provisioned for customer account #${customer.numero_cliente}`,
    });
    return NextResponse.json({ ok: true, initial_password: `Caribex${customer.numero_cliente}` });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not provision customer portal access" }, { status: 500 });
  }
}
