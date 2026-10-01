/**
 * منطق أعمال الطلبات والمحادثات — طبقة مشتركة تستخدمها كل المسارات.
 * قواعد الملكية والصلاحية تُفحص هنا في الخادم دائمًا.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fingerprint } from "@/lib/ratelimit";
import type { AuthUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify, notifyMany, staffToNotifyForRequests } from "@/lib/auth/notifications";
import { sendMail } from "@/lib/auth/email";
import { newRequestStaffMail } from "@/lib/auth/email-templates";

export const REQUEST_STATUSES = ["new", "in_review", "awaiting_info", "in_progress", "responded", "closed", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

/** انتقالات الحالات المسموحة ومن يملكها */
export const STATUS_TRANSITIONS: Record<RequestStatus, { to: RequestStatus[]; actor: "staff" | "client" | "any" }[]> = {
  new: [
    { to: ["in_review", "awaiting_info", "in_progress", "cancelled"], actor: "staff" },
    { to: ["cancelled"], actor: "client" },
  ],
  in_review: [
    { to: ["awaiting_info", "in_progress", "responded", "closed", "cancelled"], actor: "staff" },
    { to: ["cancelled"], actor: "client" },
  ],
  awaiting_info: [
    { to: ["in_progress", "responded", "closed", "cancelled"], actor: "staff" },
    { to: ["in_review"], actor: "client" }, // رد العميل يعيدها للمراجعة
    { to: ["cancelled"], actor: "client" },
  ],
  in_progress: [{ to: ["responded", "closed", "cancelled", "awaiting_info"], actor: "staff" }],
  responded: [{ to: ["in_progress", "closed", "awaiting_info", "cancelled"], actor: "staff" }],
  closed: [{ to: ["in_review"], actor: "staff" }], // إعادة فتح للطاقم فقط
  cancelled: [{ to: ["in_review"], actor: "staff" }],
};

export function canTransition(status: string, to: string, actor: "staff" | "client"): boolean {
  if (!REQUEST_STATUSES.includes(status as RequestStatus) || !REQUEST_STATUSES.includes(to as RequestStatus)) return false;
  return (STATUS_TRANSITIONS[status as RequestStatus] ?? []).some(
    (rule) => rule.to.includes(to as RequestStatus) && (rule.actor === "any" || rule.actor === actor)
  );
}

/** وصول العميل لطلبه أو الطاقم بصلاحية — لا مكان لحقول متصفح */
export function canAccessRequest(user: AuthUser, request: { clientId: string | null; assigneeId: string | null }): boolean {
  if (user.roleKey === "super_admin") return true;
  if (user.roleKey === "client") return request.clientId === user.id;
  return can(user, "requests.view.all");
}

/** عرض الطلب للعميل — الملاحظات الداخلية مستبعدة في الخادم */
export async function serializeRequestForClient(id: string) {
  const request = await db.projectRequest.findUnique({
    where: { id },
    include: {
      messages: {
        where: { kind: { not: "internal_note" } }, // استبعاد جوهري في الاستعلام
        orderBy: { createdAt: "asc" },
      },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: "asc" } },
      assignee: { select: { id: true, name: true } },
      claim: { select: { status: true } },
    },
  });
  return request;
}

export async function serializeRequestForStaff(id: string) {
  return db.projectRequest.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, roleKey: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { name: true } } } },
      attachments: true,
      client: { select: { id: true, name: true, email: true, phone: true, company: true, status: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

/** كشف تكرار إرسال الرسالة عند إعادة المحاولة */
export async function isDuplicateMessage(requestId: string, authorId: string | null, bodyHash: string): Promise<boolean> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await db.requestMessage.findFirst({
    where: {
      requestId,
      authorId,
      body: { startsWith: "" },
      createdAt: { gte: fiveMinAgo },
    },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  return recent ? fingerprint(recent.body) === bodyHash : false;
}

/** يرسل رسالة على طلب مع الإشعارات — يعيد كائن الرسالة أو رمز خطأ */
export type SendMessageResult =
  | { ok: true; message: unknown }
  | { ok: false; status: number; code: string };

export async function sendRequestMessage(opts: {
  requestId: string;
  author: AuthUser;
  kind: "message" | "internal_note";
  body: string;
  ip?: string | null;
}): Promise<SendMessageResult> {
  const { requestId, author, kind, body } = opts;
  const trimmed = body.trim().slice(0, 8000);
  if (!trimmed) return { ok: false, status: 400, code: "empty" };

  const request = await db.projectRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false, status: 404, code: "not_found" };
  if (!canAccessRequest(author, request)) return { ok: false, status: 403, code: "forbidden" };

  const isClient = author.roleKey === "client";
  // العميل لا يرسل ملاحظات داخلية، والمحادثة مقفلة بعد الإغلاق/الإلغاء
  if (isClient && kind !== "message") return { ok: false, status: 403, code: "forbidden" };
  if (isClient && (request.status === "closed" || request.status === "cancelled")) {
    return { ok: false, status: 409, code: "locked" };
  }
  if (!isClient && kind === "message" && !can(author, "requests.reply")) return { ok: false, status: 403, code: "forbidden" };
  if (!isClient && kind === "internal_note" && !can(author, "requests.internal_notes")) return { ok: false, status: 403, code: "forbidden" };

  // منع التكرار عند إعادة الإرسال
  if (await isDuplicateMessage(requestId, author.id, fingerprint(trimmed))) {
    const last = await db.requestMessage.findFirst({
      where: { requestId, authorId: author.id },
      orderBy: { createdAt: "desc" },
    });
    if (last) return { ok: true, message: last };
  }

  const isStaffReply = !isClient && kind === "message";

  const message = await db.requestMessage.create({
    data: {
      requestId,
      authorId: author.id,
      authorType: isClient ? "client" : "staff",
      kind,
      body: trimmed,
    },
  });

  const now = new Date();
  await db.projectRequest.update({
    where: { id: requestId },
    data: {
      lastActivityAt: now,
      ...(isClient ? { lastClientReplyAt: now } : {}),
      ...(isStaffReply ? { lastStaffReplyAt: now } : {}),
      // رد العميل على «بانتظار معلومات» يعيدها للمراجعة تلقائيًا
      ...(isClient && request.status === "awaiting_info"
        ? { status: "in_review" }
        : {}),
    },
  });

  // سجل حالة آلي عند رد العميل على طلب معلومات
  if (isClient && request.status === "awaiting_info") {
    await db.requestStatusEvent.create({
      data: { requestId, fromStatus: "awaiting_info", toStatus: "in_review", changedById: author.id },
    });
  }

  await audit({
    actorId: author.id,
    actorEmail: author.email,
    action: kind === "internal_note" ? AUDIT_ACTIONS.requestInternalNote : AUDIT_ACTIONS.requestReplied,
    entityType: "request",
    entityId: requestId,
    details: { kind, requestRef: request.refCode },
    ip: opts.ip,
  });

  // الإشعارات الداخلية — رد من الطاقم يخطر العميل، رد العميل يخطر المسؤول/المسؤولين
  if (kind === "message") {
    if (isStaffReply && request.clientId) {
      await notify({
        userId: request.clientId,
        type: "reply_received",
        payload: { ref: request.refCode },
        link: `/ar/account/requests/${requestId}`,
      });
    } else if (isClient) {
      const targets = request.assigneeId
        ? [{ id: request.assigneeId }]
        : await staffToNotifyForRequests();
      await notifyMany(
        targets.map((t) => ({
          userId: t.id,
          type: "reply_received" as const,
          payload: { ref: request.refCode },
          link: `/ar/admin/requests/${requestId}`,
        }))
      );
    }
  }

  return { ok: true, message };
}

/** إشعارات طلب جديد + بريد الطاقم الاختياري — فشل الإشعار لا يفشل الحفظ */
export async function notifyNewRequest(refCode: string, name: string, requestId: string): Promise<void> {
  const staff = await staffToNotifyForRequests();
  await notifyMany(
    staff.map((s) => ({
      userId: s.id,
      type: "new_request" as const,
      payload: { ref: refCode, name },
      link: `/ar/admin/requests/${requestId}`,
    }))
  );
  // بريد للطاقم وفق إعدادات البريد — حالة الإرسال تُسجل ولا تؤثر على النتيجة
  for (const s of staff) {
    const user = await db.user.findUnique({ where: { id: s.id }, select: { email: true, locale: true } });
    if (user) {
      const mail = newRequestStaffMail(user.locale, { refCode, name });
      await sendMail({ to: user.email, subject: mail.subject, text: mail.text });
    }
  }
}

/** إشعار تغيير حالة للعميل */
export async function notifyStatusChange(requestId: string, to: string): Promise<void> {
  const request = await db.projectRequest.findUnique({ where: { id: requestId }, select: { clientId: true, refCode: true } });
  if (request?.clientId) {
    await notify({
      userId: request.clientId,
      type: to === "awaiting_info" ? "info_requested" : "status_changed",
      payload: { ref: request.refCode, status: to },
      link: `/ar/account/requests/${requestId}`,
    });
  }
}

/** تعليم مقروء بحسب جهة القارئ */
export async function markRead(requestId: string, user: AuthUser): Promise<void> {
  const isClient = user.roleKey === "client";
  await db.projectRequest
    .update({ where: { id: requestId }, data: isClient ? { clientReadAt: new Date() } : { staffReadAt: new Date() } })
    .catch(() => {});
}

/** json موحد */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
