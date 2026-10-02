import { describe, it, expect } from "vitest";
import {
  extractMediaRefs,
  textReferencesMedia,
  normalizeMediaFolder,
  MEDIA_URL_PREFIX,
} from "@/lib/media-usage";

/** تتبع استخدام الوسائط (§7) — المطابقة الصارمة على حدود المعرف وتطبيع المجلدات */

describe("extractMediaRefs — استخراج معرفات الوسائط من نص JSON", () => {
  it("يستخرج كل المعرفات بلا تكرار", () => {
    const text = JSON.stringify({
      blocks: [
        { id: "a", type: "image", props: { src: "/api/media/abc123" } },
        { id: "b", type: "image", props: { src: "/api/media/xyz789" } },
        { id: "c", type: "image", props: { src: "/api/media/abc123" } },
      ],
    });
    const refs = extractMediaRefs(text);
    expect(refs.size).toBe(2);
    expect(refs.has("abc123")).toBe(true);
    expect(refs.has("xyz789")).toBe(true);
  });

  it("يلتقط المعرف الكامل حتى مع معاملات استعلام", () => {
    const refs = extractMediaRefs('{"src":"/api/media/cmk123abc?w=200&h=100"}');
    expect(refs.size).toBe(1);
    expect([...refs][0]).toBe("cmk123abc");
  });

  it("يتجاهل النصوص بلا بادئة وسائط", () => {
    expect(extractMediaRefs('{"src":"/uploads/pic.png"}').size).toBe(0);
    expect(extractMediaRefs("").size).toBe(0);
    expect(extractMediaRefs(null).size).toBe(0);
    expect(extractMediaRefs(undefined).size).toBe(0);
  });

  it("يتعامل مع معرفات تحمل شرطات وشرطات سفلية", () => {
    const refs = extractMediaRefs('{"src":"/api/media/cm-ab_12"}');
    expect(refs.has("cm-ab_12")).toBe(true);
  });
});

describe("textReferencesMedia — المطابقة بحدود معرف صارمة", () => {
  const target = "abc123";

  it("يطابق الاستخدام المباشر", () => {
    expect(textReferencesMedia(`{"src":"${MEDIA_URL_PREFIX}abc123"}`, target)).toBe(true);
  });

  it("لا يطابق معرفًا أطول يبدأ بنفس الأحرف (لا مطابقة جزئية)", () => {
    expect(textReferencesMedia(`{"src":"${MEDIA_URL_PREFIX}abc123def"}`, target)).toBe(false);
  });

  it("يطابق عندما يلي المعرف محرف استعلام", () => {
    expect(textReferencesMedia(`{"src":"${MEDIA_URL_PREFIX}abc123?w=100"}`, target)).toBe(true);
  });

  it("لا يطابق وسيلة أخرى تشترك في البداية", () => {
    expect(textReferencesMedia(`{"src":"${MEDIA_URL_PREFIX}abc124"}`, target)).toBe(false);
  });

  it("ينفي النصوص الفارغة والمدخلات الفارغة بأمان", () => {
    expect(textReferencesMedia(null, target)).toBe(false);
    expect(textReferencesMedia("", target)).toBe(false);
    expect(textReferencesMedia('{"src":"/api/media/abc123"}', "")).toBe(false);
  });

  it("يطابق ضمن نص طويل متعدد الكتل", () => {
    const text = JSON.stringify({
      schemaVersion: 1,
      blocks: [
        { id: "s1", type: "section", children: [
          { id: "c1", type: "column", children: [
            { id: "i1", type: "image", props: { src: `${MEDIA_URL_PREFIX}other1` } },
            { id: "i2", type: "image", props: { src: `${MEDIA_URL_PREFIX}abc123` } },
          ] },
        ] },
      ],
    });
    expect(textReferencesMedia(text, "abc123")).toBe(true);
    expect(textReferencesMedia(text, "other1")).toBe(true);
    expect(textReferencesMedia(text, "missing")).toBe(false);
  });
});

describe("normalizeMediaFolder — تطبيع أسماء المجلدات", () => {
  it("يفض الافتراضي على الفراغ", () => {
    expect(normalizeMediaFolder(undefined)).toBe("general");
    expect(normalizeMediaFolder(null)).toBe("general");
    expect(normalizeMediaFolder("")).toBe("general");
    expect(normalizeMediaFolder("   ")).toBe("general");
  });

  it("يقص المسافات وينظف محارف التحكم", () => {
    expect(normalizeMediaFolder("  hero images ")).toBe("hero images");
    expect(normalizeMediaFolder("bad\u0000name")).toBe("badname");
  });

  it("يرفض الأسماء الطويلة جدًا (null خطأ صريح)", () => {
    expect(normalizeMediaFolder("x".repeat(61))).toBeNull();
    expect(normalizeMediaFolder("x".repeat(60))).toBe("x".repeat(60));
  });

  it("يحفظ النص العربي كما هو", () => {
    expect(normalizeMediaFolder("صور الرئيسية")).toBe("صور الرئيسية");
  });
});
