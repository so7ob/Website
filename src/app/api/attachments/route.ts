/**
 * POST /api/attachments — رفع مرفق لطلب أو استفسار (عميل أو طاقم).
 * GET  /api/attachments/[id] — تنزيل بصلاحية: المالك أو الطاقم أو حامل رابط متابعة فعّال.
 *
 * الحقول:
 * - file (إلزامي) + واحد بالضبط من: requestId | inquiryId
 * - messageId (اختياري): يربط المرفق برسالة محددة — يجب أن تنتمي لنفس البطاقة
 *   وأن يكون الرافع مؤلف الرسالة أو طاقمًا. مرفقات الرسائل العلنية هي وحدها
 *   التي تظهر على بطاقة المتابعة وتنزَّل عبر الرابط.
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
  const inquiryId = String(form.get("inquiryId") ?? "");
  const messageId = String(form.get("messageId") ?? "");

  if (!(file instanceof File)) return json({ ok: false, code: "invalid" }, 400);
  // بالضبط واحد من الاثنين — لا أكثر ولا أقل
  if (Boolean(requestId) === Boolean(inquiryId)) return json({ ok: false, code: "invalid" }, 400);

  const stored = await storeUpload(file, "attachment");
  if ("error" in stored) return json({ ok: false, code: stored.error }, 400);

  // ——— مرفق طلب ———
  if (requestId) {
    const request = await db.projectRequest.findUnique({ where: { id: requestId } });
    if (!request) return json({ ok: false, code: "not_found" }, 404);
    if (!canAccessRequest(user, request)) return json({ ok: false, code: "forbidden" }, 403);
    if (user.roleKey === "client" && (request.status === "closed" || request.status === "cancelled")) {
      return json({ ok: false, code: "locked" }, 409);
    }

    // ربط برسالة؟ التحقق الصارم: نفس الطلب + الرافع مؤلفها أو طاقم
    let linkedMessageId: string | null = null;
    if (messageId) {
      const msg = await db.requestMessage.findUnique({ where: { id: messageId }, select: { id: true, requestId: true, authorId: true, authorType: true } });
      if (!msg || msg.requestId !== requestId) return json({ ok: false, code: "invalid_message" }, 400);
      const isMsgAuthor = msg.authorId === user.id;
      const isStaff = user.roleKey === "super_admin" || user.permissions.includes("requests.view.all");
      if (!isMsgAuthor && !isStaff) return json({ ok: false, code: "forbidden" }, 403);
      linkedMessageId = msg.id;
    }

    const attachment = await db.attachment.create({
      data: {
        filename: stored.filename,
        storedName: stored.storedName,
        mimeType: stored.mimeType,
        size: stored.size,
        kind: "request_attachment",
        uploaderId: user.id,
        requestId,
        ...(linkedMessageId ? { messageId: linkedMessageId } : {}),
      },
    });

    await db.projectRequest.update({ where: { id: requestId }, data: { lastActivityAt: new Date() } });

    await audit({
      actorId: user.id, actorEmail: user.email, action: "attachment.uploaded",
      entityType: "attachment", entityId: attachment.id,
      details: { requestId, filename: stored.filename, size: stored.size, messageId: linkedMessageId },
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

  // ——— مرفق استفسار ———
  const inquiry = await db.inquiry.findUnique({ where: { id: inquiryId } });
  if (!inquiry) return json({ ok: false, code: "not_found" }, 404);
  const isStaffForInquiries = user.roleKey === "super_admin" || user.permissions.includes("inquiries.view.all");
  const isOwner = Boolean(inquiry.clientId && inquiry.clientId === user.id);
  if (!isStaffForInquiries && !isOwner) return json({ ok: false, code: "forbidden" }, 403);
  if (isOwner && (inquiry.status === "closed" || inquiry.status === "cancelled")) {
    return json({ ok: false, code: "locked" }, 409);
  }

  // ربط برسالة؟ نفس الاستفسار + الرافع مؤلفها أو طاقم
  let linkedMessageId: string | null = null;
  if (messageId) {
    const msg = await db.inquiryMessage.findUnique({ where: { id: messageId }, select: { id: true, inquiryId: true, authorId: true } });
    if (!msg || msg.inquiryId !== inquiryId) return json({ ok: false, code: "invalid_message" }, 400);
    if (msg.authorId !== user.id && !isStaffForInquiries) return json({ ok: false, code: "forbidden" }, 403);
    linkedMessageId = msg.id;
  }

  const attachment = await db.attachment.create({
    data: {
      filename: stored.filename,
      storedName: stored.storedName,
      mimeType: stored.mimeType,
      size: stored.size,
      kind: "inquiry_attachment",
      uploaderId: user.id,
      inquiryId,
      ...(linkedMessageId ? { messageId: linkedMessageId } : {}),
    },
  });

  await db.inquiry.update({ where: { id: inquiryId }, data: { lastActivityAt: new Date() } });

  await audit({
    actorId: user.id, actorEmail: user.email, action: "attachment.uploaded",
    entityType: "attachment", entityId: attachment.id,
    details: { inquiryId, filename: stored.filename, size: stored.size, messageId: linkedMessageId },
  });

  // إشعار الجهة الأخرى
  if (isOwner) {
    const targets = await staffToNotifyForRequests();
    await notifyMany(targets.map((t) => ({ userId: t.id, type: "reply_received" as const, payload: { ref: inquiry.refCode, attachment: stored.filename }, link: `/ar/admin/inquiries/${inquiryId}` })));
  } else if (inquiry.clientId) {
    await notify({ userId: inquiry.clientId, type: "reply_received", payload: { ref: inquiry.refCode, attachment: stored.filename }, link: `/ar/account/inquiries/${inquiryId}` });
  }

  return json({ ok: true, attachment: { id: attachment.id, filename: stored.filename, size: stored.size, mimeType: stored.mimeType } }, 201);
}
