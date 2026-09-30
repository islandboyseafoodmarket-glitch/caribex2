import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.1.9",
      version_code: 119,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/qQbFhqVLDCYRcobu.apk",
      filename: "Caribex-Warehouse-Management-1.1.9.apk",
      release_notes: [
        "Web-equivalent Receiving, Check In, consolidation, and customer assignment",
        "Client Pickup now shows every shipment tracking number with the authoritative invoice status",
        "Client Pickup search now matches the compact reference-style search control",
        "Internal staff notes and problem photos now verify and display after saving",
        "Carrier detection uses the complete scanner payload before normalizing tracking",
        "Home, Sync, Settings, rescan, and Client Pickup actions",
        "Already Picked Up warning for shipments already marked Entregado / Recogido",
        "Scanned-only customer signatures, fixed Home reset, and client lookup dropdown behavior",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
