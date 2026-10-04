/**
 * اختبارات مقارنة الإصدارات (G4) — بصمة الإصدار، استخراج المستخلص النصي، المطابقة التعددية للفرق.
 */
import { describe, expect, it } from "vitest";
import type { ContentNode } from "../tree";
import {
  DIFF_LABEL_MAX,
  DIFF_MAX_ENTRIES,
  diffFingerprints,
  extractLabel,
  fingerprintFromNodes,
  versionFingerprint,
} from "../version-diff";

const node = (type: string, props?: Record<string, unknown>, children?: ContentNode[]): ContentNode => ({
  id: `n_${type}_${Math.random().toString(36).slice(2, 8)}`,
  type: type as ContentNode["type"],
  props,
  children,
});

describe("extractLabel", () => {
  it("يفضل title على باقي الحقول", () => {
    expect(extractLabel("hero", { title: "الواجهة", description: "شرح طويل" })).toBe("الواجهة");
  });

  it("يتبع ترتيب الأولوية heading ثم text", () => {
    expect(extractLabel("heading", { text: "عنوان فرعي", kicker: "تمهيد" })).toBe("عنوان فرعي");
    expect(extractLabel("richText", { lead: "المقدمة", heading: "الرأس" })).toBe("الرأس");
  });

  it("يأخذ أول فقرة من مصفوفة الفقرات", () => {
    expect(extractLabel("text", { paragraphs: ["الفقرة الأولى", "الثانية"] })).toBe("الفقرة الأولى");
  });

  it("يمسح بعمق محدود للحقول المتداخلة (visionMission)", () => {
    expect(
      extractLabel("visionMission", {
        vision: { title: "رؤيتنا", body: "نص الرؤية" },
        mission: { title: "مهمتنا", body: "نص المهمة" },
      })
    ).toBe("رؤيتنا");
  });

  it("يلتقط alt للصور ويتجاهل src (روابط ومسارات)", () => {
    expect(extractLabel("image", { src: "/uploads/photo.png", alt: "لقطة شاشة للتطبيق" })).toBe("لقطة شاشة للتطبيق");
    expect(extractLabel("gallery", { images: [{ src: "https://x.test/a.png", alt: "أول صورة" }] })).toBe("أول صورة");
  });

  it("يعيد سلسلة فارغة للحاويات والكتل الشكلية", () => {
    expect(extractLabel("section", { title: "غير مقروء" })).toBe("");
    expect(extractLabel("divider", {})).toBe("");
    expect(extractLabel("spacer", { size: "md" })).toBe("");
  });

  it("يوحد المسافات ويقتطع بسقف 120 مع علامة الحذف", () => {
    const long = "كلمة ".repeat(40).trim();
    const out = extractLabel("text", { paragraphs: [long] });
    expect(out.length).toBe(DIFF_LABEL_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(extractLabel("hero", { title: "  نص   متعدد\tالمسافات  " })).toBe("نص متعدد المسافات");
  });
});

describe("versionFingerprint", () => {
  const tree = {
    schemaVersion: 1,
    blocks: [
      node("pageHeader", { title: "من نحن" }),
      node("section", undefined, [node("richText", { heading: "الشرح" })]),
    ],
  };

  it("يبني بصمة مرتبة من مغلف v1 مع أبناء الحاويات", () => {
    const fp = versionFingerprint(JSON.stringify(tree));
    expect(fp).toEqual([
      { type: "pageHeader", label: "من نحن" },
      { type: "section", label: "" },
      { type: "richText", label: "الشرح" },
    ]);
  });

  it("يقبل مصفوفة v0 المسطحة", () => {
    const fp = versionFingerprint(JSON.stringify([node("ctaSection", { title: "ابدأ الآن" })]));
    expect(fp).toEqual([{ type: "ctaSection", label: "ابدأ الآن" }]);
  });

  it("يفشل بهدوء على JSON الفاسد والأشكال غير المتوقعة", () => {
    expect(versionFingerprint("{فاسد")).toEqual([]);
    expect(versionFingerprint(JSON.stringify({ noBlocks: true }))).toEqual([]);
    expect(versionFingerprint(null)).toEqual([]);
  });

  it("يتوقف عند سقف 80 مدخلًا", () => {
    const many = Array.from({ length: 100 }, () => node("text", { paragraphs: ["فقرة"] }));
    expect(versionFingerprint(JSON.stringify({ schemaVersion: 1, blocks: many })).length).toBe(DIFF_MAX_ENTRIES);
  });
});

describe("fingerprintFromNodes", () => {
  it("مطابقة للبصمة من JSON لنفس الشجرة", () => {
    const nodes = [
      node("hero", { title: "تُمطِرُ حلولًا ذكية" }),
      node("row", undefined, [node("text", { paragraphs: ["عمود"] })]),
    ];
    const fromNodes = fingerprintFromNodes(nodes);
    const fromJson = versionFingerprint(JSON.stringify({ schemaVersion: 1, blocks: nodes }));
    expect(fromNodes).toEqual(fromJson);
  });
});

describe("diffFingerprints", () => {
  const e = (type: string, label: string) => ({ type, label });

  it("يكشف الإضافة الصرفة", () => {
    const d = diffFingerprints([e("hero", "أ")], [e("hero", "أ"), e("faqSection", "أسئلة")]);
    expect(d.added).toEqual([e("faqSection", "أسئلة")]);
    expect(d.removed).toEqual([]);
    expect(d.unchangedCount).toBe(1);
    expect(d.identical).toBe(false);
  });

  it("يكشف الحذف الصرف", () => {
    const d = diffFingerprints([e("hero", "أ"), e("text", "نص")], [e("hero", "أ")]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([e("text", "نص")]);
  });

  it("يعيد الترتيب وحده دون تغيير في المحتوى", () => {
    const d = diffFingerprints([e("hero", "أ"), e("text", "نص")], [e("text", "نص"), e("hero", "أ")]);
    expect(d.identical).toBe(true);
    expect(d.unchangedCount).toBe(2);
  });

  it("يتعامل مع التكرارات بالمطابقة المتسلسلة لا الشمولية", () => {
    // المرجع فيه «نص» مرتين، الهدف مرة واحدة → حذف واحد لا اثنان
    const d = diffFingerprints([e("text", "نص"), e("text", "نص")], [e("text", "نص")]);
    expect(d.removed).toEqual([e("text", "نص")]);
    expect(d.unchangedCount).toBe(1);
  });

  it("يعلن التطابق التام لقصتين متطابقتين وفارغتين", () => {
    const same = [e("hero", "أ")];
    expect(diffFingerprints(same, [...same]).identical).toBe(true);
    expect(diffFingerprints([], []).identical).toBe(true);
  });

  it("يمزج الإضافة والحذف مع بقاء المشترك", () => {
    const reference = [e("hero", "أ"), e("servicesGrid", "خدمات"), e("ctaSection", "خاتمة")];
    const target = [e("hero", "أ"), e("featureGrid", "مميزات"), e("ctaSection", "خاتمة")];
    const d = diffFingerprints(reference, target);
    expect(d.unchangedCount).toBe(2);
    expect(d.added).toEqual([e("featureGrid", "مميزات")]);
    expect(d.removed).toEqual([e("servicesGrid", "خدمات")]);
  });
});
