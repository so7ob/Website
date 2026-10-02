/**
 * بريد روابط المتابعة — تسليم الرابط عند الإصدار/التجديد وإشعار العميل برد الفريق.
 *
 * الضمانات:
 * - كل عمليات البريد هنا best-effort: أي فشل لا يفسد نجاح العملية الأساسية أبدًا.
 * - الرمز الخام يظهر في نص الرسالة فقط (لا يُخزن ولا يُدوَّن في التدقيق).
 * - رابط الإشعار بعد رد الفريق لا يُحيي رابطًا ملغى أبدًا:
 *     • لمالك الحساب: بطاقة المتابعة عبر ?card= (تتطلب جلسة حساب المالك).
 *     • للزائر: صفحة المتابعة العامة لاستخدام رابطه المحفوظ — إن أُلغي فلا وصول جديد.
 * - الإشعار يُرسل إلى بريد البطاقة حتى بلا clientId (متطلب §9).
 */

import { db } from "@/lib/db";
import { sendMail, absoluteUrl } from "@/lib/auth/email";
import { staffReplyMail, trackLinkMail } from "@/lib/auth/email-templates";
import type { TrackScope } from "./policy";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** إرسال رابط المتابعة لصاحب البطاقة — best-effort بلا أي أثر على نجاح العملية */
export async function emailTrackLink(opts: {
  scope: TrackScope;
  to: string | null | undefined;
  locale: string;
  token: string;
  refCode: string;
  expiresInDays: number;
}): Promise<void> {
  try {
    const to = (opts.to ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return;
    const url = absoluteUrl(`/${opts.locale}/track?t=${encodeURIComponent(opts.token)}`);
    const mail = trackLinkMail(opts.locale, { url, refCode: opts.refCode, expiresInDays: opts.expiresInDays });
    const result = await sendMail({ to, subject: mail.subject, text: mail.text });
    console.info(`[track:mail] تسليم رابط ${opts.scope}:${opts.refCode} إلى ${to} — ${result.status}`);
  } catch (error) {
    console.error("[track:mail] فشل تسليم رابط المتابعة (غير مؤثر):", error);
  }
}

/**
 * إشعار العميل برد جديد من الفريق — حتى بلا حساب مرتبط (متطلب §9).
 * الرابط الآمن: مالك الحساب → ?card= (جلسة المالك)؛ زائر → صفحة المتابعة العامة.
 * لا يُرسل مقتطفًا أطول من 240 حرفًا ولا يحتوي ملاحظات داخلية أبدًا (الاستدعاء من مسار الرد العلني فقط).
 */
export async function emailStaffReply(opts: {
  scope: TrackScope;
  cardId: string;
  to: string | null | undefined;
  locale: string;
  refCode: string;
  replyPreview?: string;
  /** هل البطاقة مرتبطة بحساب؟ عندئذ يكفي رابط ?card= الآمن */
  hasAccount: boolean;
}): Promise<void> {
  try {
    const to = (opts.to ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return;
    const url = opts.hasAccount
      ? absoluteUrl(`/${opts.locale}/track?card=${opts.scope}:${opts.cardId}`)
      : absoluteUrl(`/${opts.locale}/track`);
    const preview = (opts.replyPreview ?? "").trim().slice(0, 240) || undefined;
    const mail = staffReplyMail(opts.locale, { refCode: opts.refCode, url, preview });
    const result = await sendMail({ to, subject: mail.subject, text: mail.text });
    console.info(`[track:mail] إشعار رد ${opts.scope}:${opts.refCode} إلى ${to} — ${result.status}`);
  } catch (error) {
    console.error("[track:mail] فشل إشعار العميل بالرد (غير مؤثر):", error);
  }
}

/** بريد البطاقة ولغتها — يُستخدم عند التجديد والإشعارات */
export async function cardContact(
  scope: TrackScope,
  cardId: string
): Promise<{ email: string | null; locale: string; refCode: string; clientId: string | null } | null> {
  if (scope === "request") {
    const row = await db.projectRequest.findUnique({
      where: { id: cardId },
      select: { email: true, locale: true, refCode: true, clientId: true },
    });
    return row ?? null;
  }
  const row = await db.inquiry.findUnique({
    where: { id: cardId },
    select: { email: true, locale: true, refCode: true, clientId: true },
  });
  return row ?? null;
}
