import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.0.1",
      version_code: 2,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/ZGAIOzJGSzsZcNEr.apk",
      filename: "Caribex-Warehouse-Management-1.0.1.apk",
      release_notes: [
        "Receiving workflow aligned with the Caribex web page",
        "Working Sync, Settings, and Home actions",
        "Client and customer refresh from the server",
        "Internal notes, issue photos, alerts, and pickup signature support",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
