/**
 * اختبارات جولة 34 (§D):
 * - arabicCountPhrase: تصريف العدد العربي (مفرد/مثنى/جمع/مفرد منصوب) + الإنجليزية البديلة
 * - parseUpdateTemplateInput: دلالات التحديث (فارغ يُبقي، حاضر فارغ للوصف يمسح، لا تغيير يُرفض)
 */
import { describe, expect, it } from "vitest";
import { arabicCountPhrase } from "@/lib/i18n/ar-plural";
import { parseUpdateTemplateInput } from "@/lib/templates/service";

const AR_FORMS = { one: "مرة واحدة", two: "مرتين", few: "{n} مرات", many: "{n} مرة" };
const EN_FORMS = { one: "Used once", two: "Used twice", few: "Used {n} times", many: "Used {n} times" };

describe("arabicCountPhrase — تصريف العدد العربي", () => {
  it("المفرد للعدد 1 (بلا رقم في الصيغة)", () => {
    expect(arabicCountPhrase(1, AR_FORMS)).toBe("مرة واحدة");
  });

  it("المثنى للعدد 2", () => {
    expect(arabicCountPhrase(2, AR_FORMS)).toBe("مرتين");
  });

  it("الجمع لـ 3–10 مع استبدال {n}", () => {
    expect(arabicCountPhrase(3, AR_FORMS)).toBe("3 مرات");
    expect(arabicCountPhrase(7, AR_FORMS)).toBe("7 مرات");
    expect(arabicCountPhrase(10, AR_FORMS)).toBe("10 مرات");
  });

  it("المفرد المنصوب لـ 11–99", () => {
    expect(arabicCountPhrase(11, AR_FORMS)).toBe("11 مرة");
    expect(arabicCountPhrase(25, AR_FORMS)).toBe("25 مرة");
    expect(arabicCountPhrase(99, AR_FORMS)).toBe("99 مرة");
  });

  it("المئات تعود إلى صيغة many (جمع بعد مئة وفق الصيغة المعطاة)", () => {
    expect(arabicCountPhrase(100, AR_FORMS)).toBe("100 مرة");
    expect(arabicCountPhrase(120, AR_FORMS)).toBe("120 مرة");
  });

  it("الصفر يُعامل جمعًا", () => {
    expect(arabicCountPhrase(0, AR_FORMS)).toBe("0 مرات");
  });

  it("السالب والأعداد غير النهائية آمنة", () => {
    expect(arabicCountPhrase(-3, AR_FORMS)).toBe("-3 مرات");
    expect(arabicCountPhrase(Number.NaN, AR_FORMS)).toBe("0 مرة"); // غير النهائي → 0 آمن
    expect(arabicCountPhrase(1.7, AR_FORMS)).toBe("مرة واحدة"); // يقتطع لا يقرّب — 1.7 → 1 مفرد
  });

  it("الصيغ بلا {n} آمنة لكل الأعداد", () => {
    expect(arabicCountPhrase(15, { one: "واحدة", two: "اثنتان", few: "قليل", many: "كثير" })).toBe("كثير");
  });

  it("الاستخدام الإنجليزي عبر المسار الثنائي (لا حاجة للتصريف العربي)", () => {
    expect(arabicCountPhrase(1, EN_FORMS)).toBe("Used once");
    expect(arabicCountPhrase(2, EN_FORMS)).toBe("Used twice");
    expect(arabicCountPhrase(9, EN_FORMS)).toBe("Used {n} times".replace("{n}", "9"));
  });

  it("fallback يُستخدم للأعداد غير النهائية فقط — العدد السليم يمر عبر الصيغ", () => {
    expect(arabicCountPhrase(5, { one: "a", two: "b", few: "c", many: "d" }, "n items")).toBe("c");
    expect(arabicCountPhrase(Number.NaN, { one: "a", two: "b", few: "c", many: "d" }, "n items")).toBe("n items");
  });
});

describe("parseUpdateTemplateInput — دلالات تحديث بيانات القالب", () => {
  const current = { nameAr: "اسم قديم", nameEn: "Old name", descAr: "وصف قديم", descEn: "Old desc" };

  it("لا حقول → nothing_to_update", () => {
    expect(parseUpdateTemplateInput({}, current)).toEqual({ ok: false, error: "nothing_to_update" });
  });

  it("نفس القيم تمامًا → nothing_to_update", () => {
    expect(parseUpdateTemplateInput({ ...current }, current)).toEqual({ ok: false, error: "nothing_to_update" });
  });

  it("فارغ الاسم يُبقي الحالي ويرفض nothing_to_update إن لم يتغير شيء آخر", () => {
    const r = parseUpdateTemplateInput({ nameAr: "   ", nameEn: "" }, current);
    expect(r).toEqual({ ok: false, error: "nothing_to_update" });
  });

  it("تغيير الاسم العربي فقط — الإنجليزي يبقى، والوصف لا يُمس", () => {
    const r = parseUpdateTemplateInput({ nameAr: "اسم جديد" }, current);
    expect(r).toEqual({
      ok: true,
      data: { nameAr: "اسم جديد", nameEn: "Old name", descAr: "وصف قديم", descEn: "Old desc", changed: ["nameAr"] },
    });
  });

  it("الوصف الحاضر فارغًا يُمسح صراحة (null) — الغائب يُبقى", () => {
    const r = parseUpdateTemplateInput({ descAr: "" }, current);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.descAr).toBeNull();
    expect(r.data.descEn).toBe("Old desc");
    expect(r.data.changed).toEqual(["descAr"]);
  });

  it("اقتطاع الأسماء إلى 120 والأوصاف إلى 400", () => {
    const longName = "ن".repeat(150);
    const longDesc = "و".repeat(500);
    const r = parseUpdateTemplateInput({ nameAr: longName, descAr: longDesc }, current);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.nameAr).toHaveLength(120);
    expect(r.data.descAr).toHaveLength(400);
  });

  it("تحديث اسم إنجليزي وحيد لا يمس العربي (القيم الحالية تُحفظ لكل لغة)", () => {
    const r = parseUpdateTemplateInput({ nameEn: "Only EN" }, current);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.nameAr).toBe("اسم قديم");
    expect(r.data.nameEn).toBe("Only EN");
    expect(r.data.changed).toEqual(["nameEn"]);
  });

  it("الحقول غير النصية تُعامل غائبة", () => {
    const r = parseUpdateTemplateInput({ nameAr: 42 as unknown as string, descEn: true as unknown as string }, current);
    expect(r).toEqual({ ok: false, error: "nothing_to_update" });
  });
});
