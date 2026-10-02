/**
 * GET  /api/admin/inquiries/[id] — تفاصيل الاستفسار ومحادثته.
 * PATCH /api/admin/inquiries/[id] — تعيين/حالة/أولوية/أرشفة.
 * POST /api/admin/inquiries/[id]/messages — رد أو ملاحظة داخلية.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify } from "@/lib/auth/notifications";
import { fingerprint } from "@/lib/ratelimit";

const INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded", "closed"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "inquiries.view.all");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const inquiry = await db.inquiry.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, roleKey: true } } } },
      attachments: true,
      client: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
  if (!inquiry) return json({ ok: false, code: "not_found" }, 404);
  return json({ ok: true, inquiry });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user: actor } = guard;
  const { id } = await params;

  const inquiry = await db.inquiry.findUnique({ where: { id } });
  if (!inquiry) return json({ ok: false, code: "not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  if ("assigneeId" in body) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.assign"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const assigneeId = body.assigneeId === null || body.assigneeId === "" ? null : String(body.assigneeId);
    if (assigneeId) {
      const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { status: true, roleKey: true } });
      if (!assignee || assignee.status !== "active" || assignee.roleKey === "client") return json({ ok: false, code: "invalid_assignee" }, 400);
    }
    await db.inquiry.update({ where: { id }, data: { assigneeId, lastActivityAt: new Date() } });
    await audit({ actorId: actor.id, actorEmail: actor.email, action: "inquiry.assigned", entityType: "inquiry", entityId: id, details: { to: assigneeId } });
    return json({ ok: true });
  }

  if ("status" in body) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.status"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const to = String(body.status);
    if (!INQUIRY_STATUSES.includes(to)) return json({ ok: false, code: "invalid" }, 400);
    await db.inquiry.update({
      where: { id },
      data: { status: to, lastActivityAt: new Date(), ...(to === "closed" ? { closedAt: new Date() } : {}) },
    });
    await db.inquiryMessage.create({ data: { inquiryId: id, authorId: actor.id, authorType: "system", kind: "system", body: `status:${to}` } });
    await audit({ actorId: actor.id, actorEmail: actor.email, action: "inquiry.status_changed", entityType: "inquiry", entityId: id, details: { from: inquiry.status, to } });
    if (inquiry.clientId) {
      await notify({ userId: inquiry.clientId, type: to === "awaiting_info" ? "info_requested" : "status_changed", payload: { ref: inquiry.refCode, status: to }, link: `/${inquiry.locale}/account/inquiries/${id}` });
    }
    return json({ ok: true });
  }

  if (body.action === "archive" || body.action === "restore") {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.archive"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    await db.inquiry.update({ where: { id }, data: { archivedAt: body.action === "archive" ? new Date() : null } });
    return json({ ok: true });
  }

  return json({ ok: false, code: "invalid" }, 400);
}
