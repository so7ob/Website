/**
 * اختبارات قوالب الصفحات (§5) — القوالب المدمجة:
 * - كل قالب مدمج يمر عبر بوابة التحقق للغتين (شجرة صالحة بلا مفاجآت عند التطبيق)
 * - المعرفات فريدة داخل كل شجرة، ومراسات anchorId فريدة كذلك
 * - الحل الأساسي resolveTemplateBlocks: لغة موجودة/مفقودة صراحة بلا احتياط صامت
 * - تطبيع مدخل إنشاء القالب المخصص: اسم مطلوب، محتوى واحد على الأقل، الفحص يرفض غير الصالح
 */
import { describe, expect, it } from "vitest";
import { validateContent } from "@/lib/blocks/validate";
import { collectIds } from "@/lib/blocks/tree";
import { BUILTIN_TEMPLATES, BUILTIN_TEMPLATE_KEYS } from "@/lib/templates/builtin";
import { parseCreateTemplateInput, resolveTemplateBlocks, templatePreview, TEMPLATE_PREVIEW_MAX } from "@/lib/templates/service";

describe("builtin page templates", () => {
  it("القوالب الستة المدمجة موجودة بمفاتيح فريدة", () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(6);
    expect(BUILTIN_TEMPLATE_KEYS.size).toBe(6);
    for (const key of ["landing", "about", "services", "works", "process", "contact"]) {
      expect(BUILTIN_TEMPLATE_KEYS.has(key)).toBe(true);
    }
  });

  for (const tpl of BUILTIN_TEMPLATES) {
    it(`«${tpl.key}» شجرة عربية صالحة عبر بوابة التحقق`, () => {
      const result = validateContent(JSON.stringify({ schemaVersion: 1, blocks: tpl.blocksAr }));
      if (!result.ok) throw new Error(`invalid ar tree for ${tpl.key}: ${result.error}`);
      expect(result.ok).toBe(true);
      expect(result.tree.length).toBeGreaterThan(0);
    });

    it(`«${tpl.key}» شجرة إنجليزية صالحة عبر بوابة التحقق`, () => {
      const result = validateContent(JSON.stringify({ schemaVersion: 1, blocks: tpl.blocksEn }));
      if (!result.ok) throw new Error(`invalid en tree for ${tpl.key}: ${result.error}`);
      expect(result.ok).toBe(true);
      expect(result.tree.length).toBeGreaterThan(0);
    });

    it(`«${tpl.key}» معرفات ومراسات فريدة في كل شجرة`, () => {
      for (const tree of [tpl.blocksAr, tpl.blocksEn]) {
        const ids = collectIds(tree);
        // collectIds يجمّع في Set — التساوي مع عدد العقد اليدوي يعني لا تكرار
        let manual = 0;
        const count = (nodes: typeof tree) => {
          for (const n of nodes) {
            manual += 1;
            if (n.children) count(n.children);
          }
        };
        count(tree);
        expect(ids.size).toBe(manual);
        const anchors = tree.map((n) => n.anchorId).filter(Boolean);
        expect(new Set(anchors).size).toBe(anchors.length);
      }
    });
  }

  it("القوالب المدمجة تجتاز الحد الأقصى لعقد الشجرة (120) بهامش", () => {
    for (const tpl of BUILTIN_TEMPLATES) {
      const result = validateContent(JSON.stringify({ schemaVersion: 1, blocks: tpl.blocksAr }));
      expect(result.ok).toBe(true); // البوابة نفسها ترفض تجاوز الحد
    }
  });
});

describe("resolveTemplateBlocks", () => {
  const withBoth = { blocksAr: '{"ar":1}', blocksEn: '{"en":1}' };
  const arOnly = { blocksAr: '{"ar":1}', blocksEn: null };

  it("يعيد محتوى اللغة المطلوبة عند توفره", () => {
    expect(resolveTemplateBlocks(withBoth, "ar")).toEqual({ ok: true, blocks: '{"ar":1}' });
    expect(resolveTemplateBlocks(withBoth, "en")).toEqual({ ok: true, blocks: '{"en":1}' });
  });

  it("يرفض صراحة اللغة المفقودة بلا احتياط صامت بمحتوى لغة أخرى", () => {
    expect(resolveTemplateBlocks(arOnly, "en")).toEqual({ ok: false, error: "template_locale_missing" });
  });
});

describe("parseCreateTemplateInput", () => {
  const validTree = JSON.stringify({ schemaVersion: 1, blocks: [{ id: "b-x-1", type: "heading", props: { text: "T", level: 2, align: "start" } }] });

  it("يقبل اسمًا عربيًا ومحتوى عربيًا صالحًا ويخزن المطبّع", () => {
    const parsed = parseCreateTemplateInput({ nameAr: "قالبي", blocksAr: validTree });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.nameAr).toBe("قالبي");
      expect(parsed.data.nameEn).toBe("قالبي"); // الاسم الإنجليزي يستكمل من العربي
      expect(parsed.data.blocksAr).toContain('"schemaVersion":1');
    }
  });

  it("يرفض القالب بلا أي اسم", () => {
    const parsed = parseCreateTemplateInput({ blocksAr: validTree });
    expect(parsed).toEqual({ ok: false, error: "name_required" });
  });

  it("يرفض القالب بلا أي محتوى", () => {
    const parsed = parseCreateTemplateInput({ nameAr: "قالب" });
    expect(parsed).toEqual({ ok: false, error: "blocks_required" });
  });

  it("يرفض المحتوى غير الصالح عبر بوابة التحقق (لا حفظ خام أبدًا)", () => {
    const parsed = parseCreateTemplateInput({ nameAr: "قالب", blocksAr: JSON.stringify([{ id: "x", type: "not_a_type" }]) });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain("block_type_unknown");
  });

  it("يقبل محتوى إنجليزي وحده ويستكمل الاسمين", () => {
    const parsed = parseCreateTemplateInput({ nameEn: "My template", blocksEn: validTree });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.nameAr).toBe("My template");
      expect(parsed.data.blocksAr).toBeNull();
      expect(parsed.data.blocksEn).toContain('"schemaVersion":1');
    }
  });
});

describe("templatePreview — بصمة المعاينة المصغرة (جولة 37)", () => {
  it("تستخرج أنواع الكتل العلوية بترتيبها", () => {
    const envelope = JSON.stringify({
      schemaVersion: 1,
      blocks: [
        { id: "a", type: "hero", props: { title: "x" } },
        { id: "b", type: "servicesGrid", props: {} },
        { id: "c", type: "ctaSection", props: {} },
      ],
    });
    expect(templatePreview(envelope)).toEqual(["hero", "servicesGrid", "ctaSection"]);
  });

  it("لا تتجاوز الحد الأقصى 14 نوعًا", () => {
    const blocks = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, type: "text", props: { body: "x" } }));
    expect(templatePreview(JSON.stringify({ schemaVersion: 1, blocks }))).toHaveLength(TEMPLATE_PREVIEW_MAX);
  });

  it("تتجاهل المدخلات الفاسدة بهدوء (null / نص غير JSON / بنية بلا blocks)", () => {
    expect(templatePreview(null)).toEqual([]);
    expect(templatePreview("not-json{")).toEqual([]);
    expect(templatePreview(JSON.stringify({ schemaVersion: 1 }))).toEqual([]);
    expect(templatePreview(JSON.stringify({ schemaVersion: 1, blocks: "nope" }))).toEqual([]);
  });

  it("تتجاهل عقدًا بلا نوع صالح ولا تتضمن الأبناء", () => {
    const envelope = JSON.stringify({
      schemaVersion: 1,
      blocks: [{ id: "a", type: "columns", children: [{ id: "b", type: "text" }] }],
    });
    expect(templatePreview(envelope)).toEqual(["columns"]);
  });
});
