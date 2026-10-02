/**
 * إعدادات الصفحة المؤثرة في الموقع العام — عقد موحد بين المحرر والخادم.
 *
 * فصل المسودة عن المنشور يشمل الآن كل الحقول التي يراها الزوار:
 * الرابط، الظهور، الأدوار، العنوان الظاهر، SEO، والترتيب.
 * الإعدادات مخزنة JSON في عمودي draftSettings / publishedSettings.
 *
 * ملاحظات التوافق:
 * - الصفحات القديمة قبل الترحيل تأتي بـ draftSettings "{}" — الدوال أدناه
 *   ترجع للحقول القديمة كاحتياط حتى أول حفظ/نشر.
 * - العنوان الإداري (titleAr/titleEn أعمدة مستقلة) تبقى داخلية غير علنية؛
 *   تستخدم كاحتياط للعنوان الظاهر عند غيابه في اللقطة المنشورة.
 */

export const PAGE_SETTINGS_KEYS = [
  "slug",
  "visibility",
  "allowedRoles",
  "titleAr",
  "titleEn",
  "seoTitleAr",
  "seoTitleEn",
  "seoDescAr",
  "seoDescEn",
  "order",
] as const;

export interface PageSettings {
  slug: string;
  visibility: string; // public | authenticated | role
  allowedRoles: string[];
  titleAr: string;
  titleEn: string;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescAr: string | null;
  seoDescEn: string | null;
  order: number;
}

/** مصدر خام قابل للتطبيع — من قاعدة البيانات أو من الطلب */
export interface PageSettingsSource {
  slug?: string | null;
  visibility?: string | null;
  allowedRoles?: string | string[] | null; // JSON نصيًا في القاعدة أو مصفوفة من الطلب
  titleAr?: string | null;
  titleEn?: string | null;
  seoTitleAr?: string | null;
  seoTitleEn?: string | null;
  seoDescAr?: string | null;
  seoDescEn?: string | null;
  order?: number | null;
}

const VISIBILITIES = ["public", "authenticated", "role"] as const;

function safeRoles(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(String).slice(0, 10);
}

/** تطبيع كائن خام إلى إعدادات صالحة بقيم احتياطية آمنة */
export function normalizePageSettings(raw: PageSettingsSource, fallbackAdminTitle?: { ar: string; en: string }): PageSettings {
  const visibility = VISIBILITIES.includes((raw.visibility ?? "public") as (typeof VISIBILITIES)[number])
    ? (raw.visibility as string)
    : "public";
  const order = typeof raw.order === "number" && Number.isFinite(raw.order) ? Math.trunc(raw.order) : 0;
  return {
    slug: typeof raw.slug === "string" ? raw.slug : "",
    visibility,
    allowedRoles: safeRoles(raw.allowedRoles),
    titleAr: (typeof raw.titleAr === "string" ? raw.titleAr : "") || fallbackAdminTitle?.ar || "",
    titleEn: (typeof raw.titleEn === "string" ? raw.titleEn : "") || fallbackAdminTitle?.en || "",
    seoTitleAr: typeof raw.seoTitleAr === "string" && raw.seoTitleAr ? raw.seoTitleAr.slice(0, 300) : null,
    seoTitleEn: typeof raw.seoTitleEn === "string" && raw.seoTitleEn ? raw.seoTitleEn.slice(0, 300) : null,
    seoDescAr: typeof raw.seoDescAr === "string" && raw.seoDescAr ? raw.seoDescAr.slice(0, 500) : null,
    seoDescEn: typeof raw.seoDescEn === "string" && raw.seoDescEn ? raw.seoDescEn.slice(0, 500) : null,
    order: Math.max(-1, Math.min(999, order)),
  };
}

/** قراءة إعدادات مخزنة JSON مع الاحتياط للحقول القديمة */
export function parsePageSettings(
  json: string | null | undefined,
  legacy: PageSettingsSource,
  fallbackAdminTitle?: { ar: string; en: string }
): PageSettings {
  if (!json) return normalizePageSettings(legacy, fallbackAdminTitle);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return normalizePageSettings(legacy, fallbackAdminTitle);
  }
  if (typeof parsed !== "object" || parsed === null) return normalizePageSettings(legacy, fallbackAdminTitle);
  const obj = parsed as Record<string, unknown>;
  // "{}" (ترحيل غير مكتمل) → الاحتياط للحقول القديمة
  if (Object.keys(obj).length === 0) return normalizePageSettings(legacy, fallbackAdminTitle);
  return normalizePageSettings(
    {
      slug: typeof obj.slug === "string" ? obj.slug : legacy.slug,
      visibility: typeof obj.visibility === "string" ? obj.visibility : legacy.visibility,
      allowedRoles: safeRoles(obj.allowedRoles ?? legacy.allowedRoles),
      titleAr: typeof obj.titleAr === "string" ? obj.titleAr : legacy.titleAr,
      titleEn: typeof obj.titleEn === "string" ? obj.titleEn : legacy.titleEn,
      seoTitleAr: typeof obj.seoTitleAr === "string" ? obj.seoTitleAr : (legacy.seoTitleAr ?? null),
      seoTitleEn: typeof obj.seoTitleEn === "string" ? obj.seoTitleEn : (legacy.seoTitleEn ?? null),
      seoDescAr: typeof obj.seoDescAr === "string" ? obj.seoDescAr : (legacy.seoDescAr ?? null),
      seoDescEn: typeof obj.seoDescEn === "string" ? obj.seoDescEn : (legacy.seoDescEn ?? null),
      order: typeof obj.order === "number" ? obj.order : legacy.order,
    },
    fallbackAdminTitle
  );
}

export function serializePageSettings(settings: PageSettings): string {
  return JSON.stringify(settings);
}

/** بناء إعدادات مسودة جديدة من حقل نصي وارد من العميل (مع تطبيع صارم) */
export function settingsFromInput(input: unknown): PageSettings | null {
  if (typeof input !== "object" || input === null) return null;
  const obj = input as Record<string, unknown>;
  if (!("visibility" in obj) && !("titleAr" in obj) && !("slug" in obj)) return null;
  return normalizePageSettings({
    slug: typeof obj.slug === "string" ? obj.slug : undefined,
    visibility: typeof obj.visibility === "string" ? obj.visibility : undefined,
    allowedRoles: Array.isArray(obj.allowedRoles) ? obj.allowedRoles : undefined,
    titleAr: typeof obj.titleAr === "string" ? obj.titleAr : undefined,
    titleEn: typeof obj.titleEn === "string" ? obj.titleEn : undefined,
    seoTitleAr: obj.seoTitleAr === null ? null : typeof obj.seoTitleAr === "string" ? obj.seoTitleAr : undefined,
    seoTitleEn: obj.seoTitleEn === null ? null : typeof obj.seoTitleEn === "string" ? obj.seoTitleEn : undefined,
    seoDescAr: obj.seoDescAr === null ? null : typeof obj.seoDescAr === "string" ? obj.seoDescAr : undefined,
    seoDescEn: obj.seoDescEn === null ? null : typeof obj.seoDescEn === "string" ? obj.seoDescEn : undefined,
    order: typeof obj.order === "number" ? obj.order : undefined,
  });
}

/** مؤشر وجود تعديلات غير منشورة — يعمل قبل وبعد أول نشر بالأرقام الجديدة */
export function hasUnpublishedChanges(page: {
  status: string;
  draftUpdatedAt: Date | null;
  publishedAt: Date | null;
  draftRevision: number;
  publishedRevision: number | null;
  draftSettings: string;
  publishedSettings: string | null;
}): boolean {
  if (page.status === "archived") return false;
  if (!page.publishedAt) return false;
  if (page.publishedRevision === null) {
    // صفحات نُشرت قبل الترحيل — المقارنة بالطوابع ثم بالمحتوى الفعلي
    if (page.draftUpdatedAt && page.publishedAt && page.draftUpdatedAt > page.publishedAt) return true;
    return page.draftSettings !== page.publishedSettings;
  }
  return page.draftRevision > page.publishedRevision;
}
