import { describe, expect, it } from "vitest";
import type { ContentNode } from "@/lib/blocks/tree";
import {
  buildSnippet,
  extractSearchText,
  normalizeText,
  normalizeWithMap,
  searchPages,
  tokenizeQuery,
  type SearchablePage,
} from "../site-search";

/** بناء عقدة مساعدة للاختبارات */
function node(type: string, props: Record<string, unknown>, children?: ContentNode[]): ContentNode {
  return { id: `n-${Math.random().toString(36).slice(2, 8)}`, type: type as ContentNode["type"], props, children };
}

describe("normalizeText — التطبيع العربي واللاتيني", () => {
  it("يوحد الهمزات والألف المقصورة", () => {
    expect(normalizeText("أحمد إسلام آية")).toBe("احمد اسلام ايه");
  });

  it("يحول التاء المربوطة إلى هاء والألف المقصورة إلى ياء", () => {
    expect(normalizeText("مكتبة")).toBe("مكتبه");
    expect(normalizeText("على")).toBe("علي");
  });

  it("يزيل التشكيل والتطويل", () => {
    expect(normalizeText("مُنَظِّم")).toBe("منظم");
    expect(normalizeText("الـتـقـنـيـة")).toBe("التقنيه");
  });

  it("يحول اللاتيني إلى صغير", () => {
    expect(normalizeText("Services")).toBe("services");
  });
});

describe("normalizeWithMap — خريطة الفهارس الأصلية", () => {
  it("الخريطة تعيد مواضع النص الأصلي رغم حذف التشكيل", () => {
    const text = "مُنْتَج";
    const { norm, map } = normalizeWithMap(text);
    expect(norm).toBe("منتج");
    // م(0) ُ(1) ن(2) ْ(3) ت(4) َ(5) ج(6) → المواضع الأصلية للحروف المطبعة
    expect(map).toEqual([0, 2, 4, 6]);
  });

  it("نص بلا تشكيل: الخريطة متطابقة مع الفهارس", () => {
    const { norm, map } = normalizeWithMap("خدماتنا");
    expect(norm).toBe("خدماتنا");
    expect(map).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("tokenizeQuery — تقطيع الاستعلام", () => {
  it("يقسم على الفراغات ويزيل التكرار بعد التطبيع", () => {
    expect(tokenizeQuery("أحمد  احمد أحمد")).toEqual(["احمد"]);
    // اللاتيني يطبع إلى صغير لكنه حد مستقل عن العربي
    expect(tokenizeQuery("Services services")).toEqual(["services"]);
  });

  it("يرفض الحدود القصيرة جدًا", () => {
    expect(tokenizeQuery("a ب في خدمات")).toEqual(["في", "خدمات"]);
  });

  it("سقف 8 حدود", () => {
    const tokens = tokenizeQuery("واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة عشرة");
    expect(tokens).toHaveLength(8);
    expect(tokens).not.toContain("تسعه");
  });

  it("استعلام فارغ أو قصير يعيد مصفوفة فارغة", () => {
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("   أ ب  ")).toEqual([]);
  });
});

describe("extractSearchText — استخراج نص من شجرة الكتل", () => {
  it("يجمع النصوص من شجرة متداخلة (حاوية + أبناء)", () => {
    const tree: ContentNode[] = [
      node("section", {}, [
        node("hero", {
          kicker: "نبني للنمو",
          title: "تُمطِرُ حلولًا ذكية",
          description: "منصة متكاملة",
          support: ["سرعة", "أمان"],
          links: [{ label: "ابدأ", href: "/contact" }],
        }),
        node("richText", { heading: "من نحن", paragraphs: ["فقرة أولى", "فقرة ثانية"] }),
      ]),
    ];
    const text = extractSearchText(tree);
    expect(text).toContain("نبني للنمو");
    expect(text).toContain("تُمطِرُ حلولًا ذكية");
    expect(text).toContain("منصة متكاملة");
    expect(text).toContain("سرعة");
    expect(text).toContain("من نحن");
    expect(text).toContain("فقرة ثانية");
    // تسمية الرابط نص مفيد يدخل، والرابط نفسه لا يدخل
    expect(text).toContain("ابدأ");
    expect(text).not.toContain("/contact");
  });

  it("يستبعد مفاتيح التعداد والروابط الشبيهة بالسلاسل", () => {
    const text = extractSearchText([
      node("worksShowcase", {
        cases: [{ key: "cloud-cms", kind: "design", title: "منصة سحابية", summary: "لوحة تحكم", badge: "SaaS" }],
        viewAllHref: "https://example.com/works",
      }),
    ]);
    expect(text).toContain("منصة سحابية");
    expect(text).toContain("لوحة تحكم");
    expect(text).not.toContain("cloud-cms");
    expect(text).not.toContain("design");
    expect(text).not.toContain("https://example.com/works");
  });

  it("شجرة فارغة تعيد نصًا فارغًا", () => {
    expect(extractSearchText([])).toBe("");
  });
});

describe("buildSnippet — القصاصات المميزة", () => {
  const tokens = ["خدمات"];

  it("يميز أول مطابقة ويحفظ حدود الكلمات", () => {
    const snippet = buildSnippet("نقدم خدمات برمجية عالية الجودة لعملائنا الكرام في جميع المجالات التقنية المطلوبة", tokens);
    expect(snippet).not.toBeNull();
    expect(snippet?.hit).toBe("خدمات");
    expect(snippet?.before).not.toMatch(/^\s/);
    expect(snippet?.after.startsWith(" برمجية")).toBe(true);
  });

  it("يعيد null عند عدم المطابقة", () => {
    expect(buildSnippet("نص لا علاقة له", tokens)).toBeNull();
    expect(buildSnippet("نص", [])).toBeNull();
  });

  it("نص طويل يُقص مع إشارة البداية والنهاية", () => {
    const long = "كلمة ".repeat(40) + "الخدمات المستهدفة هنا " + "وكلمة ".repeat(40);
    const snippet = buildSnippet(long, tokens);
    expect(snippet?.startTrimmed).toBe(true);
    expect(snippet?.endTrimmed).toBe(true);
    // التمييز يغطي المقطع المطابق داخل الكلمة (المد المقطعي مقصود)
    expect(snippet?.hit).toBe("خدمات");
    // القصاصة أصغر من النص الأصلي بكثير
    expect((snippet!.before + snippet!.hit + snippet!.after).length).toBeLessThan(long.length);
  });

  it("مطابقة على نص مشكول تحفظ الرسم الأصلي بالتشكيل", () => {
    const text = "نقدم مُنْتَجاتنا بفخر وسعادة دائمة";
    const snippet = buildSnippet(text, ["منتجات"]);
    expect(snippet).not.toBeNull();
    expect(snippet?.hit).toBe("مُنْتَجات");
    expect(snippet?.hit).not.toBe("منتجات");
  });

  it("يُطابق مهما اختلف الهمز والتاء المربوطة", () => {
    const snippet = buildSnippet("أفضل مكتبة للاستفسارات", ["مكتبه"]);
    expect(snippet?.hit).toBe("مكتبة");
  });
});

describe("searchPages — التقييم والترتيب", () => {
  const pages: SearchablePage[] = [
    {
      slug: "services",
      title: "خدماتنا التقنية",
      description: "قائمة الخدمات البرمجية",
      blocksJson: JSON.stringify([node("richText", { paragraphs: ["نص عام لا علاقة له بالبحث"] })]),
    },
    {
      slug: "about",
      title: "من نحن",
      description: "تعريف بالفريق",
      blocksJson: JSON.stringify([node("richText", { paragraphs: ["نقدم خدمات استشارية متخصصة للأعمال"] })]),
    },
    {
      slug: "no-match",
      title: "صفحة أخرى",
      description: "لا علاقة",
      blocksJson: JSON.stringify([node("richText", { paragraphs: ["كلام مختلف تمامًا"] })]),
    },
  ];

  it("ترتيب النتائج: تطابق العنوان أقوى من تطابق المتن", () => {
    const hits = searchPages(pages, "خدمات");
    expect(hits[0]?.slug).toBe("services");
    expect(hits[1]?.slug).toBe("about");
  });

  it("الصفحة بلا أي تطابق تُستبعد", () => {
    const slugs = searchPages(pages, "خدمات").map((h) => h.slug);
    expect(slugs).not.toContain("no-match");
  });

  it("قصاصة المتن تُبنى عند مطابقته، والوصف بديلًا عند مطابقة العنوان فقط", () => {
    const hits = searchPages(pages, "خدمات");
    const about = hits.find((h) => h.slug === "about");
    expect(about?.snippet?.hit).toBe("خدمات");
    const services = hits.find((h) => h.slug === "services");
    expect(services?.snippet).toBeNull();
    expect(services?.fallback).toContain("قائمة الخدمات");
  });

  it("الغلاف v1 ({blocks}) يُقرأ كالمصفوفة القديمة", () => {
    const wrapped: SearchablePage[] = [
      {
        slug: "wrapped",
        title: "عنوان بلا تطابق",
        description: "وصف بلا تطابق",
        blocksJson: JSON.stringify({ schemaVersion: 1, blocks: [node("richText", { paragraphs: ["متن يحوي كلمة سحابة مميزة"] })] }),
      },
    ];
    const hits = searchPages(wrapped, "سحابة");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.snippet?.hit).toBe("سحابة");
  });

  it("JSON فاسد لا يُسقط تطابق العنوان", () => {
    const broken: SearchablePage[] = [
      { slug: "broken", title: "خدمات الدعم", description: "", blocksJson: "{فاسد" },
    ];
    const hits = searchPages(broken, "دعم");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.slug).toBe("broken");
    expect(hits[0]?.snippet).toBeNull();
  });

  it("استعلام فارغ أو قصير يعيد لا نتائج", () => {
    expect(searchPages(pages, "")).toEqual([]);
    expect(searchPages(pages, "أ ب")).toEqual([]);
  });

  it("البحث بالتطبيع: همزة مختلفة وتشكيل في المتن يطابقان", () => {
    const hits = searchPages(pages, "استشاريه");
    expect(hits.map((h) => h.slug)).toContain("about");
  });

  it("سقف 20 نتيجة", () => {
    const many: SearchablePage[] = Array.from({ length: 30 }, (_, i) => ({
      slug: `page-${i}`,
      title: `خدمات الصفحة ${i}`,
      description: "",
      blocksJson: null,
    }));
    expect(searchPages(many, "خدمات")).toHaveLength(20);
  });
});
