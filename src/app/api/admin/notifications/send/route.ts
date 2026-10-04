/**
 * POST /api/admin/notifications/send — إشعار بريدي إداري لمستخدم مسجل (الطور 2 — G7).
 *
 * يحسم الفجوة G7: صلاحية `notifications.send` كانت معرفة بلا مسار يفرضها —
 * هذا المسار هو التنفيذ الرسمي: فقط حامل الصلاحية يرسل بريدًا إداريًا
 * إلى بريد مستخدم مسجل (نشط)، عبر بنية sendMail القائمة (سجل EmailLog
 * وصندوق الصادر ووضع التطوير)، مع تدقيق notificationSent.
 *
 * قواعد السلامة:
 * - المستلم حساب مسجل فعلًا (لا إرسال لبريد خارجي عشوائي) ونشط — لا موقوفات.
 * - التحقق النقي في src/lib/notifications/admin-send.ts (مصدر حقيقة مشترك مع الواجهة).
 * - وضع التطوير (EMAIL_DEV_MODE) يسجل الإرسال في الصندوق دون SMTP — الواجهة تعلم المستخدم.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json, assertSameOrigin } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { sendMail } from "@/lib/auth/email";
import {
  normalizeRecipientEmail,
  normalizeAdminNotificationSubject,
  normalizeAdminNotificationMessage,
} from "@/lib/notifications/admin-send";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) return json({ ok: false, code: "bad_origin" }, 403);
  const guard = await guardApi(req, "notifications.send");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const email = normalizeRecipientEmail(body.email);
  if (!email) return json({ ok: false, code: "invalid_email" }, 400);

  let subject: string | null;
  let message: string | null;
  try {
    subject = normalizeAdminNotificationSubject(body.subject);
    message = normalizeAdminNotificationMessage(body.message);
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }
  if (!subject || !message) return json({ ok: false, code: "invalid_text" }, 400);

  const recipient = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, status: true },
  });
  if (!recipient) return json({ ok: false, code: "user_not_found" }, 404);
  if (recipient.status === "suspended") return json({ ok: false, code: "user_suspended" }, 409);

  const result = await sendMail({ to: recipient.email, subject, text: message });
  if (result.status === "failed") {
    return json({ ok: false, code: result.error ?? "smtp_delivery_failed" }, 502);
  }

  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.notificationSent,
    entityType: "user",
    entityId: recipient.id,
    details: { to: recipient.email, subject, delivery: result.status },
  });

  return json({ ok: true, delivery: result.status });
}
