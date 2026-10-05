import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      app: "Caribex Warehouse Management",
      version: "1.2.9",
      version_code: 129,
      apk_url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663449196187/UhJmWLdzbOItdWuH.apk",
      filename: "Caribex-Warehouse-Management-1.2.9.apk",
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
        "Receiving modal now resizes above the Android keyboard so all fields remain reachable",
        "Sync reloads the live customer list for every role and reports the number loaded",
        "Same-version and older-version releases never show a download prompt",
        "Receiving modal stays fully visible above the Android keyboard",
        "The login screen uses lightweight text branding without bundling the large page logo image",
      ],
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
