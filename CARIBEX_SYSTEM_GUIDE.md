# Caribex 2 System Guide

## 1. What Caribex 2 does

Caribex 2 is a logistics management platform for receiving packages, assigning them to customers, moving them through warehouse stages, tracking problems, managing containers, billing customers, sending invoices, and giving customers access to their own shipment history through the Customer Portal.

The system has three main user experiences:

| User | Main purpose |
|---|---|
| **Admin** | Full operational, customer, billing, reporting, container, staff, and permission management |
| **Staff** | Daily warehouse work such as scanning, receiving, checking in, moving shipments, unloading, issue reporting, and label printing |
| **Customer** | View shipment history, shipment status, invoices, and portal account information |

## 2. The main shipment workflow

A shipment normally follows this process:

1. **Received** — The package is first scanned or entered into the Caribex system.
2. **Registered / Check In** — The shipment is assigned to a customer, package type, dimensions, weight, notes, and optional charges.
3. **In Transit** — The package is placed into a container or moved toward the destination location.
4. **Unloaded** — The container or shipment arrives and is unloaded at the destination warehouse.
5. **Ready for Pickup** — Unloaded packages become available for the customer to collect.
6. **Picked Up / Delivered** — The shipment is marked as collected or delivered.

The exact display label can vary between the English and Spanish workflow, but the system normalizes the stages for filtering and reporting.

## 3. Admin panel

The Admin panel is the full control center. The current design uses a **left sidebar** with the existing tabs and counters preserved.

### Operations

#### Shipments

The Shipments tab shows package records from the shipment database. Admin can:

- Search by tracking number, partial tracking number, customer account number, or customer name.
- Filter shipments by stage.
- Open shipment details.
- Edit shipment information.
- Change the shipment owner/customer.
- Update package type, dimensions, weight, notes, dates, and status information.
- View issue indicators.
- Generate a QR preview manually.
- Reprint an existing shipment QR label.
- Delete a shipment when permitted by the existing Admin workflow.

The search field is:

```text
Search tracking, customer account, or name...
```

The stage filter can be used at the same time as the search field.

#### Client 360

Client 360 is the complete customer profile and operational history view. Admin can search by:

- Tracking number
- Customer name
- Email address
- Location or port
- Customer account number

When a tracking number is entered, Client 360 finds the customer who owns that shipment. Admin can then open the customer profile and see:

- Customer name and account number
- Email, phone, and location
- Total packages ever recorded
- Active packages
- Invoice count
- Total invoiced amount
- Paid amount
- Outstanding balance
- Shipment distribution by stage
- Package history
- Recorded timestamp
- Tracking number
- Status
- Carrier
- Package type
- Contents and notes
- Problem information, when applicable

Clicking a shipment in the package history opens its details. Client 360 is shared between Admin and Staff so the two workspaces use the same customer-history format.

#### Issues

The Issues tab is for packages with a problem or unknown ownership. It shows items such as:

- Tracking number
- Customer or unknown owner
- Problem description
- Issue notes
- Issue photos
- Available actions

Admin can open the shipment editor from the issue row, change the owner, add or update information, and review attached issue photos.

Unknown shipments can be flagged during receiving. They remain visible in Issues until the owner is identified or the issue is resolved.

#### Caribex Labels

This is a separate label-generation tab. It is not part of the normal shipment detail workflow.

It is used to create independent Caribex labels for new boxes or packages that do not yet exist as shipment records. Admin enters a quantity and generates multiple labels at one time.

The printed label contains a minimal Caribex identifier and QR code. The QR payload is compatible with the existing Caribex QR scanner.

For an existing shipment with a damaged label, use the shipment detail action **Reprint QR (damaged label)**. That reprint uses the existing shipment tracking number instead of creating a new independent label.

#### Reports

Reports show shipment exception or operational records using fields such as:

- Customer Name
- Account
- Tracking Number
- Item

The Item field identifies whether the shipment is a Box or Package and can include recorded dimensions when available.

### Customers

#### Customer #

The Customer # tab manages customer records. Admin can:

- View customer names and account numbers.
- View email, phone, location, and account type.
- Create customers.
- Edit customers.
- Open Client 360.
- Prevent duplicate accounts using existing email, name, and phone checks.
- Remove a customer through the existing confirmation workflow.

#### Leads

Leads are customer inquiries submitted through the website. Admin can:

- See new lead submissions.
- Review contact information and message details.
- Update lead approval/status fields.
- Use the lead record as the starting point for customer onboarding.

#### Portal Alerts

Portal Alerts records customer account and portal activity for Admin review. Events include:

- Successful customer login
- Failed customer login
- Password-reset problems
- Customer account creation
- Portal access provisioning
- Other customer account lifecycle events

The alert includes the customer name and account number when those values are available, along with email, event type, result, reason, and timestamp.

### Billing & Logistics

#### Invoices

The Admin invoice workflow supports:

- Searching by customer name
- Searching by account number
- Searching by email
- Searching by tracking number
- Filtering invoices by selected container
- Opening invoice details
- Editing additional charges
- Selecting a charge type
- Entering a charge amount
- Recalculating the 15% tax
- Recording payment method
- Recording payment details or internal notes
- Sending invoices
- Changing invoice approval and payment status

Supported payment methods include:

- Zelle
- PayPal
- Cash
- Credit granted

The invoice email includes the Caribex logo and the company billing email address.

#### Ferry Manifests

Ferry manifests are used to prepare and submit shipment lists for ferry transport. The workflow supports:

- Entering a booking number manually
- Saving each submitted manifest
- Viewing manifest entries
- Recording receiver information
- Exporting manifest information
- Sending booking confirmation communication when the configured submission email workflow is active

#### Containers

The Containers dashboard organizes packages by container. It shows:

- Every container
- Container creation information
- Total shipment count
- Shipment grouping by location
- Customer name
- Customer account number
- Tracking number
- Item or package type
- Shipment cost
- Additional charges
- Consolidated package references
- Package count

The dashboard supports selecting a container, viewing its shipment information, grouping by location, filtering shipments, and exporting a PDF-style manifest through the browser print workflow.

### Administration

#### Staff

Admin can manage Staff users and task-level permissions. Staff access can be limited by capability, including areas such as:

- Shipment workflow
- Client 360
- Invoices
- Labels
- Other operational areas configured in the permission settings

The Staff panel only exposes the tabs and functions granted to that staff member. Admin retains the ability to update permissions and remove staff access.

## 4. Staff warehouse panel

The Staff panel is intended for daily warehouse operations. Staff uses stage tabs and operational controls instead of the full Admin management interface.

### Shipment workflow tab

This is the normal warehouse workspace. Staff can work through the stage buttons, including receiving, Check In, In Transit, unloading, pickup, and invoicing when permission is granted.

Staff can:

- Scan carrier labels.
- Scan Caribex QR labels.
- Search shipments by tracking number.
- Select a customer during Check In.
- Record dimensions and weight.
- Mark a package as having an issue.
- Add problem notes.
- Capture or upload issue photos.
- Select additional charges.
- Consolidate packages into a main box when using the consolidation workflow.
- Move shipments between stages when authorized.
- View customer information and shipment details.

### Staff Client 360

Staff uses the same shared Client 360 component as Admin. Staff can search by tracking, customer name, email, location, or account number, subject to the Staff permissions granted by Admin.

### Staff Caribex labels

Staff has a separate Caribex Labels tab for independent new-package labels. New labels are not generated from an existing shipment detail record.

Existing shipment labels are reprinted from the shipment's existing label/reprint action when that function is available to the staff member.

## 5. Scanner system

### Standard carrier scanner

The carrier scanner reads supported barcodes and attempts to identify the carrier automatically. Current recognition includes:

- UPS standard `1Z` numbers
- 24-digit numeric UPS identifiers
- FedEx formats supported by the detector
- USPS supported numeric formats
- DHL
- Amazon Logistics
- SheIn
- SpeedX
- SwiftX
- Yanwen Express
- GOFO Express

UPS Ground is treated as a UPS service level and is stored/displayed under the UPS carrier label.

### Caribex QR scanner

The Caribex scanner reads the QR code generated by the Caribex label system. The label encodes the raw tracking or Caribex identifier required by the receiving workflow.

Receiving provides both:

1. The standard carrier/barcode scanner.
2. The dedicated Caribex QR scanner.

The scanner normalizes the tracking number before placing it into the receiving form.

## 6. Customer Portal

The Customer Portal allows customers to sign in and view their own records. It includes:

- Total shipments
- In-transit shipments
- Unloaded shipments shown as Ready for Pickup
- Shipment history
- Shipment status
- Invoice history
- Password change capability
- Password reset capability

When a customer account is provisioned, the system can create portal access and record the event for Admin review. Successful and failed login attempts can appear in Portal Alerts.

## 7. Customer onboarding and email communication

The onboarding email can include:

- Customer name
- Customer account number
- Instructions for placing the Caribex warehouse address
- Portal access instructions
- The customer portal link
- A reminder that the customer name and order name must match
- A warning that incorrect names or addresses may affect responsibility for the shipment
- Personal or business account instructions

Invoice emails use the official Caribex logo and billing identity. Other operational email flows include customer portal reset links and configured booking or manifest notifications.

## 8. Shipment timestamps and date handling

Client 360 and issue-package history use a robust date parser. It supports common database timestamps, date-only values, and day-first date strings.

When a time-bearing value exists, the UI displays the recorded time together with the date. This is why the Luis issue package can now show its correct recorded timestamp instead of displaying `Invalid Date`.

The preferred timestamp is the actual shipment-recorded time when available, rather than a less precise fallback date.

## 9. Storage and issue photos

Issue photos are stored in the Supabase Storage bucket named:

```text
notas-imagenes
```

The receiving issue workflow uploads the photo, saves the resulting URL with the issue information, and allows Admin/Staff to review it from Issues or shipment details according to permissions.

## 10. Security and permissions

The application uses Supabase authentication and role/workflow checks. Important security features include:

- Admin and Staff authentication
- Customer Portal authentication
- Staff task-level permissions
- Admin-only Staff management
- Password reset links
- Duplicate account prevention
- Confirmation prompts for destructive actions
- Storage policies for issue photos
- Database access controlled by the existing Supabase policies

The current UI, scanner, search, background, and invoice branding edits do not require a new business-table migration. The current local changes have not been committed or pushed.

## 11. Search capability summary

| Screen | Search by tracking number | Other search fields |
|---|---:|---|
| Admin Shipments | Yes | Customer account, customer name |
| Admin Client 360 | Yes | Customer name, email, location, account |
| Staff In Transit | Yes | Customer name, account, carrier, package type |
| Staff Client 360 | Yes | Customer name, email, location, account |
| Admin Invoices | Yes | Customer name, account, email, container |
| Admin Containers | Yes | Customer, email, location, stage, carrier |
| Receiving | Scanner input | Carrier barcode or Caribex QR |

## 12. How to find a shipment by tracking number

### Admin Shipments

1. Open **Admin**.
2. Select **Shipments** in the left sidebar.
3. Enter the complete or partial tracking number in the search field.
4. Choose a stage filter if needed.
5. Click the shipment row to open details.

### Admin or Staff Client 360

1. Open **Client 360**.
2. Enter the tracking number in the search field.
3. The customer connected to that shipment appears.
4. Select the customer.
5. Open the shipment from Package History.

### Staff In Transit

1. Open **In Transit**.
2. Expand the container.
3. Search the tracking number in the container shipment search.
4. Open the matching shipment details.

## 13. Current change status

The latest source edits are currently local and uncommitted. TypeScript validation and diff checks have been run during the work. No new RLS change was made for the current Admin/Staff sidebar, solid background, tracking search, Client 360 search, or carrier-detection edits.
