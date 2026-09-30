import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.0.4",
      version_code: 4,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/bJEnfXBgmJLWRPkP.apk",
      filename: "Caribex-Warehouse-Management-1.0.4.apk",
      release_notes: [
        "Receiving scan and manual entry controls",
        "Web-equivalent UPS, USPS, FedEx, and carrier detection rules",
        "Client Pickup account/name search with all unloaded shipments",
        "Home and Change controls now switch between approved stages",
        "Check In bulk move-to-In-Transit action",
        "Working Sync, Settings, and Home actions",
        "Client and customer refresh from the server",
        "Internal notes, issue photos, alerts, and pickup signature support",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
