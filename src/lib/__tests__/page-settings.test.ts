import { describe, expect, it } from "vitest";
import { hasUnpublishedChanges, normalizePageSettings, parsePageSettings, serializePageSettings } from "@/lib/page-settings";

describe("page-settings", () => {
  const base = normalizePageSettings({
    slug: "about",
    visibility: "public",
    allowedRoles: "[]",
    titleAr: "من نحن",
    titleEn: "About",
    seoTitleAr: "من نحن | سُحُب",
    seoTitleEn: "About | so7ob",
    seoDescAr: null,
    seoDescEn: null,
    order: 3,
  });

  it("يطبع الإعدادات الخام بقيم احتياطية آمنة", () => {
    expect(base.slug).toBe("about");
    expect(base.visibility).toBe("public");
    expect(base.allowedRoles).toEqual([]);
    expect(base.order).toBe(3);
  });

  it("يرفض ظهورًا غير معروف ويعود لـpublic", () => {
    const weird = normalizePageSettings({ ...base, visibility: "hacked" });
    expect(weird.visibility).toBe("public");
  });

  it("يقصّ الأدوار إلى 10 ويتقبل المصفوفة أو JSON", () => {
    const arr = normalizePageSettings({ ...base, allowedRoles: Array(15).fill("x") });
    expect(arr.allowedRoles).toHaveLength(10);
    const json = normalizePageSettings({ ...base, allowedRoles: '["ops_manager"]' });
    expect(json.allowedRoles).toEqual(["ops_manager"]);
  });

  it("يقرأ الإعدادات المخزنة ويسقط المفاتيح غير المعروفة", () => {
    const stored = serializePageSettings({ ...base, order: 7 });
    const evil = JSON.stringify({ ...JSON.parse(stored), __proto__: { hacked: true }, order: 9, unknown: "x" });
    const parsed = parsePageSettings(evil, { slug: "old" });
    expect(parsed.order).toBe(9);
    expect((parsed as unknown as Record<string, unknown>).unknown).toBeUndefined();
  });

  it("يعود للحقول القديمة عند JSON فارغ أو تالف", () => {
    const legacy = { slug: "contact", visibility: "public", titleAr: "تواصل", titleEn: "Contact" };
    expect(parsePageSettings("{}", legacy).slug).toBe("contact");
    expect(parsePageSettings("not-json{", legacy).slug).toBe("contact");
    expect(parsePageSettings(null, legacy).titleAr).toBe("تواصل");
  });

  describe("hasUnpublishedChanges", () => {
    const page = {
      status: "published",
      draftUpdatedAt: new Date("2026-01-01T00:00:00Z"),
      publishedAt: new Date("2026-01-02T00:00:00Z"),
      draftRevision: 5,
      publishedRevision: 5 as number | null,
      draftSettings: serializePageSettings(base),
      publishedSettings: serializePageSettings(base),
    };

    it("لا مؤشر عند تطابق المراجعات", () => {
      expect(hasUnpublishedChanges(page)).toBe(false);
    });

    it("يشير عند مراجعة مسودة أحدث", () => {
      expect(hasUnpublishedChanges({ ...page, draftRevision: 6 })).toBe(true);
    });

    it("صفحات ما قبل الترحيل تقارن بالطوابع ثم بالمحتوى", () => {
      const legacy = { ...page, publishedRevision: null };
      expect(hasUnpublishedChanges(legacy)).toBe(false);
      expect(hasUnpublishedChanges({ ...legacy, draftUpdatedAt: new Date("2026-01-03T00:00:00Z") })).toBe(true);
      // طوابع متطابقة لكن إعدادات المسودة تغيرت
      const changed = { ...legacy, draftSettings: serializePageSettings({ ...base, titleAr: "عنوان جديد" }) };
      expect(hasUnpublishedChanges(changed)).toBe(true);
    });

    it("الأرشفة دائمًا بلا تعديلات معلقة", () => {
      expect(hasUnpublishedChanges({ ...page, status: "archived", draftRevision: 9 })).toBe(false);
    });

    it("صفحة لم تنشر قط: لا مؤشر", () => {
      expect(hasUnpublishedChanges({ ...page, publishedAt: null, publishedRevision: null, status: "draft" })).toBe(false);
    });
  });
});
