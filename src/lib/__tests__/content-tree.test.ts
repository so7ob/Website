import { describe, it, expect } from "vitest";
import { validateContent, loadContentForRender } from "@/lib/blocks/validate";
import { migrateContent } from "@/lib/blocks/migrate";
import { countNodes, maxDepth, findNode, cloneWithNewIds, collectIds, defaultNode } from "@/lib/blocks/tree";
import { nodeStyleClasses, effectiveValue, resetDeviceValue } from "@/lib/blocks/style";

/** شجرة المحتوى v1 — الترحيل والتحقق والحدود والأنماط */

const envelope = (blocks: unknown[]) => JSON.stringify({ schemaVersion: 1, blocks });

const validSection = envelope([
  {
    id: "sec-1",
    type: "section",
    children: [
      {
        id: "row-1",
        type: "row",
        children: [
          { id: "col-1", type: "column", children: [{ id: "h-1", type: "heading", props: { text: "عنوان" } }] },
          { id: "col-2", type: "column", children: [{ id: "t-1", type: "text", props: { paragraphs: ["نص"] } }] },
        ],
      },
    ],
  },
]);

describe("validateContent — القبول والتطبيع", () => {
  it("يقبل شجرة صالحة ويعيد مغلفًا مطبّعًا", () => {
    const result = validateContent(validSection);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.schemaVersion).toBe(1);
    expect(result.tree[0].type).toBe("section");
    expect(result.tree[0].children?.[0].type).toBe("row");
  });

  it("يقبل مصفوفة v0 القديمة ويرحّلها (migrated=true)", () => {
    const legacy = JSON.stringify([
      { id: "b-1", type: "heading", props: { text: "مرحبًا" } },
    ]);
    const result = validateContent(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.tree[0].type).toBe("heading");
    // JSON المحفوظ مغلف v1 لا مصفوفة
    expect(JSON.parse(result.json)).toMatchObject({ schemaVersion: 1 });
  });

  it("يملأ القيم الافتراضية (row.props.gap) ويسقط المفاتيح الغريبة", () => {
    const result = validateContent(
      envelope([{ id: "r1", type: "row", evilKey: "x", children: [] }])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tree[0].props).toMatchObject({ gap: "md" });
    expect(result.tree[0].props).not.toHaveProperty("evilKey");
  });

  it("يحوّل النمط القديم {background,paddingY} إلى base", () => {
    const result = validateContent(
      envelope([{ id: "h1", type: "heading", props: { text: "x" }, style: { background: "navy", paddingY: "lg" } }])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tree[0].style).toEqual({ base: { background: "navy", paddingY: "lg" } });
  });
});

describe("validateContent — الرفض الصريح (لا صفحات فارغة صامتة)", () => {
  it("يرفض نوعًا غير مسجل ويذكره", () => {
    const result = validateContent(envelope([{ id: "x", type: "evilScript" }]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("block_type_unknown:evilScript");
  });

  it("يرفض constructor كنوع (فحص ملكية مباشر)", () => {
    const result = validateContent(envelope([{ id: "x", type: "constructor" }]));
    expect(result.ok).toBe(false);
  });

  it("يرفض معرفات مكررة عبر مستويات الشجرة", () => {
    const result = validateContent(
      envelope([
        { id: "same", type: "section", children: [{ id: "same", type: "container", children: [] }] },
      ])
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("block_duplicate_id");
  });

  it("يرفض مراسات anchorId مكررة", () => {
    const result = validateContent(
      envelope([
        { id: "a", type: "heading", props: { text: "1" }, anchorId: "top" },
        { id: "b", type: "heading", props: { text: "2" }, anchorId: "top" },
      ])
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("anchor_duplicate");
  });

  it("يرفض أبناء داخل كتلة ورقية (منع الدورات بنيويًا)", () => {
    const result = validateContent(
      envelope([{ id: "t1", type: "text", props: { paragraphs: ["x"] }, children: [{ id: "t2", type: "spacer" }] }])
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("leaf_has_children");
  });

  it("يرفض نوع ابن غير مسموح (row تقبل أعمدة فقط)", () => {
    const result = validateContent(
      envelope([{ id: "r1", type: "row", children: [{ id: "t1", type: "text", props: { paragraphs: ["x"] } }] }])
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("child_not_allowed:row:text");
  });

  it("يرفض تجاوز حد العمق", () => {
    // سلسلة أعماق: section > container > row > column > container > column > … = 7 مستويات
    const deep = envelope([
      {
        id: "d1", type: "section", children: [
          { id: "d2", type: "container", children: [
            { id: "d3", type: "row", children: [
              { id: "d4", type: "column", children: [
                { id: "d5", type: "container", children: [
                  { id: "d6", type: "column", children: [
                    { id: "d7", type: "container", children: [] },
                  ] },
                ] },
              ] },
            ] },
          ] },
        ],
      },
    ]);
    const result = validateContent(deep);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("tree_too_deep");
  });

  it("يرفض تجاوز حد عدد العقد", () => {
    const many = Array.from({ length: 130 }, (_, i) => ({ id: `n${i}`, type: "divider", props: {} }));
    const result = validateContent(envelope(many));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("too_many_nodes");
  });

  it("يرفض JSON كبيرًا (حد الحجم)", () => {
    const huge = JSON.stringify({
      schemaVersion: 1,
      blocks: [{ id: "t", type: "text", props: { paragraphs: ["x".repeat(400_000)] } }],
    });
    const result = validateContent(huge);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("content_too_large");
  });

  it("يرفض JSON غير صالح ونوعًا غير مصفوفة", () => {
    expect(validateContent("not json{").ok).toBe(false);
    expect(validateContent('{"a":1}').ok).toBe(false);
    expect(validateContent(42 as unknown).ok).toBe(false);
  });
});

describe("migrateContent — ترحيل columns القديمة", () => {
  it("يحوّل كتلة columns إلى صف/أعمدة بنفس النصوص", () => {
    const legacy = JSON.stringify([
      {
        id: "cols-1",
        type: "columns",
        props: {
          columns: [
            { heading: "رؤيتنا", paragraphs: ["نص الرؤية"] },
            { paragraphs: ["نص بلا عنوان"] },
          ],
        },
      },
    ]);
    const result = migrateContent(JSON.parse(legacy));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = result.envelope.blocks[0];
    expect(row.type).toBe("row");
    expect(row.children).toHaveLength(2);
    const first = row.children![0];
    expect(first.type).toBe("column");
    // العمود الأول: heading + text، والثاني: text فقط
    expect(first.children!.map((c) => c.type)).toEqual(["heading", "text"]);
    expect(first.children![0].props).toMatchObject({ text: "رؤيتنا" });
    expect(row.children![1].children!.map((c) => c.type)).toEqual(["text"]);
  });

  it("الترحيل idempotent — مغلف v1 يعود كما هو", () => {
    const parsed = JSON.parse(validSection);
    const first = migrateContent(parsed);
    const second = migrateContent(JSON.parse(JSON.stringify(first.ok ? first.envelope : {})));
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.envelope).toEqual(first.envelope);
  });

  it("يرفض مصفوفة v0 بنوع غير معروف بدل إسقاطه", () => {
    const result = migrateContent([{ id: "x", type: "mystery" }]);
    expect(result.ok).toBe(false);
  });

  it("يرفض إصدار مغلف أحدث من المدعوم", () => {
    const result = migrateContent({ schemaVersion: 99, blocks: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("schema_version_too_new");
  });
});

describe("أدوات الشجرة", () => {
  const tree = JSON.parse(JSON.parse(validSection).blocks ? validSection : "[]") as never;
  void tree;

  it("countNodes وmaxDepth يحسبان الشجرة كاملة", () => {
    const parsed = JSON.parse(validSection) as { blocks: Parameters<typeof countNodes>[0] };
    expect(countNodes(parsed.blocks)).toBe(6);
    expect(maxDepth(parsed.blocks)).toBe(4);
  });

  it("findNode يعيد العقدة والآباء", () => {
    const parsed = JSON.parse(validSection) as { blocks: Parameters<typeof findNode>[0] };
    const found = findNode(parsed.blocks, "h-1");
    expect(found).not.toBeNull();
    expect(found?.node.type).toBe("heading");
    // الآباء المباشرون فقط — سلسلة الأجداد تُبنى بالاستدعاء المتكرر على siblings
    expect(found?.parent?.type).toBe("column");
    expect(found?.siblings).toHaveLength(1);
  });

  it("cloneWithNewIds يولد معرفات جديدة فريدة", () => {
    const parsed = JSON.parse(validSection) as { blocks: Parameters<typeof findNode>[0] };
    const section = parsed.blocks[0];
    const taken = collectIds(parsed.blocks);
    const copy = cloneWithNewIds(section, taken, () => Math.random().toString(36).slice(2, 6));
    const all = collectIds([copy]);
    for (const id of collectIds(parsed.blocks)) {
      expect(all.has(id)).toBe(false);
    }
    // البنية محفوظة
    expect(countNodes([copy])).toBe(countNodes([section]));
  });

  it("defaultNode ينشئ صفًا بعامودين وكل عقدة تلبي التحقق", () => {
    const taken = new Set<string>();
    const row = defaultNode("row", taken);
    expect(row.children).toHaveLength(2);
    const json = JSON.stringify({ schemaVersion: 1, blocks: [row] });
    const result = validateContent(json);
    expect(result.ok).toBe(true);
  });
});

describe("الأنماط المدركة للأجهزة", () => {
  it("nodeStyleClasses يصدر بادئات md:/lg: للتجاوزات", () => {
    const classes = nodeStyleClasses({
      base: { paddingY: "md", background: "navy" },
      tablet: { paddingY: "sm" },
      desktop: { paddingY: "lg" },
    });
    expect(classes).toContain("py-12");
    expect(classes).toContain("bg-navy");
    expect(classes).toContain("md:py-6");
    expect(classes).toContain("lg:py-20");
  });

  it("effectiveValue يكشف الوراثة وresetDeviceValue يعيد للأساس", () => {
    const style = { base: { paddingY: "md" as const }, tablet: { paddingY: "sm" as const } };
    expect(effectiveValue(style, "tablet", "paddingY")).toEqual({ value: "sm", inherited: false });
    expect(effectiveValue(style, "desktop", "paddingY")).toEqual({ value: "md", inherited: true });
    const reset = resetDeviceValue(style, "tablet", "paddingY");
    expect(effectiveValue(reset, "tablet", "paddingY")).toEqual({ value: "md", inherited: true });
    expect(reset.tablet).toBeUndefined();
  });
});

describe("loadContentForRender — مسارات العرض", () => {
  it("نص فارغ → شجرة فارغة ok", () => {
    expect(loadContentForRender(null)).toEqual({ ok: true, tree: [], migrated: false });
  });
  it("خطأ → فشل صريح", () => {
    expect(loadContentForRender("{{{").ok).toBe(false);
  });
});
