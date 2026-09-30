import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.2.2",
      version_code: 122,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/bdAKsImYtMQltems.apk",
      filename: "Caribex-Warehouse-Management-1.2.2.apk",
      release_notes: [
        "Web-equivalent Receiving, Check In, consolidation, and customer assignment",
        "Client Pickup now shows every shipment tracking number with the authoritative invoice status",
        "Client Pickup search now matches the compact reference-style search control",
        "Internal staff notes and problem photos now verify and display after saving",
        "Automatic carrier detection for Amazon TBA, Caribex, UPS, FedEx, USPS, DHL, and other supported labels",
        "Responsive Receiving, Check In, Container Unloading, and Client Pickup screens on smaller devices",
        "Client Pickup clearly lists shipments available to scan out, including carrier, package type, invoice status, and container",
        "Five-stage workflow indicator uses distinct colors and highlights the active scanner stage",
        "Home, Sync, Settings, rescan, and Client Pickup actions",
        "Already Picked Up warning for shipments already marked Entregado / Recogido",
        "Scanned-only customer signatures, fixed Home reset, and client lookup dropdown behavior",
        "Unknown Owner can be saved without a customer but requires an internal note or photo",
        "Receiving customer lookup refreshes like Client Pickup, and Contents is optional",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
