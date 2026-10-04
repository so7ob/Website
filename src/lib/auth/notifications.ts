/**
 * الإشعارات داخل المنصة — تُخزن بنوع + معاملات وتُترجم عند العرض حسب لغة المستخدم.
 * إشعار البريد خيار منفصل: نجاح الحفظ/الرد لا يتأثر بفشل إشعار البريد.
 */
import { db } from "@/lib/db";

export const NOTIFICATION_TYPES = [
  "new_request", // وصول طلب جديد
  "new_inquiry", // وصول استفسار جديد
  "request_assigned", // تعيين طلب إليك
  "reply_received", // وصول رد على طلب تتابعه
  "info_requested", // طلب معلومات إضافية
  "status_changed", // تغيير حالة مهمة
  "content_published", // نشر محتوى/تغييره
  "content_schedule", // جدولة نشر أو نتيجتها (تنفيذ/إسقاط)
  "account", // شؤون الحساب
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  payload?: Record<string, string>;
  link?: string;
}

/** ينشئ إشعارًا داخليًا — لا يفشل العملية الأساسية أبدًا */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: JSON.stringify(input.payload ?? {}),
        link: input.link ?? null,
      },
    });
  } catch (error) {
    console.error("[notify] فشل إنشاء الإشعار:", error);
  }
}

/** إشعارات عدة دفعة واحدة */
export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (!inputs.length) return;
  try {
    await db.notification.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        type: input.type,
        payload: JSON.stringify(input.payload ?? {}),
        link: input.link ?? null,
      })),
    });
  } catch (error) {
    console.error("[notify] فشل إنشاء الإشعارات:", error);
  }
}

/** موظفو استقبال الطلبات — من يملك صلاحية الرد أو التعيين */
export async function staffToNotifyForRequests(): Promise<{ id: string }[]> {
  return db.user.findMany({
    where: {
      status: "active",
      roleKey: { in: ["super_admin", "ops_manager", "support"] },
    },
    select: { id: true },
  });
}

/**
 * الناشرون المؤهلون للمراجعة — كل مستخدم نشط تصادف أدواره صلاحية pages.publish
 * (تُقرأ من أدوار قاعدة البيانات الفعلية لا من قائمة ثابتة — الأدوار قابلة للتحرير من الإدارة).
 * super_admin يُدرج دائمًا بوصفه صاحب كل الصلاحيات.
 */
export async function publishersToNotify(): Promise<{ id: string; locale: string }[]> {
  const roles = await db.role.findMany({ select: { key: true, permissions: true } });
  const publisherKeys = new Set<string>(["super_admin"]);
  for (const role of roles) {
    try {
      const parsed: unknown = JSON.parse(role.permissions);
      if (Array.isArray(parsed) && parsed.includes("pages.publish")) publisherKeys.add(role.key);
    } catch {
      // أدوار بصلاحيات فاسدة تُتجاهل بصمت — لا تعطل الإشعارات
    }
  }
  return db.user.findMany({
    where: { status: "active", roleKey: { in: [...publisherKeys] } },
    select: { id: true, locale: true },
  });
}
