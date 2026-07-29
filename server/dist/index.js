import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { resolveTicket } from "./resolutionEngine.js";
const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 4000);
const otpTtlMs = 5 * 60 * 1000;
const registrationTokenTtlMs = 10 * 60 * 1000;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";
const pendingOtps = new Map();
const verifiedRegistrationTokens = new Map();
const ticketSchema = z.object({
    title: z.string().min(2),
    department: z.string().min(2),
    materialType: z.string().min(2),
    requiredSkill: z.string().min(2),
    priority: z.enum(["Low", "Medium", "High"]),
    topic: z.string().optional(),
    subject: z.string().min(2).default("Delivery Date"),
    customerMessage: z.string().optional(),
    hubOrderNo: z.string().optional(),
    materialNo: z.string().optional(),
    supplierEntity: z.string().optional(),
    shippingType: z.string().optional(),
    shippingDate: z.string().optional(),
    autoObdRelease: z.boolean().optional(),
    hasUserStatusBlock: z.boolean().default(false),
    itemStatus: z.number().int().optional(),
    deliveryDate: z.string().optional(),
    purchaseGroup: z.string().optional(),
    isKit: z.boolean().default(false),
    orderStatus: z.number().int().optional(),
    customerCenterInsisting: z.boolean().default(false),
    plannerName: z.string().optional(),
    plannerApprovedCancellation: z.boolean().optional()
});
const orderIntegrationSchema = z.object({
    orderId: z.string().min(1),
    title: z.string().min(2).optional(),
    department: z.string().min(2),
    materialType: z.string().min(2),
    requiredSkill: z.string().min(2),
    priority: z.enum(["Low", "Medium", "High"]),
    customerName: z.string().optional(),
    quantity: z.number().int().positive().optional()
});
const externalTicketSchema = ticketSchema.extend({
    externalTicketId: z.string().min(1).optional(),
    sourceSystem: z.string().min(2).optional()
});
const startRegistrationSchema = z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email().transform((email) => email.toLowerCase())
});
const verifyOtpSchema = z.object({
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    otp: z.string().trim().regex(/^\d{6}$/)
});
const completeRegistrationSchema = startRegistrationSchema.extend({
    password: z.string().min(8),
    registrationToken: z.string().min(20)
});
app.use(cors());
app.use(express.json());
function createOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}
function sanitizeUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role ?? "USER",
        approvalStatus: user.approvalStatus ?? "APPROVED"
    };
}
function getSuperAdminEmail() {
    return process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
}
function isSuperAdminEmail(email) {
    return email.toLowerCase() === getSuperAdminEmail();
}
function getAppBaseUrl() {
    return (process.env.APP_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, "");
}
function parseSender() {
    const mailFrom = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "";
    const match = mailFrom.match(/^(.*?)\s*<([^>]+)>$/);
    const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    if (brevoSenderEmail) {
        return {
            name: match?.[1]?.trim() || process.env.MAIL_FROM_NAME || "AutoAssign",
            email: brevoSenderEmail
        };
    }
    if (match) {
        return {
            name: match[1]?.trim() || "AutoAssign",
            email: match[2]?.trim()
        };
    }
    return {
        name: process.env.MAIL_FROM_NAME ?? "AutoAssign",
        email: mailFrom.trim()
    };
}
async function sendViaBrevo(options) {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    if (!apiKey) {
        return false;
    }
    if (!apiKey.startsWith("xkeysib-")) {
        console.error("BREVO_API_KEY does not look like a Brevo API key. It should start with xkeysib-. Falling back to SMTP if configured.");
        return false;
    }
    const sender = parseSender();
    if (!sender.email) {
        throw new Error("MAIL_FROM or BREVO_SENDER_EMAIL is required when BREVO_API_KEY is configured.");
    }
    const response = await fetch(brevoApiUrl, {
        method: "POST",
        headers: {
            accept: "application/json",
            "api-key": apiKey,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            sender,
            to: [{ email: options.to, name: options.toName }],
            subject: options.subject,
            textContent: options.text,
            htmlContent: options.html
        })
    });
    if (!response.ok) {
        const message = await response.text();
        console.error(`Brevo email failed: ${response.status} ${message}. Falling back to SMTP if configured.`);
        return false;
    }
    return true;
}
function createMailTransport() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS?.replace(/\s/g, "");
    if (!host || !user || !pass) {
        throw new Error("SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM to server/.env.");
    }
    return nodemailer.createTransport({
        host,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user, pass }
    });
}
function getEmailSetupMessage() {
    if (process.env.NODE_ENV === "production") {
        return "OTP email could not be sent. Set a Brevo API key that starts with xkeysib-, or configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, and SUPER_ADMIN_EMAIL in Render, then redeploy.";
    }
    return "OTP email could not be sent. Configure SMTP settings in server/.env, or set a Brevo API key that starts with xkeysib-.";
}
async function sendRegistrationOtpEmail(email, name, otp) {
    const text = `Hello ${name},\n\nYour AutoAssign registration OTP is ${otp}.\n\nThis code expires in 5 minutes.\n\nIf you did not request this, you can ignore this email.`;
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#16202a">
      <h2 style="margin:0 0 12px">AutoAssign email verification</h2>
      <p>Hello ${name},</p>
      <p>Use this OTP to complete your registration:</p>
      <div style="font-size:28px;font-weight:800;letter-spacing:8px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:16px;text-align:center">${otp}</div>
      <p style="color:#64748b">This code expires in 5 minutes.</p>
    </div>
  `;
    if (await sendViaBrevo({ to: email, toName: name, subject: "Your AutoAssign registration OTP", text, html })) {
        return;
    }
    const transport = createMailTransport();
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
    await transport.sendMail({
        from,
        to: email,
        subject: "Your AutoAssign registration OTP",
        text,
        html
    });
}
async function sendApprovalRequestEmail(user) {
    const superAdminEmail = getSuperAdminEmail();
    if (!superAdminEmail) {
        throw new Error("SUPER_ADMIN_EMAIL is not configured in server/.env.");
    }
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
    const appBaseUrl = getAppBaseUrl();
    const approveUrl = `${appBaseUrl}/auth/admin/approve?token=${user.approvalToken}`;
    const rejectUrl = `${appBaseUrl}/auth/admin/reject?token=${user.approvalToken}`;
    const text = `A new user is waiting for approval.\n\nName: ${user.name}\nEmail: ${user.email}\n\nApprove: ${approveUrl}\nReject: ${rejectUrl}`;
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#16202a">
      <h2 style="margin:0 0 12px">AutoAssign approval request</h2>
      <p>A new user completed OTP verification and password creation.</p>
      <div style="background:#f8fafc;border:1px solid #dce4ee;border-radius:8px;padding:16px;margin:16px 0">
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
      </div>
      <p>
        <a href="${approveUrl}" style="display:inline-block;background:#16202a;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700;margin-right:8px">Approve</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#fff1f2;color:#be123c;text-decoration:none;border:1px solid #fecdd3;border-radius:8px;padding:12px 18px;font-weight:700">Reject</a>
      </p>
    </div>
  `;
    if (await sendViaBrevo({ to: superAdminEmail, toName: "AutoAssign Admin", subject: "AutoAssign user approval request", text, html })) {
        return;
    }
    const transport = createMailTransport();
    await transport.sendMail({
        from,
        to: superAdminEmail,
        subject: "AutoAssign user approval request",
        text,
        html
    });
}
async function getExistingResolution(ticketId) {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { assignedTo: true }
    });
    if (!ticket || ticket.status === "Incoming") {
        return null;
    }
    const assignment = await prisma.assignment.findFirst({
        where: { ticketId },
        orderBy: { createdAt: "desc" },
        include: { ticket: { include: { assignedTo: true } }, employee: true }
    });
    if (!assignment) {
        return null;
    }
    return {
        ticket,
        assignment,
        steps: JSON.parse(assignment.steps)
    };
}
async function resolveAndPersistTicket(ticket) {
    const existingResolution = await getExistingResolution(ticket.id);
    if (existingResolution) {
        return existingResolution;
    }
    const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
    const decision = resolveTicket(ticket, employees);
    return prisma.$transaction(async (tx) => {
        let updatedTicket = await tx.ticket.update({
            where: { id: ticket.id },
            data: {
                status: decision.status,
                assignedToId: decision.employee?.id ?? null,
                score: decision.score,
                reason: decision.reason,
                recommendedAction: decision.action,
                routedTeam: decision.routedTeam
            },
            include: { assignedTo: true }
        });
        if (decision.employee) {
            await tx.employee.update({
                where: { id: decision.employee.id },
                data: { activeTickets: { increment: 1 } }
            });
            updatedTicket = await tx.ticket.findUniqueOrThrow({
                where: { id: ticket.id },
                include: { assignedTo: true }
            });
        }
        const assignment = await tx.assignment.create({
            data: {
                ticketId: ticket.id,
                employeeId: decision.employee?.id ?? null,
                score: decision.score,
                reason: decision.reason,
                steps: JSON.stringify(decision.steps)
            },
            include: { ticket: true, employee: true }
        });
        return { ticket: updatedTicket, assignment, steps: decision.steps };
    });
}
function toIntegrationResponse(result, metadata = {}) {
    return {
        ...metadata,
        ticketId: result.ticket.id,
        status: result.ticket.status,
        recommendedAction: result.ticket.recommendedAction,
        routedTeam: result.ticket.routedTeam,
        assignedEmployee: result.assignment.employee
            ? {
                id: result.assignment.employee.id,
                name: result.assignment.employee.name,
                department: result.assignment.employee.department,
                activeTickets: result.assignment.employee.activeTickets,
                maxCapacity: result.assignment.employee.maxCapacity
            }
            : null,
        score: result.assignment.score,
        reason: result.assignment.reason,
        steps: result.steps,
        ticket: result.ticket
    };
}
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
app.post("/auth/register/start", async (req, res, next) => {
    try {
        const data = startRegistrationSchema.parse(req.body);
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
        if (existingUser) {
            res.status(409).json({ message: "This email is already registered." });
            return;
        }
        const otp = createOtp();
        pendingOtps.set(data.email, {
            name: data.name,
            otp,
            expiresAt: Date.now() + otpTtlMs
        });
        try {
            await sendRegistrationOtpEmail(data.email, data.name, otp);
        }
        catch (mailError) {
            pendingOtps.delete(data.email);
            console.error(mailError);
            res.status(503).json({
                message: getEmailSetupMessage()
            });
            return;
        }
        console.log(`Registration OTP sent to ${data.email}`);
        res.json({
            message: "OTP sent to your email.",
            expiresInSeconds: otpTtlMs / 1000
        });
    }
    catch (error) {
        next(error);
    }
});
app.post("/auth/register/verify-otp", async (req, res, next) => {
    try {
        const data = verifyOtpSchema.parse(req.body);
        const pending = pendingOtps.get(data.email);
        if (!pending || pending.expiresAt < Date.now()) {
            pendingOtps.delete(data.email);
            res.status(400).json({ message: "OTP expired. Please request a new OTP." });
            return;
        }
        if (pending.otp !== data.otp) {
            res.status(400).json({ message: "Incorrect OTP. Please check and try again." });
            return;
        }
        const registrationToken = crypto.randomBytes(32).toString("hex");
        verifiedRegistrationTokens.set(registrationToken, {
            name: pending.name,
            email: data.email,
            expiresAt: Date.now() + registrationTokenTtlMs
        });
        pendingOtps.delete(data.email);
        res.json({
            message: "Email verified successfully.",
            registrationToken
        });
    }
    catch (error) {
        next(error);
    }
});
app.post("/auth/register/complete", async (req, res, next) => {
    try {
        const data = completeRegistrationSchema.parse(req.body);
        const verified = verifiedRegistrationTokens.get(data.registrationToken);
        if (!verified || verified.email !== data.email || verified.expiresAt < Date.now()) {
            verifiedRegistrationTokens.delete(data.registrationToken);
            res.status(400).json({ message: "Email verification is missing or expired." });
            return;
        }
        const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
        if (existingUser) {
            res.status(409).json({ message: "This email is already registered." });
            return;
        }
        const isSuperAdmin = isSuperAdminEmail(data.email);
        const approvalToken = isSuperAdmin ? null : crypto.randomBytes(32).toString("hex");
        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                passwordHash: hashPassword(data.password),
                verified: true,
                role: isSuperAdmin ? "SUPER_ADMIN" : "USER",
                approvalStatus: isSuperAdmin ? "APPROVED" : "PENDING",
                approvalToken,
                approvedAt: isSuperAdmin ? new Date() : null
            }
        });
        verifiedRegistrationTokens.delete(data.registrationToken);
        if (!isSuperAdmin && approvalToken) {
            try {
                await sendApprovalRequestEmail({ name: user.name, email: user.email, approvalToken });
            }
            catch (mailError) {
                console.error(mailError);
            }
        }
        res.status(201).json({
            message: isSuperAdmin
                ? "Super admin registration complete."
                : "Registration complete. Please wait for super admin approval.",
            user: sanitizeUser(user)
        });
    }
    catch (error) {
        next(error);
    }
});
app.get(/^\/+auth\/admin\/approve$/, async (req, res, next) => {
    try {
        const token = String(req.query.token ?? "");
        const user = await prisma.user.findUnique({ where: { approvalToken: token } });
        if (!token || !user) {
            res.status(404).send("<h1>Approval link is invalid or expired.</h1>");
            return;
        }
        await prisma.user.update({
            where: { id: user.id },
            data: {
                approvalStatus: "APPROVED",
                approvalToken: null,
                approvedAt: new Date()
            }
        });
        res.send(`<h1>User approved</h1><p>${user.name} (${user.email}) can now access AutoAssign.</p>`);
    }
    catch (error) {
        next(error);
    }
});
app.get(/^\/+auth\/admin\/reject$/, async (req, res, next) => {
    try {
        const token = String(req.query.token ?? "");
        const user = await prisma.user.findUnique({ where: { approvalToken: token } });
        if (!token || !user) {
            res.status(404).send("<h1>Rejection link is invalid or expired.</h1>");
            return;
        }
        await prisma.user.update({
            where: { id: user.id },
            data: {
                approvalStatus: "REJECTED",
                approvalToken: null
            }
        });
        res.send(`<h1>User rejected</h1><p>${user.name} (${user.email}) cannot access AutoAssign.</p>`);
    }
    catch (error) {
        next(error);
    }
});
app.get("/auth/approval-status", async (req, res, next) => {
    try {
        const email = String(req.query.email ?? "").trim().toLowerCase();
        if (!email) {
            res.status(400).json({ message: "Email is required." });
            return;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(404).json({ message: "User not found." });
            return;
        }
        res.json({
            approvalStatus: user.approvalStatus,
            user: user.approvalStatus === "APPROVED" ? sanitizeUser(user) : null
        });
    }
    catch (error) {
        next(error);
    }
});
app.get("/tickets", async (_req, res, next) => {
    try {
        const tickets = await prisma.ticket.findMany({
            orderBy: { id: "asc" },
            include: { assignedTo: true }
        });
        res.json(tickets);
    }
    catch (error) {
        next(error);
    }
});
app.post("/tickets", async (req, res, next) => {
    try {
        const data = ticketSchema.parse(req.body);
        const ticket = await prisma.ticket.create({ data });
        const shouldAutoResolve = req.query.autoResolve === "true" || req.query.autoAssign === "true";
        if (shouldAutoResolve) {
            const result = await resolveAndPersistTicket(ticket);
            res.status(201).json(result);
            return;
        }
        res.status(201).json(ticket);
    }
    catch (error) {
        next(error);
    }
});
async function resolveTicketById(ticketId) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
        return null;
    }
    return resolveAndPersistTicket(ticket);
}
app.post("/tickets/:id/resolve", async (req, res, next) => {
    try {
        const ticketId = Number(req.params.id);
        const result = await resolveTicketById(ticketId);
        if (!result) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
app.post("/tickets/:id/assign", async (req, res, next) => {
    try {
        const result = await resolveTicketById(Number(req.params.id));
        if (!result) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
app.delete("/tickets/:id", async (req, res, next) => {
    try {
        const ticketId = Number(req.params.id);
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
            res.status(404).json({ message: "Ticket not found" });
            return;
        }
        await prisma.$transaction(async (tx) => {
            await tx.assignment.deleteMany({ where: { ticketId } });
            if (ticket.assignedToId && ticket.status !== "Incoming") {
                const employee = await tx.employee.findUnique({ where: { id: ticket.assignedToId } });
                if (employee) {
                    await tx.employee.update({
                        where: { id: employee.id },
                        data: { activeTickets: Math.max(0, employee.activeTickets - 1) }
                    });
                }
            }
            await tx.ticket.delete({ where: { id: ticketId } });
        });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
app.post("/integrations/tickets", async (req, res, next) => {
    try {
        const data = externalTicketSchema.parse(req.body);
        const ticket = await prisma.ticket.create({
            data: {
                title: data.title,
                department: data.department,
                materialType: data.materialType,
                requiredSkill: data.requiredSkill,
                priority: data.priority,
                topic: data.topic,
                subject: data.subject,
                customerMessage: data.customerMessage,
                hubOrderNo: data.hubOrderNo,
                materialNo: data.materialNo,
                supplierEntity: data.supplierEntity,
                shippingType: data.shippingType,
                shippingDate: data.shippingDate,
                autoObdRelease: data.autoObdRelease,
                hasUserStatusBlock: data.hasUserStatusBlock,
                itemStatus: data.itemStatus,
                deliveryDate: data.deliveryDate,
                purchaseGroup: data.purchaseGroup,
                isKit: data.isKit,
                orderStatus: data.orderStatus,
                customerCenterInsisting: data.customerCenterInsisting,
                plannerName: data.plannerName,
                plannerApprovedCancellation: data.plannerApprovedCancellation
            }
        });
        const result = await resolveAndPersistTicket(ticket);
        res.status(201).json(toIntegrationResponse(result, {
            externalTicketId: data.externalTicketId ?? null,
            sourceSystem: data.sourceSystem ?? "External system",
            accepted: true
        }));
    }
    catch (error) {
        next(error);
    }
});
app.post("/integrations/orders", async (req, res, next) => {
    try {
        const data = orderIntegrationSchema.parse(req.body);
        const ticket = await prisma.ticket.create({
            data: {
                title: data.title ?? `Order #${data.orderId} - ${data.materialType} Request`,
                department: data.department,
                materialType: data.materialType,
                requiredSkill: data.requiredSkill,
                priority: data.priority,
                topic: data.title ?? `Order #${data.orderId}`,
                subject: "Delivery Date",
                hubOrderNo: data.orderId,
                supplierEntity: "External order system",
                autoObdRelease: true
            }
        });
        const result = await resolveAndPersistTicket(ticket);
        res.status(201).json(toIntegrationResponse(result, { orderId: data.orderId, sourceSystem: "Order system", accepted: true }));
    }
    catch (error) {
        next(error);
    }
});
app.get("/employees", async (_req, res, next) => {
    try {
        const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
        res.json(employees);
    }
    catch (error) {
        next(error);
    }
});
app.get("/assignments", async (_req, res, next) => {
    try {
        const assignments = await prisma.assignment.findMany({
            orderBy: { createdAt: "desc" },
            include: { ticket: true, employee: true }
        });
        res.json(assignments.map((assignment) => ({
            ...assignment,
            steps: JSON.parse(assignment.steps)
        })));
    }
    catch (error) {
        next(error);
    }
});
app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid request", issues: error.issues });
        return;
    }
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
});
app.listen(port, () => {
    console.log(`Ticket assignment API running on http://localhost:${port}`);
});
