// Sunridge Homes preferred builder proposal.
#import "report-theme.typ": report-accent, report-theme

#show: report-theme.with(
  title: "Sunridge Homes 20-Foot Container Program",
  author: "Caribex Logistics Group",
  rhythm: "report",
  running-header: true,
)

// ---------- Title page ----------
#page(margin: (top: 28%, x: 2.2cm), numbering: none, header: none)[
  #set par(first-line-indent: 0em)
  #align(center)[
    #text(size: 12pt, weight: "bold", fill: report-accent)[CARIBEX LOGISTICS GROUP]
    #v(1.3em)
    #text(size: 28pt, weight: "bold", fill: report-accent)[Sunridge Homes]
    #v(0.35em)
    #text(size: 18pt)[20-Foot Container Program]
    #v(0.8em)
    #text(size: 13pt, fill: luma(80))[Preferred Builder Partnership Proposal]
    #v(2.2em)
    #line(length: 42%, stroke: 1pt + report-accent)
    #v(2em)
    #text(size: 11pt)[Prepared by Caribex Logistics Group]
    #v(0.35em)
    #text(size: 10pt, fill: luma(90))[October 21, 2026]
  ]
]

// ---------- Main body ----------
#counter(page).update(1)

= A Dedicated Shipping Solution for Sunridge Homes

Dear Sunridge Homes Team,

Caribex Logistics Group is pleased to present Sunridge Homes with a preferred builder program designed to make the movement of construction materials, fixtures, appliances, and project equipment more predictable and easier to manage.

As our first builder and development partner, Sunridge Homes would receive a special rate of *USD 16.00 per cubic foot* for this proposed 20-foot container program.

#box(
  width: 100%,
  inset: 14pt,
  radius: 8pt,
  fill: rgb("eef7f2"),
  stroke: 1pt + rgb("b7dfc8"),
)[
  #text(weight: "bold", fill: rgb("166534"))[Preferred Sunridge Homes Rate]
  #v(0.35em)
  #grid(columns: (1fr, 1fr), gutter: 10pt,
    [*Rate:* USD 16.00 / ft³], [*Estimated capacity:* 1,150 ft³],
    [*Gross container value:* USD 18,400.00], [*Sunridge Homes discount:* −USD 1,000.00],
    [*Preferred total:* USD 17,400.00], [*Final billing:* based on measured space used]
  )
]

= Program Highlights

- Approximately 1,150 cubic feet of available 20-foot container space.
- Project items may be sent to the Caribex warehouse continuously as Sunridge Homes purchases or receives them.
- Each item is measured, recorded, and deducted from the remaining allocated space.
- The allocated space does not expire while the program remains active.
- Multiple suppliers and project purchases can be consolidated through one organized logistics program.
- Caribex coordinates receiving, warehouse handling, loading, documentation, and shipment preparation.
- Sunridge Homes may request an additional container or discuss a half-container option after the allocated space is used.

The estimated program value is calculated as:

#align(center)[#text(size: 14pt, weight: "bold")[1,150 ft³ × USD 16.00 = USD 18,400.00]]

Caribex is pleased to offer Sunridge Homes a private preferred-customer discount of *USD 1,000.00* for this proposed 20-foot container program. After the discount, the preferred total is *USD 17,400.00*.

The 1,150 ft³ figure is an estimate for planning purposes. Final charges are based on the actual measured space used and the final approved service terms.

= Why This Benefits Sunridge Homes

This program allows Sunridge Homes to consolidate purchases from different suppliers instead of arranging separate shipments for every item. It can help the team plan logistics costs in advance, reduce fragmented handling, keep project materials organized, and send items as they become available.

The result is one coordinated shipping channel for multiple building or development projects, with visibility into warehouse receipts, measured space, remaining capacity, and container preparation.

= Warehouse Delivery Requirement

All parcels for a Quarter Container or Half Container request must be sent together to the Caribex warehouse as one shipment. This requirement allows Caribex to receive, measure, organize, and prepare the allocated container space as a single coordinated load.

For the proposed 20-foot container program, Sunridge Homes may send project items to the Caribex warehouse continuously during the active loading period. Caribex will record each receipt and update the remaining space allocation.

= Taxes, Duties, and Special-Item Charges

The final service agreement will identify the standard brokerage services included and the cost of those services. No item category is automatically exempt from a charge imposed by Customs, a port authority, a government agency, or another authority. If any such authority imposes additional taxes, duties, inspections, permits, storage charges, or special handling charges on high-value, oversized, restricted, or regulated items, those additional charges will be the responsibility of Sunridge Homes.

Examples may include building materials, commercial furniture, and commercial appliances.

Caribex will notify Sunridge Homes when an additional charge is identified. A shipment may be held until the required amount is paid and any required documentation is provided.

= Next Steps

1. Sunridge Homes reviews the proposed preferred rate and program structure.
2. Caribex and Sunridge Homes confirm the materials list, warehouse receiving instructions, and approved service terms.
3. Caribex confirms the first 20-foot container allocation at the special rate of USD 16.00 per cubic foot.
4. Sunridge Homes begins sending approved project items to the Caribex warehouse.
5. Caribex measures, records, and reports the remaining available container space as items are received.

We would be pleased to make Sunridge Homes our first preferred builder customer and build a long-term logistics relationship that supports your projects from procurement through delivery.

#v(1em)

Truly yours,

*Cathy Johnson*  \\
Caribex Logistics Group  \\
+504 89467476  \\
#text("info@caribexlogisticsgroup.com")
