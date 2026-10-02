/**
 * POST /api/account/inquiries/[id]/messages — رد على محادثة استفسار من بوابة العميل.
 * رد العميل يعيد الاستفسار إلى المراجعة (على الفريق النظر مجددًا)، والمغلق لا يقبل ردودًا.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify, notifyMany, staffToNotifyForRequests } from "@/lib/auth/notifications";
import { fingerprint } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;
  const { id } = await params;

  let body: { body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const inquiry = await db.inquiry.findUnique({ where: { id } });

  // 404 لا 403 — حتى لا نكشف وجود السجل لغير أصحابه
  if (!inquiry) return json({ ok: false, code: "not_found" }, 404);
  const owns = user.roleKey === "client" ? inquiry.clientId === user.id : inquiry.assigneeId === user.id;
  if (!owns) return json({ ok: false, code: "not_found" }, 404);

  // الاستفسار المغلق لا يقبل ردودًا — يبدأ العميل استفسارًا جديدًا بدلًا منه
  if (inquiry.status === "closed") return json({ ok: false, code: "closed" }, 400);

  const text = String(body.body ?? "").trim().slice(0, 8000);
  if (!text) return json({ ok: false, code: "empty" }, 400);

  // منع التكرار — نفس بصمة مسار الإدارة (نفس الكاتب خلال 5 دقائق)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await db.inquiryMessage.findFirst({
    where: { inquiryId: id, authorId: user.id, createdAt: { gte: fiveMinAgo } },
    orderBy: { createdAt: "desc" },
  });
  if (recent && fingerprint(recent.body) === fingerprint(text)) {
    return json({ ok: true, message: recent });
  }

  const message = await db.inquiryMessage.create({
    data: { inquiryId: id, authorId: user.id, authorType: "client", kind: "message", body: text },
  });

  // رد العميل يعيد فتح المراجعة — آخر نشاط الآن والحالة قيد المراجعة
  await db.inquiry.update({
    where: { id },
    data: { lastActivityAt: new Date(), status: "in_review" },
  });

  await audit({
    actorId: user.id, actorEmail: user.email, action: AUDIT_ACTIONS.inquiryReplied,
    entityType: "inquiry", entityId: id, details: { side: "client", ref: inquiry.refCode },
  });

  // إشعار المسؤول إن عُيّن، وإلا طاقم الاستقبال — الرابط بلغة الاستفسار
  if (inquiry.assigneeId) {
    await notify({ userId: inquiry.assigneeId, type: "reply_received", payload: { ref: inquiry.refCode }, link: `/${inquiry.locale}/admin/inquiries/${id}` });
  } else {
    const staff = await staffToNotifyForRequests();
    await notifyMany(staff.map((s) => ({ userId: s.id, type: "reply_received", payload: { ref: inquiry.refCode }, link: `/${inquiry.locale}/admin/inquiries/${id}` })));
  }

  return json({ ok: true, message }, 201);
}
