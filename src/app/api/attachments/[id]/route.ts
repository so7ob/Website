/**
 * GET /api/attachments/[id] — تنزيل مرفق خاص بعد فحص الصلاحية في الخادم.
 *
 * قنوات الوصول الثلاث (تُقيَّم لحظيًا):
 * 1) جلسة حساب: طاقم مخوّل / مالك البطاقة / الرافع نفسه للمرفقات العامة.
 * 2) حامل رابط متابعة صالح (جلسة كوكي موقّعة) بشرط:
 *    - السياسة الحالية تسمح بالاطلاع عبر الرابط (تُحسب الآن لا وقت الإنشاء)
 *    - الرابط غير ملغى وغير منتهٍ وينتمي لنفس بطاقة المرفق
 *    - المرفق على رسالة علنية — الملاحظات الداخلية لا تُسرَّب أبدًا
 * 3) لا قناة → 401 للزائر و403 للحساب غير المخوّل (كما كان سابقًا).
 *
 * كل الردود هنا: private,no-store + noindex + no-referrer عند النجاح.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { canAccessRequest } from "@/lib/requests-service";
import { canAccessInquiry } from "@/lib/auth/resource-access";
import { readFileBuffer } from "@/lib/file-storage";
import { TRACK_COOKIE_NAME, verifyTrackSessionValue } from "@/lib/track/session";
import { getTrackPolicySettings, isTrackMode, resolveTrackPolicy, type TrackScope } from "@/lib/track/policy";
import { AUDIT_ACTIONS, audit } from "@/lib/auth/audit";

/** رفض موحّد بترويسات noindex/no-store حتى للأخطاء */
function deny(status: 401 | 403 | 404): NextResponse {
  const res = new NextResponse(status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Not found", { status });
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

/** تنزيل ناجح مع ترويسات أمان كاملة */
function serve(buffer: Buffer, filename: string, mimeType: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/** نوع رسالة المرفق — مرجع منطقي عبر messageId (لا علاقة Prisma) — null إن لم يوجد */
async function messageKind(messageId: string | null): Promise<string | null> {
  if (!messageId) return null;
  const rm = await db.requestMessage.findUnique({ where: { id: messageId }, select: { kind: true } });
  if (rm) return rm.kind;
  const im = await db.inquiryMessage.findUnique({ where: { id: messageId }, select: { kind: true } });
  return im?.kind ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]{1,40}$/.test(id)) return deny(404);

  // فحص الجلسة أولًا — الحساب الموقوف يُرفض 401 قبل أي استعلام مرفق (إصلاح #16)
  const user = await getAuthUser();
  if (user && user.status === "suspended") return deny(401);

  const attachment = await db.attachment.findUnique({
    where: { id },
    include: {
      request: { select: { id: true, clientId: true } },
      inquiry: { select: { id: true, clientId: true } },
    },
  });
  if (!attachment) return deny(404);

  const scope: TrackScope | null = attachment.request ? "request" : attachment.inquiry ? "inquiry" : null;
  const cardId = attachment.request?.id ?? attachment.inquiry?.id ?? null;
  const cardClientId = attachment.request?.clientId ?? attachment.inquiry?.clientId ?? null;

  // ——— القناة 1: جلسة حساب ———
  if (user) {
    let allowed = false;
    if (scope === "request" && attachment.request) {
      // طلب: نفس قواعد الوصول للطلب (super_admin / المالك / المعيّن / الطاقم المخوّل)
      const full = await db.projectRequest.findUnique({
        where: { id: attachment.request.id },
        select: { clientId: true, assigneeId: true },
      });
      allowed = Boolean(full && canAccessRequest(user, full));
    } else if (scope === "inquiry" && attachment.inquiry) {
      // استفسار: نفس منطق canAccessInquiry (المالك أو صلاحية الاطلاع الشاملة) — إصلاح #16
      // ملاحظة: لا استثناء للرافع هنا — أقل صلاحية ممكنة للمرفقات داخل الاستفسارات
      allowed = canAccessInquiry(user, attachment.inquiry);
    } else {
      // مرفق بلا بطاقة (وسائط عامة) — الرافع نفسه فقط
      allowed = attachment.uploaderId === user.id;
    }
    if (!allowed) return deny(403);
    const buffer = readFileBuffer(attachment.storedName);
    if (!buffer) return deny(404);
    return serve(buffer, attachment.filename, attachment.mimeType);
  }

  // ——— القناة 2: حامل رابط متابعة (بلا حساب) ———
  const sessionLinkId = verifyTrackSessionValue(req.cookies.get(TRACK_COOKIE_NAME)?.value);
  if (sessionLinkId && scope && cardId) {
    const link = await db.trackLink.findUnique({ where: { id: sessionLinkId } });
    const linkMatchesCard = Boolean(
      link &&
        !link.revokedAt &&
        link.expiresAt.getTime() > Date.now() &&
        link.scope === scope &&
        (scope === "request" ? link.requestId === cardId : link.inquiryId === cardId)
    );
    if (link && linkMatchesCard) {
      // السياسة الحالية — تُحسب لحظيًا حتى للجلسات المشتقة من رابط سابق
      const [settings, exceptionRow] = await Promise.all([
        getTrackPolicySettings(),
        db.siteSetting.findUnique({ where: { key: `track.exception.${scope}.${cardId}` }, select: { value: true } }),
      ]);
      const exception = exceptionRow && isTrackMode(exceptionRow.value) ? exceptionRow.value : null;
      const policy = resolveTrackPolicy(scope, settings, exception);

      // بوابة السياسة: الاطلاع عبر الرابط مطلوب + المرفق على رسالة علنية فقط
      const kind = await messageKind(attachment.messageId);
      const isPublicMessage = attachment.messageId ? kind !== null && kind !== "internal_note" : false;
      if (policy.canViewViaLink && isPublicMessage) {
        const buffer = readFileBuffer(attachment.storedName);
        if (!buffer) return deny(404);
        audit({
          actorId: null,
          actorEmail: null,
          action: AUDIT_ACTIONS.trackAttachmentDownloaded,
          entityType: scope,
          entityId: cardId,
          details: { linkId: link.id, attachmentId: attachment.id, via: "track_link" },
        }).catch(() => {});
        return serve(buffer, attachment.filename, attachment.mimeType);
      }
      // سياسة تمنع أو مرفق داخلي/يتيم — رفض صامت بلا تفاصيل
      return deny(403);
    }
  }

  // ——— لا قناة وصول ———
  return deny(401);
}
