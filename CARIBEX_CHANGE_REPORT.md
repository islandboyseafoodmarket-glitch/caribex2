# Caribex 2 Change Report

**Date:** September 25, 2026  
**Repository:** `caribex2`  
**Branch:** `main`  
**Current production HEAD:** `95d6687 Add dual scanners to receiving stage`

## Executive summary

Caribex 2 now includes a redesigned administration workspace, customer and shipment search tools, a standalone Caribex label workflow, carrier detection improvements, customer portal alerts, invoice management improvements, container/reporting dashboards, unknown-shipment issue handling, and dual receiving scanners.

The current working tree also contains local, **uncommitted** changes. No commit or push was made for the latest local work.

## Current uncommitted files

| File | Current change |
|---|---|
| `app/login/panelAdmin.tsx` | Left-sidebar Admin navigation, tracking search in the main Shipments tab, solid light-blue Admin background, and existing Admin workflow preservation |
| `app/login/Client360Admin.tsx` | Shared Client 360 search now also matches shipment tracking numbers for Admin and Staff |
| `app/In-Transit.tsx` | Search by tracking, customer name, account number, carrier, or package type; customer-name and account-number columns |
| `app/StageReceived.tsx` | UPS 24-digit scanner messaging and SwiftX carrier display |
| `app/lib/carrierDetection.ts` | SwiftX detection plus 24-digit numeric UPS detection and validation |
| `app/api/send-invoice/route.ts` | Official Caribex logo in invoice email and corrected company email address |
| `app/globals.css` | Solid light-blue Staff workspace background |
| `components/CaribexLabelPrint.tsx` | Removes the “new box only” wording from the printed label while preserving QR behavior |
| `mockups/` | Three visual Admin layout mockups |

## Function-level change summary

### `app/login/panelAdmin.tsx`

- `toggleNavGroup` — preserves the existing expandable navigation groups in the new sidebar.
- `generateNewBoxLabels` — generates independent Caribex labels without selecting shipments already in the database.
- `openStaffPermissions` / `saveStaffPermissions` — retains task-level Staff access controls.
- `obtenerUrlsIncidencia` — reads issue-photo URLs for the Issues workflow.
- `abrirDetallePedido` — opens shipment details and loads the latest Check In information.
- `generarQrPedido` — manually generates the existing shipment QR preview.
- `imprimirQrPreview` — prints the generated shipment QR label.
- `abrirEditarPedido` — opens shipment editing, including customer-owner reassignment.
- `handleDeletePedido` — deletes shipments according to the existing Admin rules.
- `handleUpdatePedido` — saves shipment edits, owner changes, status, timestamps, and Check In data.
- `generarQrDesdeFormulario` — manually generates a QR from the shipment edit form.
- `reimprimirEtiquetaDesdeFormulario` — prints an existing shipment label from the edit form.
- `handleAdminChangeApproval` — updates invoice approval status.
- `handleAdminChangeInvoiceStatus` — updates invoice lifecycle status.
- `handleAdminEditInvoiceAddOns` / `saveAdminInvoiceAddOn` — edits invoice charge types and amounts.
- `handleAdminSendInvoice` — sends approved invoice emails.
- `openConfirmPayInvoice` / `handleConfirmPayInvoice` — records payment method and payment notes.
- `handleRemoveAccess` / `handleDeleteUser` — manages Staff accounts.
- `handleEliminarCliente` — removes a customer and related shipment records under the existing Admin workflow.

The shared `Client360Admin` component now matches a search term against customer name, email, location, account number, and any shipment tracking number belonging to that customer. Because Admin and Staff use the same Client 360 component, the behavior is consistent in both workspaces.

The navigation now uses a fixed left sidebar but keeps all existing tabs, counters, group settings, permissions, actions, tables, filters, and modal workflows.

### `app/In-Transit.tsx`

- `handleDeleteContainer` — keeps the existing protection against deleting non-empty containers.
- `toggleContainerExpanded` — loads container relationships, shipment records, customer name, account number, carrier, and shipment details.
- New shipment filtering — filters the expanded container by tracking, customer name, account number, carrier, or package type.

### `app/StageReceived.tsx`

- Existing receiving scanner callback — now accepts 24-digit numeric UPS barcodes and maps SwiftX to the visible `SwiftX` carrier name.
- Existing scanner error handling — now uses a generic message instead of incorrectly labeling every unrecognized barcode as USPS.

### `app/lib/carrierDetection.ts`

- `isValidUpsCheckDigit` — continues validating standard `1Z` UPS numbers.
- `isValidUspsCheckDigit` — continues validating supported USPS numeric formats.
- `detectCarrier` — now recognizes:
  - Standard UPS `1Z...`
  - 24-digit numeric UPS identifiers
  - FedEx, DHL, USPS, Amazon, SheIn
  - SpeedX (`SPX...`)
  - SwiftX (`SWX...`)
  - Yanwen (`YW...`)
  - GOFO (`GFUS...`)
  - Caribex JSON QR payloads
- `validateTrackingNumber` — accepts 24-digit numeric UPS identifiers and validates SwiftX format.
- `CARRIER_LABELS` — now includes `SwiftX`.

### `app/api/send-invoice/route.ts`

- `POST` — continues authenticating Admin/Staff users, calculating invoice amounts, generating invoice HTML, and sending through Resend.
- Invoice branding now includes the official Caribex logo.
- The displayed email address was corrected to `billing@caribexlogisticsgroup.com`.

### `app/globals.css`

- `.ga-page-wrapper` — changed the Staff workspace from a gradient to a solid light-blue background.

### `components/CaribexLabelPrint.tsx`

- `createCaribexLabelCode` — unchanged QR-generation behavior.
- Printed label wording was simplified so it does not display “new box only.”

## Previously committed platform changes

Recent committed work includes:

- Admin navigation redesign and Staff/Admin Client 360 synchronization.
- Robust Client 360 date parsing and preserved shipment timestamps.
- The same date parser is also used for issue-package history; the Luis issue package confirms its recorded timestamp is displaying correctly.
- Caribex QR label generation, manual reprint, batch label generation, and scanner-compatible raw tracking payloads.
- Carrier recognition improvements for UPS, USPS, FedEx, SpeedX, Yanwen Express, GOFO Express, and now local SwiftX support.
- Customer Portal invoice history and password-reset routing improvements.
- Bilingual customer onboarding email content and production portal instructions.
- Portal login/account lifecycle alerts for Admin review.
- Duplicate customer/account prevention by email, name, and phone.
- Staff task-level permissions.
- Unknown shipment / issue workflow with notes and photos.
- Invoice charge types, amounts, tax recalculation, payment method, and payment notes.
- Admin invoice search by customer name, account, email, tracking number, and selected container.
- Container dashboard with shipment totals, location grouping, shipment details, and manifest export.
- Reports page with Customer Name, Account, Tracking Number, and Item columns.
- Receiving workflow with both the standard carrier scanner and the Caribex QR scanner.
- Storage bucket `notas-imagenes` and its Storage policies for issue-photo uploads.

## Can shipments be searched by tracking number?

**Yes.** Tracking-number search is now available in these locations:

| Location | Tracking search |
|---|---:|
| Admin → Shipments | Yes — added to the main search field |
| Admin → Invoices | Yes — search includes tracking |
| Admin → Client 360 | Yes — searches customer records through their shipment tracking numbers |
| Staff → Client 360 | Yes — uses the same shared Client 360 search |
| Admin → Containers | Yes — selected-container shipment filter includes tracking |
| Staff → Check In / Receiving | Yes — existing stage search supports tracking |
| Staff → In Transit | Yes — added to the expanded container shipment search |
| Receiving scanner | Yes — scans and normalizes the tracking number automatically |

In the Admin Shipments tab, type the complete tracking number or any distinctive part of it into:

```text
Search tracking, customer account, or name...
```

The stage filter can be used at the same time.

## Database and security status

- No regular business-table RLS policies were changed during the current UI and scanner work.
- The earlier issue-photo fix created Storage policies for the `notas-imagenes` bucket.
- No new database migration is required for the current search, navigation, carrier, logo, or background changes.
- No commit or push was made for the current uncommitted changes.

## Validation completed

- `git diff --check` passed.
- TypeScript compilation with `tsc --noEmit` passed after the Admin sidebar, solid background, SwiftX, UPS 24-digit, and In-Transit search changes.
- All existing Admin tab identifiers were confirmed present after the sidebar conversion.
