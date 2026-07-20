# Ticket Resolution Rules

Source: `Ticket_Resolution_Process.pptx`

This project should follow the Halo Service Desk ticket-resolution process described in the PPT.

## What A Ticket Means

A ticket is a request raised by another team or software. It contains a customer/order problem that must be checked, routed, or resolved.

In this project, when a ticket comes in, the automated system should:

1. Read the ticket details.
2. Identify the subject/scenario.
3. Check required order/material fields.
4. Decide the correct next action.
5. Assign or route the ticket to the right person/team.
6. Return the result to the source software.

## Standard Ticket Flow

1. Open the ticket using the Ticket ID.
2. Read the customer message.
3. Check the Subject in Additional Fields.
4. Copy the HUB Order Number and Material Number.
5. Open HUB Order Cockpit.
6. Enter Order Number and Supplier Entity.
7. Display the HUB Order.
8. Check the Header tab.
9. Verify User Status blocks.
10. Verify Shipping Type.
11. Verify Auto OBD Release is marked `Y`.
12. Check item-level material status.
13. Decide the next action based on scenario rules.
14. Reply on the main ticket or raise a child ticket.

## Delivery Date Rules

When checking delivery date tickets:

- Select materials with status below `115`, including status `100`.
- Click Confirmations to view the delivery date.
- If the date is `31.12.2040`, raise a child ticket to the Planner for a confirmed delivery date.
- If a valid delivery date is available, reply on the main ticket with that date.
- If Purchase Group is `100` or `500` and the item is not a kit, raise a child ticket to the Sourcing Team for Vendor Mapping.
- Use MD04 in SAP to identify the assigned Planner.

## ETA Rules

- If ETA is within 2 days, reply on the main ticket with the ETA date.
- If ETA is more than 2 days away, raise a child ticket to the Planner to confirm the earliest possible new date.

## Special Case Rules

- AOQ error: reassign the ticket to Omkar Phansalkar.
- Stock reallocation: contact Pooja Tipare.
- Material not live in system: raise a child ticket to the Master Data Team.
- Lead time request: raise a ticket to the Planner.
- Certificate request: raise a ticket to the Planner.

## Order Cancellation Rules

1. Check the order status in HUB.
2. If status is above `165`, OBD has already been released and cancellation is not possible.
3. If Customer Center still insists, discuss/escalate to Omkar Phansalkar.
4. If status is `165` or below, raise a child ticket to the Planner for cancellation approval.
5. If Planner approves, cancel the order in HUB and update the main ticket.
6. If Planner declines, reply on the main ticket that cancellation cannot be processed.

## Key Reminder

Before processing any ticket, always verify:

- Shipping Date is set.
- Auto OBD Release is marked `Y`.

These checks help avoid Out Bound Delivery release delays.
