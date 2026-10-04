/**
 * عقد تطبيع إعدادات الصفحة — ريجريشن bug sitemap الفارغ (جولة 50).
 *
 * الـ bug: الفرع الشرطي في normalizePageSettings كان يفحص
 * (raw.visibility ?? "public") ثم يرد raw.visibility الخام —
 * ففي غياب visibility يعيد undefined بدل "public"، وكان ذلك
 * يقصّ كل الصفحات ذات publishedSettings=null من خريطة الموقع.
 */
import { describe, expect, it } from "vitest";
import { normalizePageSettings, parsePageSettings } from "@/lib/page-settings";

describe("normalizePageSettings — عقد visibility", () => {
  it("legacy بلا حقل visibility → public (ريجريشن sitemap الفارغ)", () => {
    // كائن مطابق لما كان select في sitemap.ts يجلبه (بلا visibility)
    const legacy = {
      slug: "",
      isHome: true,
      order: 0,
      publishedAt: new Date(),
      publishedBlocksAr: "[]",
      publishedBlocksEn: null,
    };
    const settings = normalizePageSettings(legacy as never);
    expect(settings.visibility).toBe("public");
  });

  it("visibility=null → public", () => {
    const settings = normalizePageSettings({ slug: "x", visibility: null });
    expect(settings.visibility).toBe("public");
  });

  it("visibility=authenticated → authenticated (قيمة مدققة تُحترم)", () => {
    const settings = normalizePageSettings({ slug: "x", visibility: "authenticated" });
    expect(settings.visibility).toBe("authenticated");
  });

  it("visibility=role → role", () => {
    const settings = normalizePageSettings({ slug: "x", visibility: "role", allowedRoles: ["client"] });
    expect(settings.visibility).toBe("role");
  });

  it("قيمة غريبة → public (أمان القيم غير المعروفة)", () => {
    const settings = normalizePageSettings({ slug: "x", visibility: "weird" });
    expect(settings.visibility).toBe("public");
  });

  it("publishedSettings=null → parse يعيد public من الحقول المباشرة", () => {
    const settings = parsePageSettings(
      null,
      { slug: "about", visibility: "public", titleAr: "عنوان" } as never,
    );
    expect(settings.visibility).toBe("public");
  });

  it("publishedSettings بلا مفتاح visibility → fallback للحقول المباشرة", () => {
    const settings = parsePageSettings(
      JSON.stringify({ titleAr: "ظاهر", order: 3 }),
      { slug: "about", visibility: "public", titleAr: "إداري" } as never,
    );
    expect(settings.visibility).toBe("public");
    expect(settings.titleAr).toBe("ظاهر");
  });

  it("publishedSettings '{}' (ترحيل غير مكتمل) → fallback كامل", () => {
    const settings = parsePageSettings(
      "{}",
      { slug: "about", visibility: "public" } as never,
    );
    expect(settings.visibility).toBe("public");
  });
});
