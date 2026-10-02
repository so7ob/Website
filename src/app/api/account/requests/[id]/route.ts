/**
 * GET /api/account/requests/[id] — تفاصيل طلب ومحادثته (الملاحظات الداخلية مستبعدة في الخادم).
 * PATCH — تعديل الطلب (بياناته) مسموح للعميل فقط قبل بدء المعالجة، أو إلغاؤه وفق قواعد الانتقال.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { canAccessRequest, serializeRequestForClient, serializeRequestForStaff, markRead, canTransition, notifyStatusChange } from "@/lib/requests-service";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { isStaff } from "@/lib/auth/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;
  const { id } = await params;

  const request = await db.projectRequest.findUnique({ where: { id } });
  if (!request) return json({ ok: false, code: "not_found" }, 404);
  if (!canAccessRequest(user, request)) return json({ ok: false, code: "forbidden" }, 403);

  const data = isStaff(user) ? await serializeRequestForStaff(id) : await serializeRequestForClient(id);
  if (!data) return json({ ok: false, code: "not_found" }, 404);

  // العميل: تعليم المحادثة مقروءة من جهته
  if (user.roleKey === "client") {
    const unreadStaff = data.lastStaffReplyAt && (data.clientReadAt === null || data.lastStaffReplyAt > data.clientReadAt);
    if (unreadStaff) await markRead(id, user);
  } else {
    await markRead(id, user);
  }

  return json({ ok: true, request: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;
  const { id } = await params;

  const request = await db.projectRequest.findUnique({ where: { id } });
  if (!request) return json({ ok: false, code: "not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  // إلغاء الطلب — العميل قبل بدء المعالجة، أو الطاقم بصلاحية الحالة
  if (body.action === "cancel") {
    const actor = user.roleKey === "client" ? "client" : "staff";
    if (actor === "staff" && !(user.permissions.includes("requests.status") || user.roleKey === "super_admin")) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    if (user.roleKey === "client" && !canAccessRequest(user, request)) return json({ ok: false, code: "forbidden" }, 403);
    if (!canTransition(request.status, "cancelled", actor)) return json({ ok: false, code: "invalid_transition" }, 409);

    const note = String(body.note ?? "").slice(0, 500) || null;
    await db.$transaction([
      db.projectRequest.update({
        where: { id },
        data: { status: "cancelled", closedAt: new Date(), resolutionNote: note, lastActivityAt: new Date() },
      }),
      db.requestStatusEvent.create({ data: { requestId: id, fromStatus: request.status, toStatus: "cancelled", changedById: user.id, note } }),
      db.requestMessage.create({
        data: { requestId: id, authorType: "system", kind: "system", body: note ?? "" },
      }),
    ]);
    await audit({ actorId: user.id, actorEmail: user.email, action: "request.cancelled", entityType: "request", entityId: id, details: { note } });
    return json({ ok: true });
  }

  // تعديل بيانات الطلب — العميل قبل بدء المعالجة فقط، وتسجل التعديلات
  if (user.roleKey === "client") {
    if (!canAccessRequest(user, request)) return json({ ok: false, code: "forbidden" }, 403);
    if (!["new", "in_review", "awaiting_info"].includes(request.status)) {
      return json({ ok: false, code: "locked" }, 409); // بعد بدء المعالجة: تحديثات عبر المحادثة
    }
    const updates: Record<string, string> = {};
    for (const key of ["description", "referenceUrl", "phone", "company", "budget", "currency", "timeline", "preferredContact"]) {
      if (typeof body[key] === "string") updates[key] = String(body[key]).slice(0, 5000);
    }
    if (typeof body.serviceType === "string" && ["web", "mobile", "systems", "ux", "automation", "maintenance", "unsure"].includes(body.serviceType)) {
      updates.serviceType = body.serviceType;
    }
    if (!Object.keys(updates).length) return json({ ok: false, code: "invalid" }, 400);

    const before = JSON.stringify({ description: request.description, referenceUrl: request.referenceUrl, serviceType: request.serviceType });
    await db.projectRequest.update({ where: { id }, data: { ...updates, lastActivityAt: new Date() } });
    const after = JSON.stringify({ description: updates.description ?? request.description, referenceUrl: updates.referenceUrl ?? request.referenceUrl, serviceType: updates.serviceType ?? request.serviceType });
    // تعديل مرئي قابل للتتبع — لا تعديل صامت
    await db.requestMessage.create({
      data: { requestId: id, authorId: user.id, authorType: "system", kind: "system", body: "request_updated" },
    });
    await audit({
      actorId: user.id, actorEmail: user.email, action: "request.updated", entityType: "request", entityId: id,
      details: { before, after, fields: Object.keys(updates) },
    });
    return json({ ok: true });
  }

  return json({ ok: false, code: "forbidden" }, 403);
}
