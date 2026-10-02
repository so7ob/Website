/**
 * سياسة روابط المتابعة — أولوية واضحة وغير قابلة للتجاوز:
 *   1) فرض تسجيل الدخول على مستوى المنصة (يتغلب على كل شيء)
 *   2) استثناء البطاقة المحددة
 *   3) الوضع الافتراضي لنوع البطاقة (طلبات / استفسارات)
 *
 * الوضع الافتراضي عند الترحيل: login_required — يحافظ على اشتراط الحساب القائم
 * حتى يختار المسؤول صراحة تمكين الوصول دون حساب.
 */

export const TRACK_SCOPES = ["request", "inquiry"] as const;
export type TrackScope = (typeof TRACK_SCOPES)[number];

/** أوضاع الوصول الأربعة — انظر جدول المتابعة في التكليف */
export const TRACK_MODES = [
  "login_required", // الدخول مطلوب للاطلاع والرد
  "link_view", // حامل الرابط يطّلع فقط — الرد معطل خادميًا
  "link_reply", // حامل الرابط يطّلع ويرد دون حساب
  "link_view_login_reply", // حامل الرابط يطّلع — الرد بحساب مخوّل فقط
] as const;
export type TrackMode = (typeof TRACK_MODES)[number];

export function isTrackMode(v: unknown): v is TrackMode {
  return typeof v === "string" && (TRACK_MODES as readonly string[]).includes(v);
}

export interface TrackPolicySettings {
  /** فرض تسجيل الدخول للجميع — مفتاح مستقل يتغلب على الأوضاع والاستثناءات */
  forceLogin: boolean;
  requestsMode: TrackMode;
  inquiriesMode: TrackMode;
  /** مدة صلاحية الرابط بالأيام */
  linkTtlDays: number;
  /** السماح بمرفقات رد الزائر عبر الرابط (الرفع بخدمة منفصلة تتحقق من السياسة) */
  allowGuestAttachments: boolean;
}

export const DEFAULT_TRACK_POLICY: TrackPolicySettings = {
  forceLogin: false,
  requestsMode: "login_required",
  inquiriesMode: "login_required",
  linkTtlDays: 90,
  allowGuestAttachments: false,
};

const SETTING_KEYS = {
  forceLogin: "track.forceLogin",
  requestsMode: "track.requestsMode",
  inquiriesMode: "track.inquiriesMode",
  linkTtlDays: "track.linkTtlDays",
  allowGuestAttachments: "track.allowGuestAttachments",
} as const;

/** قراءة الإعدادات من قاعدة البيانات — آمنة أمام القيم التالفة (ترجع الافتراضي) */
export async function getTrackPolicySettings(): Promise<TrackPolicySettings> {
  const { db } = await import("@/lib/db");
  const rows = await db.siteSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const mode = (key: string, fallback: TrackMode): TrackMode =>
    isTrackMode(map.get(key)) ? (map.get(key) as TrackMode) : fallback;
  const ttlRaw = Number.parseInt(map.get(SETTING_KEYS.linkTtlDays) ?? "", 10);
  return {
    forceLogin: map.get(SETTING_KEYS.forceLogin) === "true",
    requestsMode: mode(SETTING_KEYS.requestsMode, DEFAULT_TRACK_POLICY.requestsMode),
    inquiriesMode: mode(SETTING_KEYS.inquiriesMode, DEFAULT_TRACK_POLICY.inquiriesMode),
    linkTtlDays:
      Number.isFinite(ttlRaw) && ttlRaw >= 1 && ttlRaw <= 3650 ? ttlRaw : DEFAULT_TRACK_POLICY.linkTtlDays,
    allowGuestAttachments: map.get(SETTING_KEYS.allowGuestAttachments) === "true",
  };
}

/** مفتاح الإعداد لكل حقل — يُستخدم في مسار الإدارة */
export function trackSettingKey(scope: TrackScope, field: "requestsMode" | "inquiriesMode"): string {
  return scope === "request" ? SETTING_KEYS.requestsMode : SETTING_KEYS.inquiriesMode;
}

/** مصدر السياسة الفعلية — يُعرض في لوحة الإدارة لإزالة غموض الوراثة */
export type TrackPolicySource = "platform_force_login" | "card_exception" | "type_default";

export interface EffectiveTrackPolicy {
  mode: TrackMode;
  source: TrackPolicySource;
  canViewViaLink: boolean; // حامل رابط صالح (بلا حساب) يطّلع؟
  canReplyViaLink: boolean; // حامل رابط صالح (بلا حساب) يرد؟
  canReplyByOwner: boolean; // حساب المالك يرد (ما لم تكن البطاقة مغلقة)
}

/**
 * السياسة الفعلية للبطاقة — تُحسب لحظيًا عند كل عرض/رد/تنزيل،
 * بما يشمل الجلسات المشتقة من رابط سابق.
 */
export function resolveTrackPolicy(
  scope: TrackScope,
  settings: TrackPolicySettings,
  cardException: TrackMode | null
): EffectiveTrackPolicy {
  // 1) فرض الدخول يقطع الطريق على أي وصول مجهول مهما كانت الاستثناءات
  if (settings.forceLogin) {
    return {
      mode: "login_required",
      source: "platform_force_login",
      canViewViaLink: false,
      canReplyViaLink: false,
      canReplyByOwner: true,
    };
  }

  // 2) استثناء البطاقة إن وُجد وصالح
  if (cardException && isTrackMode(cardException)) {
    return {
      mode: cardException,
      source: "card_exception",
      canViewViaLink: cardException !== "login_required",
      canReplyViaLink: cardException === "link_reply",
      canReplyByOwner: true,
    };
  }

  // 3) الافتراضي حسب النوع
  const mode = scope === "request" ? settings.requestsMode : settings.inquiriesMode;
  return {
    mode,
    source: "type_default",
    canViewViaLink: mode !== "login_required",
    canReplyViaLink: mode === "link_reply",
    canReplyByOwner: true,
  };
}

/** حالة البطاقة المادية — الإغلاق يوقف الرد والرفع في كل الأوضاع */
export function isCardClosed(status: string): boolean {
  return status === "closed" || status === "cancelled";
}
