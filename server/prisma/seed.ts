import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employees = [
    { name: "Omkar Phansalkar", department: "Escalation", skills: "AOQ Error,Cancellation Escalation", availability: true, activeTickets: 1, maxCapacity: 8 },
    { name: "Pooja Tipare", department: "Inventory", skills: "Stock Reallocation", availability: true, activeTickets: 2, maxCapacity: 8 },
    { name: "Planner Queue", department: "Planner", skills: "Delivery Date,ETA,Lead Time,Certificate,Cancellation Approval", availability: true, activeTickets: 3, maxCapacity: 20 },
    { name: "Sourcing Team", department: "Sourcing", skills: "Vendor Mapping", availability: true, activeTickets: 2, maxCapacity: 20 },
    { name: "Master Data Team", department: "Master Data", skills: "Material Activation,Material Correction", availability: true, activeTickets: 1, maxCapacity: 20 },
    { name: "Customer Center", department: "Customer Center", skills: "Main Ticket Reply", availability: true, activeTickets: 4, maxCapacity: 20 }
  ];

  for (const employee of employees) {
    const existing = await prisma.employee.findFirst({ where: { name: employee.name } });

    if (existing) {
      await prisma.employee.update({ where: { id: existing.id }, data: employee });
    } else {
      await prisma.employee.create({ data: employee });
    }
  }

  const ticketCount = await prisma.ticket.count();

  if (ticketCount > 0) {
    return;
  }

  await prisma.ticket.createMany({
    data: [
      {
        title: "Delivery date showing 31.12.2040",
        department: "Planner",
        materialType: "HUB Order",
        requiredSkill: "Delivery Date",
        priority: "High",
        topic: "Delivery date confirmation",
        subject: "Delivery Date",
        customerMessage: "Customer needs confirmed delivery date.",
        hubOrderNo: "450001001",
        materialNo: "MAT-100",
        supplierEntity: "IN01",
        shippingType: "Auto",
        shippingDate: "2026-07-21",
        autoObdRelease: true,
        itemStatus: 100,
        deliveryDate: "31.12.2040",
        plannerName: "Planner Queue"
      },
      {
        title: "ETA within two days",
        department: "Customer Center",
        materialType: "HUB Order",
        requiredSkill: "ETA",
        priority: "Medium",
        topic: "ETA update",
        subject: "ETA",
        hubOrderNo: "450001002",
        materialNo: "MAT-200",
        supplierEntity: "IN01",
        shippingType: "Auto",
        shippingDate: "2026-07-20",
        autoObdRelease: true,
        itemStatus: 115,
        deliveryDate: "2026-07-20"
      },
      {
        title: "AOQ error on order",
        department: "Escalation",
        materialType: "HUB Order",
        requiredSkill: "AOQ Error",
        priority: "High",
        topic: "AOQ error",
        subject: "AOQ Error",
        hubOrderNo: "450001003",
        materialNo: "MAT-300",
        supplierEntity: "IN01",
        shippingType: "Auto",
        shippingDate: "2026-07-22",
        autoObdRelease: true,
        itemStatus: 115
      },
      {
        title: "Cancellation request status 170",
        department: "Customer Center",
        materialType: "HUB Order",
        requiredSkill: "Cancellation",
        priority: "High",
        topic: "Order cancellation",
        subject: "Order Cancellation",
        hubOrderNo: "450001004",
        materialNo: "MAT-400",
        supplierEntity: "IN01",
        shippingType: "Auto",
        shippingDate: "2026-07-19",
        autoObdRelease: true,
        orderStatus: 170
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
