function normalize(value) {
    return value?.trim().toLowerCase() ?? "";
}
function hasSkill(employee, skill) {
    return employee.skills
        .split(",")
        .map((item) => normalize(item))
        .includes(normalize(skill));
}
function findEmployee(employees, options) {
    return (employees.find((employee) => options.name && normalize(employee.name) === normalize(options.name)) ??
        employees.find((employee) => options.department && normalize(employee.department) === normalize(options.department)) ??
        employees.find((employee) => options.skill && hasSkill(employee, options.skill)) ??
        null);
}
function parseTicketDate(value) {
    if (!value)
        return null;
    const ddmmyyyy = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (ddmmyyyy) {
        return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function daysUntil(value) {
    const date = parseTicketDate(value);
    if (!date)
        return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}
function baseValidationSteps(ticket) {
    return [
        {
            label: "Ticket opened and identified",
            status: ticket.subject ? "passed" : "failed",
            detail: ticket.subject ? `Subject identified as ${ticket.subject}.` : "Subject is missing from Additional Fields."
        },
        {
            label: "HUB reference copied",
            status: ticket.hubOrderNo && ticket.materialNo ? "passed" : "warning",
            detail: ticket.hubOrderNo && ticket.materialNo
                ? `HUB Order ${ticket.hubOrderNo} and Spare Part Number ${ticket.materialNo} are available.`
                : "HUB Order Number or Spare Part Number is missing."
        },
        {
            label: "HUB Order Cockpit checked",
            status: ticket.supplierEntity ? "passed" : "warning",
            detail: ticket.supplierEntity
                ? `Division ${ticket.supplierEntity} is available for cockpit lookup.`
                : "Division is missing; user must enter it before HUB verification."
        },
        {
            label: "Header tab verified",
            status: !ticket.hasUserStatusBlock && Boolean(ticket.shippingType) && ticket.autoObdRelease === true ? "passed" : "warning",
            detail: !ticket.hasUserStatusBlock && Boolean(ticket.shippingType) && ticket.autoObdRelease === true
                ? "No User Status block found, Shipping Type is available, and Auto OBD Release is Y."
                : "Check User Status blocks, Shipping Type, and Auto OBD Release before processing."
        },
        {
            label: "Shipping date checked",
            status: ticket.shippingDate ? "passed" : "warning",
            detail: ticket.shippingDate ? `Shipping Date is ${ticket.shippingDate}.` : "Shipping Date is not set."
        }
    ];
}
function makeDecision(ticket, employees, options) {
    const employee = options.assignee ? findEmployee(employees, options.assignee) : null;
    return {
        employee,
        action: options.action,
        routedTeam: options.routedTeam,
        status: options.status,
        reason: options.reason,
        score: options.score,
        steps: [
            ...baseValidationSteps(ticket),
            ...options.steps,
            {
                label: "Final resolution action",
                status: "passed",
                detail: `${options.action} ${employee ? `Owner: ${employee.name}.` : `Team: ${options.routedTeam}.`}`
            }
        ]
    };
}
export function resolveTicket(ticket, employees) {
    const subject = normalize(ticket.subject);
    if (subject.includes("aoq")) {
        return makeDecision(ticket, employees, {
            action: "Reassign ticket to Omkar Phansalkar",
            routedTeam: "Escalation",
            status: "Routed",
            score: 100,
            assignee: { name: "Omkar Phansalkar" },
            reason: "AOQ error tickets must be reassigned to Omkar Phansalkar for resolution.",
            steps: [{ label: "AOQ rule applied", status: "passed", detail: "PPT special case: AOQ Error goes to Omkar Phansalkar." }]
        });
    }
    if (subject.includes("stock")) {
        return makeDecision(ticket, employees, {
            action: "Contact Pooja Tipare for stock reallocation",
            routedTeam: "Inventory",
            status: "Routed",
            score: 100,
            assignee: { name: "Pooja Tipare" },
            reason: "Stock reallocation requests must be handled with Pooja Tipare.",
            steps: [{ label: "Stock reallocation rule applied", status: "passed", detail: "PPT special case: contact Pooja Tipare." }]
        });
    }
    if (subject.includes("material not live")) {
        return makeDecision(ticket, employees, {
            action: "Raise child ticket to Master Data Team",
            routedTeam: "Master Data",
            status: "Child Ticket Required",
            score: 95,
            assignee: { department: "Master Data" },
            reason: "Spare part is not live or visible, so a child ticket must be raised to Master Data Team.",
            steps: [{ label: "Spare part live check", status: "failed", detail: "Spare part is not active in the system." }]
        });
    }
    if (subject.includes("lead time") || subject.includes("certificate")) {
        return makeDecision(ticket, employees, {
            action: "Raise dedicated ticket to Planner",
            routedTeam: "Planner",
            status: "Child Ticket Required",
            score: 95,
            assignee: { department: "Planner" },
            reason: "Lead Time and Certificate requests must be sent to the Planner with all order details.",
            steps: [{ label: "Planner-owned request", status: "passed", detail: "PPT rule: Planner provides lead time and certificates." }]
        });
    }
    if (subject.includes("cancellation")) {
        const orderStatus = ticket.orderStatus ?? 0;
        if (orderStatus > 165) {
            if (ticket.customerCenterInsisting) {
                return makeDecision(ticket, employees, {
                    action: "Escalate cancellation request to Omkar Phansalkar",
                    routedTeam: "Escalation",
                    status: "Escalated",
                    score: 100,
                    assignee: { name: "Omkar Phansalkar" },
                    reason: `Order status is ${orderStatus}, which is above 165. OBD is released, and Customer Center is insisting, so discuss with Omkar Phansalkar.`,
                    steps: [{ label: "Cancellation status checked", status: "warning", detail: "Status is above 165 and Customer Center is insisting." }]
                });
            }
            return makeDecision(ticket, employees, {
                action: "Reply on main ticket that cancellation is not possible",
                routedTeam: "Customer Center",
                status: "Reply Required",
                score: 100,
                assignee: { department: "Customer Center" },
                reason: `Order status is ${orderStatus}, which is above 165, so OBD has already been released and cancellation is not possible.`,
                steps: [{ label: "Cancellation status checked", status: "failed", detail: "Status above 165 means OBD Released." }]
            });
        }
        if (ticket.plannerApprovedCancellation === true) {
            return makeDecision(ticket, employees, {
                action: "Cancel the order in HUB and update main ticket",
                routedTeam: "Planner",
                status: "Ready To Cancel",
                score: 100,
                assignee: { department: "Planner" },
                reason: "Order status is 165 or below and Planner approved cancellation, so cancel the order in HUB.",
                steps: [{ label: "Planner approval checked", status: "passed", detail: "Planner approved cancellation." }]
            });
        }
        if (ticket.plannerApprovedCancellation === false) {
            return makeDecision(ticket, employees, {
                action: "Reply on main ticket that cancellation cannot be processed",
                routedTeam: "Customer Center",
                status: "Reply Required",
                score: 100,
                assignee: { department: "Customer Center" },
                reason: "Planner declined cancellation, so the main ticket must be updated that cancellation cannot be processed.",
                steps: [{ label: "Planner approval checked", status: "failed", detail: "Planner declined cancellation." }]
            });
        }
        return makeDecision(ticket, employees, {
            action: "Raise child ticket to Planner for cancellation approval",
            routedTeam: "Planner",
            status: "Child Ticket Required",
            score: 95,
            assignee: { department: "Planner" },
            reason: `Order status is ${orderStatus}, which is 165 or below, so Planner approval is required before cancellation.`,
            steps: [{ label: "Cancellation status checked", status: "passed", detail: "Status is 165 or below." }]
        });
    }
    if ((ticket.purchaseGroup === "100" || ticket.purchaseGroup === "500") && !ticket.isKit) {
        return makeDecision(ticket, employees, {
            action: "Raise child ticket to Sourcing Team for Vendor Mapping",
            routedTeam: "Sourcing",
            status: "Child Ticket Required",
            score: 95,
            assignee: { department: "Sourcing" },
            reason: `Purchase Group ${ticket.purchaseGroup} is non-kit, so a child ticket must be raised to Sourcing Team for Vendor Mapping.`,
            steps: [{ label: "Purchase group checked", status: "passed", detail: "Purchase Group is 100/500 and item is not a kit." }]
        });
    }
    if (subject.includes("eta")) {
        const etaDays = daysUntil(ticket.deliveryDate);
        if (etaDays !== null && etaDays <= 2) {
            return makeDecision(ticket, employees, {
                action: "Reply on main ticket with ETA date",
                routedTeam: "Customer Center",
                status: "Reply Required",
                score: 100,
                assignee: { department: "Customer Center" },
                reason: `ETA date ${ticket.deliveryDate} is within 2 days, so reply on the main ticket with the ETA.`,
                steps: [{ label: "ETA window checked", status: "passed", detail: "ETA is within 2 days." }]
            });
        }
        return makeDecision(ticket, employees, {
            action: "Raise child ticket to Planner for earliest possible new date",
            routedTeam: "Planner",
            status: "Child Ticket Required",
            score: 95,
            assignee: { department: "Planner" },
            reason: "ETA is more than 2 days away or missing, so Planner must confirm the earliest possible new date.",
            steps: [{ label: "ETA window checked", status: "warning", detail: "ETA is not within 2 days." }]
        });
    }
    if (ticket.deliveryDate === "31.12.2040") {
        return makeDecision(ticket, employees, {
            action: "Raise child ticket to Planner for confirmed delivery date",
            routedTeam: "Planner",
            status: "Child Ticket Required",
            score: 95,
            assignee: { department: "Planner" },
            reason: "Delivery date is 31.12.2040, so Planner must confirm the real delivery date.",
            steps: [{ label: "Delivery date checked", status: "warning", detail: "31.12.2040 is a placeholder date." }]
        });
    }
    if ((ticket.itemStatus ?? 999) < 115) {
        return makeDecision(ticket, employees, {
            action: "Open Confirmations and verify delivery date",
            routedTeam: "Customer Center",
            status: "Verification Required",
            score: 85,
            assignee: { department: "Customer Center" },
            reason: "FAM is below 115, so confirmations must be checked before replying or routing.",
            steps: [{ label: "FAM checked", status: "warning", detail: `FAM is ${ticket.itemStatus}.` }]
        });
    }
    if (ticket.deliveryDate) {
        return makeDecision(ticket, employees, {
            action: "Reply on main ticket with confirmed delivery date",
            routedTeam: "Customer Center",
            status: "Reply Required",
            score: 100,
            assignee: { department: "Customer Center" },
            reason: `A valid delivery date is available: ${ticket.deliveryDate}. Reply directly on the main ticket.`,
            steps: [{ label: "Delivery date checked", status: "passed", detail: "Valid delivery date is available." }]
        });
    }
    return makeDecision(ticket, employees, {
        action: "Review ticket manually after HUB checks",
        routedTeam: "Customer Center",
        status: "Manual Review",
        score: 60,
        assignee: { department: "Customer Center" },
        reason: "No specific PPT rule matched. Complete HUB checks and review the ticket manually.",
        steps: [{ label: "Scenario rule matched", status: "warning", detail: "No exact automated rule matched this subject." }]
    });
}
