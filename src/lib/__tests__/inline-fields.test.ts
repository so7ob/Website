import { describe, it, expect } from "vitest";
import {
  INLINE_EDITABLE_TYPES,
  INLINE_PRIMARY_FIELD,
  applyInlineField,
  isInlineEditableType,
  readInlineField,
} from "@/lib/blocks/inline-fields";

describe("inline-fields — أنواع التحرير المباشر", () => {
  it("العشرة أنواع عالية الاستخدام قابلة للتحرير المباشر (خارطة 1.3 — G3)", () => {
    expect(INLINE_EDITABLE_TYPES).toEqual([
      "heading",
      "text",
      "buttonLink",
      "richText",
      "ctaSection",
      "faqSection",
      "numberedList",
      "numberedValues",
      "featureGrid",
      "processSteps",
    ]);
    expect(isInlineEditableType("heading")).toBe(true);
    expect(isInlineEditableType("richText")).toBe(true);
    expect(isInlineEditableType("ctaSection")).toBe(true);
    expect(isInlineEditableType("faqSection")).toBe(true);
    expect(isInlineEditableType("numberedList")).toBe(true);
    expect(isInlineEditableType("numberedValues")).toBe(true);
    expect(isInlineEditableType("featureGrid")).toBe(true);
    expect(isInlineEditableType("processSteps")).toBe(true);
    expect(isInlineEditableType("hero")).toBe(false);
    expect(isInlineEditableType("section")).toBe(false);
    expect(isInlineEditableType("spacer")).toBe(false);
    expect(isInlineEditableType("servicesDetail")).toBe(false);
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

describe("مسارات العناصر الكائنية — items:0.title (خارطة 1.3)", () => {
  const gridProps = {
    kicker: "مميزاتنا",
    title: "لماذا سُحُب؟",
    items: [
      { title: "أولى", body: "وصف أولى" },
      { title: "ثانية", body: "وصف ثانية" },
    ],
  };

  it("يقرأ خاصية كائن داخل عنصر مصفوفة", () => {
    expect(readInlineField(gridProps, "items:0.title")).toBe("أولى");
    expect(readInlineField(gridProps, "items:1.body")).toBe("وصف ثانية");
    expect(readInlineField(gridProps, "title")).toBe("لماذا سُحُب؟");
  });

  it("يكتب خاصية كائن بسلامة — العنصر الأصل والخصائص الأخرى سليمة", () => {
    const next = applyInlineField(gridProps, "items:0.title", "معدلة");
    const nextItems = next?.items as Array<{ title: string; body: string }>;
    expect(nextItems[0]).toEqual({ title: "معدلة", body: "وصف أولى" });
    expect(nextItems[1]).toEqual({ title: "ثانية", body: "وصف ثانية" });
    expect(next?.kicker).toBe("مميزاتنا");
    // الأصل لم يُمس
    expect(gridProps.items[0].title).toBe("أولى");
  });

  it("يقص عناوين العناصر على حد المخطط (200) ومتوالياتها على 3000", () => {
    const long = "ا".repeat(300);
    const longBody = "ب".repeat(3500);
    const next = applyInlineField(gridProps, "items:0.title", long);
    expect((next?.items as Array<{ title: string }>)[0].title).toHaveLength(200);
    const nextBody = applyInlineField(gridProps, "items:1.body", longBody);
    expect((nextBody?.items as Array<{ body: string }>)[1].body).toHaveLength(3000);
    // والعنوان المباشر على 300
    expect(applyInlineField({ title: "" }, "title", long)?.title).toHaveLength(300);
  });

  it("يرفض المسارات غير المعروفة والعناصر غير الكائنية بلا كتابة صامتة", () => {
    expect(applyInlineField(gridProps, "items:0.missing", "x")).toBeNull();
    expect(applyInlineField(gridProps, "unknown:0.title", "x")).toBeNull();
    expect(applyInlineField({ items: ["نص لا كائن"] }, "items:0.title", "x")).toBeNull();
    expect(applyInlineField({ items: [null] }, "items:0.title", "x")).toBeNull();
    expect(applyInlineField({ items: [[1]] }, "items:0.title", "x")).toBeNull();
    expect(readInlineField({ items: ["نص"] }, "items:0.title")).toBeNull();
  });

  it("يرفض الفهارس الخارجية والصيغ المشوهة في المسارات المركبة", () => {
    expect(applyInlineField(gridProps, "items:9.title", "x")).toBeNull();
    expect(applyInlineField(gridProps, "items:-1.title", "x")).toBeNull();
    expect(applyInlineField(gridProps, "items:x.title", "x")).toBeNull();
    expect(readInlineField(gridProps, "items:x.title")).toBeNull();
    // فقرات faq عبر المسار العام (متاحة للتعميم)
    const faq = { items: [{ q: "سؤال", a: "جواب" }] };
    expect(readInlineField(faq, "items:0.q")).toBe("سؤال");
    const faqNext = applyInlineField(faq, "items:0.q", "س2");
    expect((faqNext?.items as Array<{ q: string; a: string }>)[0]).toEqual({ q: "س2", a: "جواب" });
  });
});
