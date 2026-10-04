/**
 * الإشعار البريدي الإداري (الطور 2 — G7): منطق تحقق نقي بلا DB.
 *
 * تحسم صلاحية `notifications.send` المعرفة سلفًا بلا مسار: مسار الإرسال
 * الإداري يستخدم هذه المساعدات للتحقق من المستلم والموضوع والنص قبل لمس
 * قاعدة البيانات أو SMTP — مصدر الحقيقة للخادم، وتعيد الواجهة استخدامه
 * للتحقق المسبق حتى لا تختلف الأحكام بين الطرفين.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** حدود الإشعار الإداري — موحّدة بين الخادم والواجهة */
export const ADMIN_NOTIFICATION_LIMITS = {
  subjectMin: 3,
  subjectMax: 200,
  messageMin: 10,
  messageMax: 5000,
} as const;

/** تطبيع البريد: قص وتوحيد حالة الأحرف — يعيد null للقيم غير النصية */
export function normalizeRecipientEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const cleaned = email.trim().toLowerCase();
  if (cleaned.length === 0 || cleaned.length > 200 || !EMAIL_RE.test(cleaned)) return null;
  return cleaned;
}

/**
 * تطبيع نص إلزامي بحدود: يقص ويحذف الفراغ الطرفي ويرفض القصير جدًا.
 * يرمي TypeError على النوع غير النصي (سوء استخدام برمجي) ويعيد null للفارغ/القصير.
 */
export function normalizeAdminNotificationText(
  value: unknown,
  min: number,
  max: number
): string | null {
  if (typeof value !== "string") throw new TypeError("admin_notification_text_not_string");
  const trimmed = value.trim().slice(0, max + 1);
  if (trimmed.length === 0 || trimmed.length < min) return null;
  return trimmed.slice(0, max);
}

/** تطبيع الموضوع — 3..200 محرفًا */
export function normalizeAdminNotificationSubject(value: unknown): string | null {
  return normalizeAdminNotificationText(value, ADMIN_NOTIFICATION_LIMITS.subjectMin, ADMIN_NOTIFICATION_LIMITS.subjectMax);
}

/** تطبيع نص الإشعار — 10..5000 محرفًا */
export function normalizeAdminNotificationMessage(value: unknown): string | null {
  return normalizeAdminNotificationText(value, ADMIN_NOTIFICATION_LIMITS.messageMin, ADMIN_NOTIFICATION_LIMITS.messageMax);
}
