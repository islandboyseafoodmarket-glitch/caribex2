import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.1.3",
      version_code: 113,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/qCBsVaXbAmKJkNCv.apk",
      filename: "Caribex-Warehouse-Management-1.1.3.apk",
      release_notes: [
        "Web-equivalent Receiving, Check In, consolidation, and customer assignment",
        "Internal staff notes and problem photos now verify and display after saving",
        "Carrier detection uses the complete scanner payload before normalizing tracking",
        "Home, Sync, Settings, rescan, and Client Pickup actions",
        "Already Picked Up warning for shipments already marked Entregado / Recogido",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
