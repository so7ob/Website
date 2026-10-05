/**
 * اختبارات منشئ شروط استعلام الاستفسارات — العدادات المحورية والاستثناء
 * (buildInquiryWhere/archivedCountWhere/mineCountWhere) بنمط المخططات النقي
 * بلا قاعدة بيانات.
 */
import { describe, expect, it } from "vitest";
import {
  buildInquiryWhere,
  archivedCountWhere,
  mineCountWhere,
  groupCountsToMap,
  INQUIRY_STATUSES,
  OPEN_INQUIRY_STATUSES,
  type InquiryListFilters,
} from "../admin/inquiries-query";

const BASE: InquiryListFilters = {
  q: "",
  status: "",
  category: "",
  archived: false,
  mineAssigneeId: null,
};

describe("buildInquiryWhere — الشرط الكامل", () => {
  it("الافتراضي: غير المؤرشف دائمًا وبلا قيود أخرى", () => {
    expect(buildInquiryWhere(BASE)).toEqual({ archivedAt: null });
  });

  it("حالة نوعية صالحة تتحول لقيد مساواة", () => {
    expect(buildInquiryWhere({ ...BASE, status: "new" })).toEqual({ archivedAt: null, status: "new" });
  });

  it("«open» مرشّح مركّب بقائمة الحالات المفتوحة", () => {
    const where = buildInquiryWhere({ ...BASE, status: "open" });
    expect(where.status).toEqual({ in: [...OPEN_INQUIRY_STATUSES] });
  });

  it("حالة غير معروفة تُهمَل بهدوء (بلا قيد حالة)", () => {
    const where = buildInquiryWhere({ ...BASE, status: "hacked'; --" });
    expect(where).toEqual({ archivedAt: null });
    expect("status" in where).toBe(false);
  });

  it("التصنيف يُمرر كما هو عند وجوده", () => {
    expect(buildInquiryWhere({ ...BASE, category: "pricing" })).toEqual({ archivedAt: null, category: "pricing" });
  });

  it("البحث يصنع شرط OR ويتضمن الرقم المرجعي بحالة كبيرة", () => {
    const where = buildInquiryWhere({ ...BASE, q: "faq-10" });
    const or = where.OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(4);
    expect(or).toContainEqual({ refCode: { contains: "FAQ-10" } });
  });

  it("archived=1 يعيد المؤرشف فقط ويتراكب مع بقية الأبعاد", () => {
    const where = buildInquiryWhere({ ...BASE, archived: true, status: "closed" });
    expect(where.archivedAt).toEqual({ not: null });
    expect(where.status).toBe("closed");
  });

  it("«مُعيَّن لي» يقيّد assigneeId", () => {
    expect(buildInquiryWhere({ ...BASE, mineAssigneeId: "u-1" })).toEqual({ archivedAt: null, assigneeId: "u-1" });
  });

  it("كل الأبعاد مجتمعة تتراكب في شرط واحد", () => {
    const where = buildInquiryWhere({
      q: "فاتورة",
      status: "in_review",
      category: "support",
      archived: false,
      mineAssigneeId: "u-9",
    });
    expect(where).toEqual({
      archivedAt: null,
      status: "in_review",
      category: "support",
      assigneeId: "u-9",
      OR: expect.any(Array),
    });
  });
});

describe("buildInquiryWhere — الاستثناء المحوري", () => {
  const FULL: InquiryListFilters = {
    q: "faq",
    status: "open",
    category: "general",
    archived: false,
    mineAssigneeId: "u-1",
  };

  it("استثناء الحالة يبقي بقية الأبعاد والبحث", () => {
    const where = buildInquiryWhere(FULL, { exclude: "status" });
    expect("status" in where).toBe(false);
    expect(where.category).toBe("general");
    expect(where.assigneeId).toBe("u-1");
    expect(where.archivedAt).toBeNull();
    expect(where.OR).toBeDefined();
  });

  it("استثناء التصنيف يبقي الحالة المركّبة", () => {
    const where = buildInquiryWhere(FULL, { exclude: "category" });
    expect("category" in where).toBe(false);
    expect(where.status).toEqual({ in: [...OPEN_INQUIRY_STATUSES] });
  });

  it("استثناء الأرشيف يزيل archivedAt فقط", () => {
    const where = buildInquiryWhere({ ...FULL, archived: true }, { exclude: "archived" });
    expect("archivedAt" in where).toBe(false);
    expect(where.status).toEqual({ in: [...OPEN_INQUIRY_STATUSES] });
  });

  it("استثناء التعيين يزيل assigneeId فقط", () => {
    const where = buildInquiryWhere(FULL, { exclude: "mine" });
    expect("assigneeId" in where).toBe(false);
    expect(where.status).toEqual({ in: [...OPEN_INQUIRY_STATUSES] });
  });
});

describe("عدّادات الحبوب الجاهزة", () => {
  it("archivedCountWhere يجبر المؤرشف تحت بقية الأبعاد", () => {
    const where = archivedCountWhere({ ...BASE, status: "new", archived: false });
    expect(where.archivedAt).toEqual({ not: null });
    expect(where.status).toBe("new");
  });

  it("mineCountWhere يجبر التعيين للمستخدم تحت بقية الأبعاد", () => {
    const where = mineCountWhere({ ...BASE, category: "pricing" }, "u-7");
    expect(where.assigneeId).toBe("u-7");
    expect(where.category).toBe("pricing");
    expect(where.archivedAt).toBeNull();
  });

  it("groupCountsToMap يجمع الصفوف إلى خريطة", () => {
    expect(groupCountsToMap([{ key: "new", count: 3 }, { key: "closed", count: 1 }])).toEqual({ new: 3, closed: 1 });
  });
});

describe("ثوابت الحالات", () => {
  it("الحالات المفتوحة مجموعة جزئية من كل الحالات وبلا «closed»", () => {
    for (const s of OPEN_INQUIRY_STATUSES) expect(INQUIRY_STATUSES).toContain(s);
    expect(INQUIRY_STATUSES).toContain("closed");
    expect(OPEN_INQUIRY_STATUSES).not.toContain("closed");
  });
});
