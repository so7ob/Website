/**
 * GET   /api/admin/requests/[id] — التفاصيل الكاملة (مع الملاحظات الداخلية للطاقم).
 * PATCH /api/admin/requests/[id] — تعيين/حالة/أولوية/أرشفة/استعادة، مع قواعد الانتقال والتدقيق.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { canTransition, serializeRequestForStaff, notifyStatusChange, markRead } from "@/lib/requests-service";
import { REQUEST_STATUSES, REQUEST_PRIORITIES } from "@/lib/requests-service";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify } from "@/lib/auth/notifications";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "requests.view.all");
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const request = await serializeRequestForStaff(id);
  if (!request) return json({ ok: false, code: "not_found" }, 404);
  await markRead(id, guard.user);
  return json({ ok: true, request });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user: actor } = guard;
  const { id } = await params;

  const request = await db.projectRequest.findUnique({ where: { id } });
  if (!request) return json({ ok: false, code: "not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  // ——— التعيين ———
  if ("assigneeId" in body) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("requests.assign"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const assigneeId = body.assigneeId === null || body.assigneeId === "" ? null : String(body.assigneeId);
    if (assigneeId) {
      const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { roleKey: true, status: true, name: true } });
      if (!assignee || assignee.status !== "active" || assignee.roleKey === "client") {
        return json({ ok: false, code: "invalid_assignee" }, 400);
      }
      await notify({
        userId: assigneeId,
        type: "request_assigned",
        payload: { ref: request.refCode },
        link: `/ar/admin/requests/${id}`,
      });
    }
    await db.projectRequest.update({ where: { id }, data: { assigneeId, lastActivityAt: new Date() } });
    await audit({
      actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.requestAssigned,
      entityType: "request", entityId: id, details: { from: request.assigneeId, to: assigneeId, ref: request.refCode },
    });
    return json({ ok: true });
  }

  // ——— الأولوية ———
  if ("priority" in body) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("requests.status"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const priority = String(body.priority);
    if (!REQUEST_PRIORITIES.includes(priority as never)) return json({ ok: false, code: "invalid" }, 400);
    await db.projectRequest.update({ where: { id }, data: { priority, lastActivityAt: new Date() } });
    await audit({ actorId: actor.id, actorEmail: actor.email, action: "request.priority_changed", entityType: "request", entityId: id, details: { from: request.priority, to: priority } });
    return json({ ok: true });
  }

  // ——— الأرشفة / الاستعادة (بدل الحذف) ———
  if (body.action === "archive" || body.action === "restore") {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("requests.archive"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    if (body.action === "archive") {
      await db.projectRequest.update({ where: { id }, data: { archivedAt: new Date() } });
      await audit({ actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.requestArchived, entityType: "request", entityId: id });
    } else {
      await db.projectRequest.update({ where: { id }, data: { archivedAt: null } });
      await audit({ actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.requestRestored, entityType: "request", entityId: id });
    }
    return json({ ok: true });
  }

  // ——— تغيير الحالة ———
  if ("status" in body) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("requests.status"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const to = String(body.status);
    if (!REQUEST_STATUSES.includes(to as never)) return json({ ok: false, code: "invalid" }, 400);
    if (!canTransition(request.status, to, "staff")) return json({ ok: false, code: "invalid_transition" }, 409);

    const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
    const isClosure = to === "closed" || to === "cancelled";

    await db.$transaction([
      db.projectRequest.update({
        where: { id },
        data: {
          status: to,
          lastActivityAt: new Date(),
          ...(isClosure ? { closedAt: new Date(), resolutionNote: note } : {}),
          ...(to !== "closed" && to !== "cancelled" ? { closedAt: null } : {}),
        },
      }),
      db.requestStatusEvent.create({ data: { requestId: id, fromStatus: request.status, toStatus: to, changedById: actor.id, note } }),
      db.requestMessage.create({
        data: {
          requestId: id,
          authorId: actor.id,
          authorType: "system",
          kind: "system",
          body: `status:${to}${note ? `: ${note}` : ""}`,
        },
      }),
    ]);

    await audit({
      actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.requestStatusChanged,
      entityType: "request", entityId: id, details: { from: request.status, to, note, ref: request.refCode },
    });
    await notifyStatusChange(id, to);
    return json({ ok: true });
  }

  return json({ ok: false, code: "invalid" }, 400);
}
