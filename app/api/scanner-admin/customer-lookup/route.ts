import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isArchivedShipment, isInvoiceOnlyShipment, isPickedUpShipment } from "@/lib/shipment-eligibility";
export const dynamic = "force-dynamic";
function adminClient() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("Supabase server environment variables are missing"); return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); }
async function requireStaff(request: Request, supabase: SupabaseClient) { const auth = request.headers.get("authorization") || ""; if (!auth.startsWith("Bearer ")) throw new Error("Authentication is required"); const { data, error } = await supabase.auth.getUser(auth.slice(7)); if (error || !data.user) throw new Error("Invalid authentication token"); const [{ data: admin }, { data: staff }] = await Promise.all([supabase.from("administradores").select("id").eq("id", data.user.id).maybeSingle(), supabase.from("personal").select("id").eq("id", data.user.id).maybeSingle()]); if (!admin && !staff) throw new Error("Staff access is required"); }
function errorResponse(error: unknown) { const message = error instanceof Error ? error.message : "Unexpected error"; return NextResponse.json({ error: message }, { status: /authentication|token|access|required/i.test(message) ? 401 : 500 }); }
export async function GET(request: Request) {
  try {
    const supabase = adminClient(); await requireStaff(request, supabase);
    const url = new URL(request.url); const query = url.searchParams.get("query")?.trim() || ""; const clientId = url.searchParams.get("client_id")?.trim() || "";
    if (!query && !clientId) return NextResponse.json({ customers: [] });
    let lookup = supabase.from("numero_cliente").select("id, numero_cliente, nombre, email, telefono, puerto").limit(20);
    const accountQuery = query.replace(/^[A-Za-z][-\s]?/, "");
    if (clientId) lookup = lookup.eq("id", clientId); else if (/^\d+$/.test(accountQuery)) lookup = lookup.eq("numero_cliente", Number(accountQuery)); else lookup = lookup.ilike("nombre", `%${query}%`);
    const { data: customers, error: customerError } = await lookup; if (customerError) throw customerError;
    if (!clientId) return NextResponse.json({ customers: customers || [] });
    const client = customers?.[0]; if (!client) return NextResponse.json({ client: null, shipments: [], bills: [], totals: { billed: 0, paid: 0, owed: 0 } });
    const { data: shipments, error: shipmentError } = await supabase.from("paquetes_registro").select("id, tracking, nombre_paqueteria, tipo_paquete, contenido, notas, notas_imagenes, estado, issue_status, registro, creado_en, hora_fecha, fecha_descargado, hora_descargado, fecha_entregado, hora_entregado, billing_subtotal, billing_tax, billing_total, invoice_status, payment_method, payment_reference, payment_date, payment_notes").eq("numero_cliente_id", client.id).neq("estado", "Archivado").order("registro", { ascending: false }).limit(5000); if (shipmentError) throw shipmentError;
    const ids = (shipments || []).map((row) => row.id); const [{ data: links, error: linkError }, { data: balances, error: balanceError }, { data: parentLinks, error: parentLinkError }] = await Promise.all([
      ids.length ? supabase.from("contenedor_paquetes").select("paquete_id, contenedor_id").in("paquete_id", ids).limit(5000) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("invoice_payment_balances").select("invoice_id, billing_total, paid, balance, invoice_status").in("invoice_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? supabase.from("paquetes_checkin").select("paquete_id, parent_box_id").in("paquete_id", ids).limit(5000) : Promise.resolve({ data: [], error: null }),
    ]); if (linkError) throw linkError; if (balanceError) throw balanceError; if (parentLinkError) throw parentLinkError;
    const containerIds = Array.from(new Set((links || []).map((row) => row.contenedor_id).filter(Boolean))); const { data: containers, error: containerError } = containerIds.length ? await supabase.from("contenedores").select("id, codigo, creado_en").in("id", containerIds) : { data: [], error: null }; if (containerError) throw containerError;
    const containerById = new Map((containers || []).map((row) => [row.id, row])); const containerByPackage = new Map((links || []).map((row) => [row.paquete_id, containerById.get(row.contenedor_id) || null])); const balanceById = new Map((balances || []).map((row) => [row.invoice_id, row]));
    const childIds = new Set((parentLinks || []).map((row) => row.paquete_id).filter(Boolean)); const insideCount = new Map<string, number>(); for (const row of parentLinks || []) if (row.parent_box_id) insideCount.set(row.parent_box_id, (insideCount.get(row.parent_box_id) || 0) + 1);
    const enriched = (shipments || []).map((row) => { const balance = balanceById.get(row.id); const billed = Number(balance?.billing_total ?? row.billing_total ?? 0) || 0; const paid = Number(balance?.paid ?? 0) || 0; const owed = Math.max(Number(balance?.balance ?? billed - paid), 0); return { ...row, container: containerByPackage.get(row.id) || null, inside_count: insideCount.get(row.id) || 0, billing: { billed, paid, owed, status: owed <= 0 && billed > 0 ? "Paid" : paid > 0 ? "Partially paid" : billed > 0 ? "Unpaid" : "No invoice" } }; });
    const totals = enriched.reduce((sum, row) => ({ billed: sum.billed + row.billing.billed, paid: sum.paid + row.billing.paid, owed: sum.owed + row.billing.owed }), { billed: 0, paid: 0, owed: 0 });
    const waiting_shipments = enriched.filter((row) => !childIds.has(row.id) && !isInvoiceOnlyShipment(row) && !isArchivedShipment(row) && !isPickedUpShipment(row));
    const waiting_count = waiting_shipments.length;
    return NextResponse.json({ client, shipments: enriched, waiting_shipments, bills: enriched.filter((row) => row.billing.billed > 0), totals, waiting_count });
  } catch (error) { return errorResponse(error); }
}
