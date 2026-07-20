# Automated Ticket Assignment System

Prototype for receiving incoming tickets, running a rule-based assignment engine, and showing the selected employee with the assignment reason.

## Stack

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: SQLite
- ORM: Prisma

## Run Locally

```bash
npm install
npm run seed --workspace server
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

## OTP Email Setup

Registration OTPs are sent through SMTP. Add real SMTP values in `server/.env`.

For Gmail:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
MAIL_FROM="AutoAssign <your-email@gmail.com>"
```

Use a Gmail App Password, not your normal Gmail password. Gmail requires 2-Step Verification before App Passwords are available.

## API

- `GET /tickets`
- `POST /tickets`
- `POST /tickets/:id/assign`
- `GET /employees`
- `GET /assignments`
- `POST /integrations/tickets`
- `POST /integrations/orders`

## External Ticket Integration

Use `POST /integrations/tickets` when another software sends a ticket and expects AutoAssign to immediately return the assigned employee.
The payload should include the Halo/HUB details needed by the PPT resolution rules.

Request:

```json
{
  "externalTicketId": "CRM-5012",
  "sourceSystem": "CRM",
  "title": "CRM-5012 - Delivery date request",
  "department": "Customer Center",
  "materialType": "HUB Order",
  "requiredSkill": "Delivery Date",
  "priority": "High",
  "subject": "Delivery Date",
  "customerMessage": "Customer needs confirmed delivery date.",
  "hubOrderNo": "450001001",
  "materialNo": "MAT-100",
  "supplierEntity": "IN01",
  "shippingType": "Auto",
  "shippingDate": "2026-07-21",
  "autoObdRelease": true,
  "hasUserStatusBlock": false,
  "itemStatus": 100,
  "deliveryDate": "31.12.2040",
  "purchaseGroup": "100",
  "isKit": false,
  "orderStatus": 165,
  "customerCenterInsisting": false
}
```

Response:

```json
{
  "accepted": true,
  "externalTicketId": "CRM-5012",
  "sourceSystem": "CRM",
  "ticketId": 15,
  "status": "Child Ticket Required",
  "recommendedAction": "Raise child ticket to Planner for confirmed delivery date",
  "routedTeam": "Planner",
  "assignedEmployee": {
    "id": 13,
    "name": "Planner Queue",
    "department": "Planner",
    "activeTickets": 3,
    "maxCapacity": 20
  },
  "score": 95,
  "reason": "Delivery date is 31.12.2040, so Planner must confirm the real delivery date."
}
```

Supported `subject` values:

- `Delivery Date`
- `ETA`
- `AOQ Error`
- `Stock Reallocation`
- `Material Not Live`
- `Lead Time`
- `Certificate`
- `Order Cancellation`

The system applies the PPT rules:

- `31.12.2040` delivery date -> child ticket to Planner.
- Valid delivery date -> reply on main ticket.
- ETA within 2 days -> reply on main ticket.
- ETA more than 2 days -> child ticket to Planner.
- AOQ Error -> reassign to Omkar Phansalkar.
- Stock Reallocation -> contact Pooja Tipare.
- Material Not Live -> child ticket to Master Data Team.
- Lead Time or Certificate -> ticket to Planner.
- Purchase Group `100` or `500` and not kit -> child ticket to Sourcing Team.
- Cancellation status above `165` -> cancellation not possible.
- Cancellation status above `165` and Customer Center insisting -> escalate to Omkar Phansalkar.
- Cancellation status `165` or below -> child ticket to Planner for approval.

## Order Integration

Use `POST /integrations/orders` when another software creates an order and wants AutoAssign to create and assign a ticket in one request.

Request:

```json
{
  "orderId": "1024",
  "title": "Order #1024 - Laptop Request",
  "department": "IT",
  "materialType": "Laptop",
  "requiredSkill": "Hardware",
  "priority": "High"
}
```

Response:

```json
{
  "orderId": "1024",
  "ticketId": 15,
  "status": "Assigned",
  "assignedEmployee": {
    "id": 13,
    "name": "Mohit",
    "department": "IT"
  },
  "score": 100,
  "reason": "Ticket assigned to Mohit because..."
}
```

No login, authentication, roles, or user dashboards are included.
