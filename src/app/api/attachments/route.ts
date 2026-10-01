/**
 * POST /api/attachments — رفع مرفق لطلب/استفسار (عميل أو طاقم).
 * GET  /api/attachments/[id] — تنزيل بصلاحية: المالك أو الطاقم المصرح له.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { storeUpload } from "@/lib/file-storage";
import { canAccessRequest } from "@/lib/requests-service";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify, notifyMany, staffToNotifyForRequests } from "@/lib/auth/notifications";

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const file = form.get("file");
  const requestId = String(form.get("requestId") ?? "");
  if (!(file instanceof File) || !requestId) return json({ ok: false, code: "invalid" }, 400);

  const request = await db.projectRequest.findUnique({ where: { id: requestId } });
  if (!request) return json({ ok: false, code: "not_found" }, 404);
  if (!canAccessRequest(user, request)) return json({ ok: false, code: "forbidden" }, 403);
  if (user.roleKey === "client" && (request.status === "closed" || request.status === "cancelled")) {
    return json({ ok: false, code: "locked" }, 409);
  }

  const stored = await storeUpload(file, "attachment");
  if ("error" in stored) return json({ ok: false, code: stored.error }, 400);

  const attachment = await db.attachment.create({
    data: {
      filename: stored.filename,
      storedName: stored.storedName,
      mimeType: stored.mimeType,
      size: stored.size,
      kind: "request_attachment",
      uploaderId: user.id,
      requestId,
    },
  });

  await db.projectRequest.update({ where: { id: requestId }, data: { lastActivityAt: new Date() } });

  await audit({
    actorId: user.id, actorEmail: user.email, action: "attachment.uploaded",
    entityType: "attachment", entityId: attachment.id, details: { requestId, filename: stored.filename, size: stored.size },
  });

  // إشعار الجهة الأخرى
  if (user.roleKey === "client") {
    const targets = request.assigneeId ? [{ id: request.assigneeId }] : await staffToNotifyForRequests();
    await notifyMany(targets.map((t) => ({ userId: t.id, type: "reply_received" as const, payload: { ref: request.refCode, attachment: stored.filename }, link: `/ar/admin/requests/${requestId}` })));
  } else if (request.clientId) {
    await notify({ userId: request.clientId, type: "reply_received", payload: { ref: request.refCode, attachment: stored.filename }, link: `/ar/account/requests/${requestId}` });
  }

  return json({ ok: true, attachment: { id: attachment.id, filename: stored.filename, size: stored.size, mimeType: stored.mimeType } }, 201);
}
