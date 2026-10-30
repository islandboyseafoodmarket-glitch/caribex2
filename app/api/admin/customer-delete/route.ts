import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : String(error || fallback);
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: admin, error: adminLookupError } = await supabase
      .from("administradores")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (adminLookupError) throw adminLookupError;
    if (!admin) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }

    let body: { customer_id?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A valid JSON body is required" }, { status: 400 });
    }
    const customerId = typeof body.customer_id === "string" ? body.customer_id.trim() : "";
    if (!customerId) {
      return NextResponse.json({ error: "Customer id is required" }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabase
      .from("numero_cliente")
      .select("id, nombre, email, auth_user_id")
      .eq("id", customerId)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) {
      return NextResponse.json({ error: "Customer not found; nothing was deleted" }, { status: 404 });
    }

    let authCleanup: "deleted" | "not_linked" | "retained_shared" = "not_linked";
    const authUserId = typeof customer.auth_user_id === "string" ? customer.auth_user_id : "";

    if (authUserId) {
      const [customerLinks, adminLink, staffLink] = await Promise.all([
        supabase
          .from("numero_cliente")
          .select("id")
          .eq("auth_user_id", authUserId)
          .limit(100),
        supabase.from("administradores").select("id").eq("id", authUserId).maybeSingle(),
        supabase.from("personal").select("id").eq("id", authUserId).maybeSingle(),
      ]);
      if (customerLinks.error) throw customerLinks.error;
      if (adminLink.error) throw adminLink.error;
      if (staffLink.error) throw staffLink.error;

      const belongsOnlyToCustomer =
        (customerLinks.data || []).length === 1 &&
        customerLinks.data?.[0]?.id === customerId &&
        !adminLink.data &&
        !staffLink.data;
      authCleanup = belongsOnlyToCustomer ? "deleted" : "retained_shared";
    }

    // Preserve the existing Admin-approved intent: delete check-ins, packages, then the customer.
    const { error: checkinDeleteError } = await supabase
      .from("paquetes_checkin")
      .delete()
      .eq("numero_cliente_id", customerId);
    if (checkinDeleteError) {
      return NextResponse.json(
        { error: `Could not delete customer check-ins: ${checkinDeleteError.message}` },
        { status: 500 },
      );
    }

    const { error: packageDeleteError } = await supabase
      .from("paquetes_registro")
      .delete()
      .eq("numero_cliente_id", customerId);
    if (packageDeleteError) {
      return NextResponse.json(
        { error: `Could not delete customer packages: ${packageDeleteError.message}` },
        { status: 500 },
      );
    }

    const { error: customerDeleteError } = await supabase
      .from("numero_cliente")
      .delete()
      .eq("id", customerId);
    if (customerDeleteError) {
      return NextResponse.json(
        { error: `Could not delete customer: ${customerDeleteError.message}` },
        { status: 500 },
      );
    }

    if (authCleanup === "deleted") {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) {
        return NextResponse.json(
          {
            error: `Customer data was deleted, but the linked portal login could not be deleted: ${deleteAuthError.message}`,
            partial: true,
            auth_deleted: false,
          },
          { status: 502 },
        );
      }
    }

    if (authCleanup === "retained_shared") {
      return NextResponse.json({
        ok: true,
        auth_deleted: false,
        warning:
          "Customer and packages were deleted, but the linked login was retained because it is shared with another customer or belongs to Admin/staff. No login was deleted.",
      });
    }

    if (authCleanup === "not_linked") {
      return NextResponse.json({
        ok: true,
        auth_deleted: false,
        warning:
          "Customer and packages were deleted, but no linked portal login was found. This operation never deletes Auth users by email; if signup still says the email is registered, use the existing-login recovery flow or have an Administrator review that email.",
      });
    }

    return NextResponse.json({ ok: true, auth_deleted: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error, "Could not delete customer") },
      { status: 500 },
    );
  }
}
