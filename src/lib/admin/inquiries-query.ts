/**
 * منشئ شروط استعلام الاستفسارات الإدارية — مصدر واحد تشترك فيه
 * قائمة `/api/admin/inquiries` وتصدير `/api/admin/inquiries/export`.
 *
 * يدعم «العدادات المحورية» (faceted counts): لكل بُعد تصفية (الحالة،
 * التصنيف، الأرشيف، التعيين) يمكن استثناء ذاك البُعد وحده من الشرط
 * بينما تحترم بقية الأبعاد — فيصبح عدّاد كل حبة «ما ستراه عند نقرها»
 * تحت المرشحات الأخرى، سلوك التنقل المحوري المعتاد في الواجهات.
 */
import type { Prisma } from "@prisma/client";

export const INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded", "closed"] as const;
// «open» مرشّح مركّب من مؤشر اللوحة: كل الحالات غير المغلقة (غير المؤرشفة ضمنًا عبر archivedAt)
export const OPEN_INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded"] as const;

/** أبعاد التصفية القابلة للاستثناء من الشرط */
export type InquiryFacetDimension = "status" | "category" | "archived" | "mine";

export interface InquiryListFilters {
  /** نص البحث — مقصوص ومحول لحالة صغيرة مسبقًا (فارغ = بلا بحث) */
  q: string;
  /** "" | "open" | أحد INQUIRY_STATUSES — الغريب يُهمل بهدوء */
  status: string;
  /** "" | تصنيف — نص غير فارغ يُمرر كما هو */
  category: string;
  /** عرض المؤرشف (archived=1) */
  archived: boolean;
  /** معرّف المسؤول الحالي عند فلتر «مُعيَّن لي» (null = بلا قيد تعيين) */
  mineAssigneeId: string | null;
}

/** شرط البحث النصي المشترك — الموضوع/البريد/الاسم + الرقم المرجعي بحالة كبيرة */
function searchCondition(q: string): Prisma.InquiryWhereInput {
  if (!q) return {};
  return {
    OR: [
      { subject: { contains: q } },
      { email: { contains: q } },
      { name: { contains: q } },
      { refCode: { contains: q.toUpperCase() } },
    ],
  };
}

/** شرط بُعد الحالة — «open» مركّب، وحالة نوعية مسموحة فقط، والبقية تُهمَل */
function statusCondition(status: string): Prisma.InquiryWhereInput {
  if (status === "open") return { status: { in: [...OPEN_INQUIRY_STATUSES] } };
  if (status && (INQUIRY_STATUSES as readonly string[]).includes(status)) return { status };
  return {};
}

/** شرط بُعد التصنيف — نص غير فارغ يُمرر كما هو (قيم التصنيف من قائمة ثابتة بالواجهة) */
function categoryCondition(category: string): Prisma.InquiryWhereInput {
  return category ? { category } : {};
}

/** شرط بُعد الأرشيف — الافتراضي غير المؤرشف دائمًا فلا تتسرب المؤرشفة لفرع الحالة النوعية */
function archivedCondition(archived: boolean): Prisma.InquiryWhereInput {
  return { archivedAt: archived ? { not: null } : null };
}

/** شرط بُعد التعيين «مُعيَّن لي» */
function mineCondition(mineAssigneeId: string | null): Prisma.InquiryWhereInput {
  return mineAssigneeId ? { assigneeId: mineAssigneeId } : {};
}

/**
 * بناء شرط Prisma الكامل أو المحوري لقائمة الاستفسارات.
 * `exclude` يستثني بُعدًا واحدًا (لافتات عدّاد تلك الحبة) ويبقي بقية الأبعاد والبحث.
 */
export function buildInquiryWhere(
  filters: InquiryListFilters,
  options: { exclude?: InquiryFacetDimension } = {}
): Prisma.InquiryWhereInput {
  const { exclude } = options;
  return {
    ...(exclude === "archived" ? {} : archivedCondition(filters.archived)),
    ...(exclude === "status" ? {} : statusCondition(filters.status)),
    ...(exclude === "category" ? {} : categoryCondition(filters.category)),
    ...(exclude === "mine" ? {} : mineCondition(filters.mineAssigneeId)),
    ...searchCondition(filters.q),
  };
}

/** شرط «عدّاد حبة المؤرشف» — يعرض كم مؤرشفًا موجودًا تحت بقية الأبعاد قبل النقر */
export function archivedCountWhere(filters: InquiryListFilters): Prisma.InquiryWhereInput {
  return { ...buildInquiryWhere(filters, { exclude: "archived" }), archivedAt: { not: null } };
}

/** شرط «عدّاد حبة مُعيَّن لي» — كم استفسارًا معيَّنًا للمستخدم تحت بقية الأبعاد قبل التفعيل */
export function mineCountWhere(filters: InquiryListFilters, userId: string): Prisma.InquiryWhereInput {
  return { ...buildInquiryWhere(filters, { exclude: "mine" }), assigneeId: userId };
}

/** جمع صفوف groupBy إلى خريطة قيمة→عدد */
export function groupCountsToMap(groups: Array<{ key: string; count: number }>): Record<string, number> {
  const map: Record<string, number> = {};
  for (const g of groups) map[g.key] = g.count;
  return map;
}
