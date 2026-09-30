import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.0.5",
      version_code: 5,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/rYVLWBYCQadxrfmc.apk",
      filename: "Caribex-Warehouse-Management-1.0.5.apk",
      release_notes: [
        "Receiving scan and manual entry controls",
        "Web-equivalent UPS, USPS, FedEx, and carrier detection rules",
        "Client Pickup customer dropdown with exact shipment lookup",
        "Receiving camera and scanner-gun input open the new receipt form",
        "Check In bulk move-to-In-Transit action",
        "Working Sync, Settings, and Home actions",
        "Client and customer refresh from the server",
        "Internal notes, issue photos, alerts, and pickup signature support",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
