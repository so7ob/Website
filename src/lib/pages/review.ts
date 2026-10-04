/**
 * دورة المراجعة (الطور 2 — G5): منطق انتقالات الحالة `in_review` — نقي بلا DB.
 *
 * الدورة:
 * - محرر (pages.edit) يرسل المسودة للمراجعة → status = "in_review" (يُقفل الحفظ الآلي).
 * - ناشر (pages.publish) يوافق → النشر عبر publishPageCore، أو يرفض → status = "draft".
 *
 * القواعد هنا هي مصدر الحقيقة الوحيد — تستخدمها المسارات (API) والواجهة معًا
 * حتى لا يختلف الحكم بين الخادم والمتصفح.
 */

export type PageStatus = "draft" | "in_review" | "published" | "archived";
export type ReviewDecision = "approve" | "reject";

/** أقصى طول لملاحظة المراجعة — القص هنا آمن ويطابق حد التفاصيل في التدقيق */
export const REVIEW_NOTE_MAX = 500;

/**
 * هل يجوز إرسال الصفحة للمراجعة من حالتها الحالية؟
 * - draft: المسودة الجاهزة للفحص.
 * - published: صفحة منشورة فيها تعديلات غير منشورة — المراجعة تغطي التعديلات.
 * - in_review: قيد المراجعة أصلًا (لا إرسال مزدوج) → ممنوع.
 * - archived: مؤرشفة → ممنوع دائمًا.
 */
export function canSubmitForReview(status: string): boolean {
  return status === "draft" || status === "published";
}

/** هل يجوز اتخاذ قرار مراجعة (موافقة/رفض) من الحالة الحالية؟ — قيد المراجعة فقط */
export function canReviewDecision(status: string): boolean {
  return status === "in_review";
}

/** هل الحفظ الآلي مقفول؟ — أثناء المراجعة لا يُلمس شيء حتى لا يتغير ما يُراجَع */
export function isSaveLocked(status: string): boolean {
  return status === "in_review";
}

/**
 * تطبيع ملاحظة المراجعة: نص اختياري، يُقصّ، الفراغ يعيد null.
 * ترمي TypeError على النوع غير النصي (سوء استخدام برمجي وليس إدخال مستخدم).
 */
export function normalizeReviewNote(note: unknown): string | null {
  if (note === undefined || note === null) return null;
  if (typeof note !== "string") throw new TypeError("review_note_not_string");
  const trimmed = note.trim().slice(0, REVIEW_NOTE_MAX);
  return trimmed.length > 0 ? trimmed : null;
}

/** معاملات إشعار المراجعة الموحدة — تُترجم عند العرض بلغة المستخدم */
export interface ReviewNotificationPayload {
  pageTitle: string;
  slug: string;
  decision: "submitted" | "approved" | "rejected";
  by?: string;
  note?: string;
}
