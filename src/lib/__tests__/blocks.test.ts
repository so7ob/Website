import { describe, it, expect } from "vitest";
import { validateBlocks, isValidSlug, RESERVED_SLUGS, BLOCK_LIBRARY, blockSchemas } from "@/lib/blocks/types";

/** تحقق كتل المحتوى — بوابة الأمان الخادمية قبل الحفظ والنشر */

const validPageHeader = JSON.stringify([
  { id: "b-1", type: "pageHeader", props: { kicker: "k", title: "t", intro: [], quickLinks: [] } },
]);

describe("validateBlocks", () => {
  it("يقبل صفحة صالحة", () => {
    const result = validateBlocks(validPageHeader);
    expect(result.ok).toBe(true);
  });

  it("يرفض JSON غير صالح", () => {
    expect(validateBlocks("not json{").ok).toBe(false);
  });

  it("يرفض مصفوفة غير JSON", () => {
    expect(validateBlocks("[1,2,3]").ok).toBe(false);
  });

  it("يرفض نوع كتلة غير مسجل", () => {
    const result = validateBlocks(JSON.stringify([{ id: "b-1", type: "evilScript", props: {} }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("block_type_unknown");
  });

  it("يرفض معرفات مكررة", () => {
    const blocks = JSON.stringify([
      { id: "same", type: "spacer", props: {} },
      { id: "same", type: "spacer", props: {} },
    ]);
    expect(validateBlocks(blocks).ok).toBe(false);
  });

  it("يرفض خصائص مخالفة للمخطط", () => {
    // hero يتطلب نصوصًا — مصفوفة support بطول يتجاوز الحد
    const blocks = JSON.stringify([
      { id: "b-1", type: "hero", props: { kicker: "k", title: "t", titleAccent: "a", description: "d", support: new Array(20).fill("x") } },
    ]);
    expect(validateBlocks(blocks).ok).toBe(false);
  });

  it("يرفض روابط خارج المسموح (javascript:)", () => {
    const blocks = JSON.stringify([
      {
        id: "b-1",
        type: "buttonLink",
        props: { label: "x", href: "javascript:alert(1)", variant: "primary" },
      },
    ]);
    expect(validateBlocks(blocks).ok).toBe(false);
  });

  it("كل أنواع المكتبة لها مخطط مسجل", () => {
    for (const item of BLOCK_LIBRARY) {
      expect(blockSchemas[item.type]).toBeDefined();
    }
    // ثنائية اللغة في تسميات المكتبة
    for (const item of BLOCK_LIBRARY) {
      expect(item.ar.length).toBeGreaterThan(0);
      expect(item.en.length).toBeGreaterThan(0);
    }
  });
});

describe("isValidSlug", () => {
  it("يقبل الرئيسية الفارغة والمسارات الصالحة", () => {
    expect(isValidSlug("")).toBe(true);
    expect(isValidSlug("about")).toBe(true);
    expect(isValidSlug("my-page-2")).toBe(true);
  });

  it("يرفض المسارات المحجوزة لواجهات المنصة", () => {
    for (const slug of ["account", "admin", "auth", "api"]) {
      expect(isValidSlug(slug)).toBe(false);
    }
    expect(RESERVED_SLUGS).toContain("admin");
  });

  it("يرفض الصيغ غير الصالحة", () => {
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("-start")).toBe(false);
    expect(isValidSlug("end-")).toBe(false);
    expect(isValidSlug("double--dash")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("javascript:alert")).toBe(false);
  });
});
