import { describe, it, expect } from "vitest";
import {
  INLINE_EDITABLE_TYPES,
  INLINE_PRIMARY_FIELD,
  applyInlineField,
  isInlineEditableType,
  readInlineField,
} from "@/lib/blocks/inline-fields";

describe("inline-fields — أنواع التحرير المباشر", () => {
  it("الأنواع الثلاثة النصية فقط قابلة للتحرير المباشر", () => {
    expect(INLINE_EDITABLE_TYPES).toEqual(["heading", "text", "buttonLink"]);
    expect(isInlineEditableType("heading")).toBe(true);
    expect(isInlineEditableType("text")).toBe(true);
    expect(isInlineEditableType("buttonLink")).toBe(true);
    expect(isInlineEditableType("hero")).toBe(false);
    expect(isInlineEditableType("section")).toBe(false);
    expect(isInlineEditableType("spacer")).toBe(false);
  });

  it("لكل نوع قابل للتحرير حقل أساسي معرف", () => {
    for (const type of INLINE_EDITABLE_TYPES) {
      expect(typeof INLINE_PRIMARY_FIELD[type]).toBe("string");
      expect(INLINE_PRIMARY_FIELD[type].length).toBeGreaterThan(0);
    }
  });
});

describe("readInlineField — قراءة الحقول", () => {
  it("يقرأ مفتاحًا مباشرًا", () => {
    expect(readInlineField({ text: "مرحبًا" }, "text")).toBe("مرحبًا");
    expect(readInlineField({ label: "زر" }, "label")).toBe("زر");
  });

  it("يقرأ عنصر مصفوفة بالفهرس", () => {
    expect(readInlineField({ paragraphs: ["أولى", "ثانية"] }, "paragraphs:1")).toBe("ثانية");
  });

  it("يُرجع null للمفاتيح الغريبة أو غير النصية", () => {
    expect(readInlineField({}, "text")).toBeNull();
    expect(readInlineField({ level: 3 }, "level")).toBeNull();
    expect(readInlineField(null, "text")).toBeNull();
    expect(readInlineField("نص", "text")).toBeNull();
  });

  it("يُرجع null لفهرس خارج النطاق أو مصفوفة غائبة", () => {
    expect(readInlineField({ paragraphs: ["أ"] }, "paragraphs:1")).toBeNull();
    expect(readInlineField({ paragraphs: ["أ"] }, "paragraphs:x")).toBeNull();
    expect(readInlineField({ text: "نص" }, "paragraphs:0")).toBeNull();
  });
});

describe("applyInlineField — كتابة الحقول", () => {
  it("يعدّل مفتاحًا مباشرًا دون مساس ببقية الخصائص", () => {
    const props = { text: "قديم", level: 3, align: "center", kicker: "شارة" };
    const next = applyInlineField(props, "text", "جديد");
    expect(next).toEqual({ text: "جديد", level: 3, align: "center", kicker: "شارة" });
    // الأصل غير مُمسّس
    expect(props.text).toBe("قديم");
  });

  it("يعدّل عنصر مصفوفة بسلامة", () => {
    const props = { paragraphs: ["أولى", "ثانية"], size: "lg" };
    const next = applyInlineField(props, "paragraphs:1", "معدلة");
    expect(next?.paragraphs).toEqual(["أولى", "معدلة"]);
    expect(next?.size).toBe("lg");
    expect(props.paragraphs).toEqual(["أولى", "ثانية"]);
  });

  it("يقتطع القيمة على الحد الأقصى للمخطط", () => {
    const long = "ا".repeat(400);
    const veryLong = "ا".repeat(6000);
    expect(applyInlineField({ text: "" }, "text", long)?.text).toHaveLength(300); // heading.text
    expect(applyInlineField({ label: "" }, "label", long)?.label).toHaveLength(120);
    const par = applyInlineField({ paragraphs: [""] }, "paragraphs:0", veryLong)?.paragraphs as string[];
    expect(par[0]).toHaveLength(5000);
    expect(applyInlineField({ kicker: "" }, "kicker", long)?.kicker).toHaveLength(120);
  });

  it("يرفض الحقول غير المعروفة صراحةً — لا كتابة صامتة", () => {
    expect(applyInlineField({ href: "/x" }, "href", "javascript:alert(1)")).toBeNull();
    expect(applyInlineField({}, "level", "9")).toBeNull();
    expect(applyInlineField({}, "unknown", "قيمة")).toBeNull();
  });

  it("يرفض الفهارس خارج النطاق والمصفوفات الغائبة", () => {
    expect(applyInlineField({ paragraphs: ["أ"] }, "paragraphs:5", "x")).toBeNull();
    expect(applyInlineField({ paragraphs: "ليست مصفوفة" }, "paragraphs:0", "x")).toBeNull();
    expect(applyInlineField({}, "paragraphs:0", "x")).toBeNull();
  });

  it("يقبل القيمة الفارغة — المخططات النصية بلا حد أدنى", () => {
    expect(applyInlineField({ text: "نص" }, "text", "")).toEqual({ text: "" });
    expect(applyInlineField({ paragraphs: ["نص"] }, "paragraphs:0", "")).toEqual({ paragraphs: [""] });
  });
});
