import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type LookupType = "on-account" | "unclaimed" | "other-account";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const tracking = String(body?.tracking || "").trim();
    if (!tracking || tracking.length > 120) return NextResponse.json({ error: "Enter an exact tracking number" }, { status: 400 });

    const supabase = adminClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user?.email) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    const { data: customer, error: customerError } = await supabase
      .from("numero_cliente")
      .select("id")
      .eq("email", authData.user.email.toLowerCase())
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });

    const { data: matches, error: shipmentError } = await supabase
      .from("paquetes_registro")
      .select("id, tracking, numero_cliente_id, estado")
      .eq("tracking", tracking)
      .order("creado_en", { ascending: false })
      .limit(20);
    if (shipmentError) throw shipmentError;
    if (!matches?.length) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "private, no-store" } });

    const ownMatch = matches.find((shipment) => shipment.numero_cliente_id === customer.id);
    const shipment = ownMatch || matches[0];
    const matchType: LookupType = ownMatch
      ? "on-account"
      : shipment.numero_cliente_id == null
        ? "unclaimed"
        : "other-account";

    // The customer only needs the simple result for someone else's assigned tracking number.
    // For unassigned receiving records, the creation event is the warehouse intake scan.
    let lastScannedAt: string | null = null;
    if (matchType !== "other-account") {
      const { data: scanEvent, error: scanError } = await supabase
        .from("staff_action_logs")
        .select("created_at")
        .eq("entity_type", "paquetes_registro")
        .eq("entity_id", shipment.id)
        .in("action", ["package_scanned", "receiving_package_created"])
        .eq("success", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!scanError && typeof scanEvent?.created_at === "string") lastScannedAt = scanEvent.created_at;
    }

    return NextResponse.json({
      found: true,
      matchType,
      ...(matchType !== "other-account" ? { status: shipment.estado || null, lastScannedAt } : {}),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not search tracking number" }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
