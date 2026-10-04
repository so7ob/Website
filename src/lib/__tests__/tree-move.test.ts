import { describe, expect, it } from "vitest";
import {
  applyNodeMove,
  validateNodeMove,
  type MoveNodeError,
} from "../blocks/tree-move";
import { MAX_TREE_DEPTH, MAX_TREE_NODES, type ContentNode } from "../blocks/tree";

/** شجرة تجريبية: قسمان — الأول يحوي صفًا بعمودين وعنوان، والثاني عمودًا واحدًا */
function sampleTree(): ContentNode[] {
  return [
    {
      id: "sec-1",
      type: "section",
      children: [
        {
          id: "row-1",
          type: "row",
          children: [
            { id: "col-1", type: "column", children: [{ id: "head-1", type: "heading", props: { text: "أ" } }] },
            { id: "col-2", type: "column", children: [] },
          ],
        },
        { id: "head-2", type: "heading", props: { text: "ب" } },
      ],
    },
    {
      id: "sec-2",
      type: "section",
      children: [
        {
          id: "cont-1",
          type: "container",
          children: [{ id: "head-3", type: "heading", props: { text: "ج" } }],
        },
      ],
    },
  ];
}

/** لقطة عميقة لمقارنة نقاء الدالتين (الشجرة الأصلية لا تُمس) */
function snapshot(tree: ContentNode[]): string {
  return JSON.stringify(tree);
}

function errOf(check: ReturnType<typeof validateNodeMove>): MoveNodeError | "ok" {
  return check.ok ? "ok" : check.error;
}

describe("validateNodeMove — التحقق من نقل العقد", () => {
  it("نقل صالح داخل نفس الأب (إعادة ترتيب) يمر بلا إنذارات حتى لو كانت الحاوية ممتلئة", () => {
    // صف بعمودين (ممتلئ نسبيًا) — إعادة ترتيب الأعمدة لا تطالب بقواعد الحاوية
    const tree = sampleTree();
    expect(errOf(validateNodeMove(tree, "col-1", "row-1", 2))).toBe("ok");
  });

  it("نقل صالح عبر الحاويات: عنوان من الجذر إلى حاوية تقبل الأوراق", () => {
    const tree = sampleTree();
    expect(errOf(validateNodeMove(tree, "head-2", "cont-1", 1))).toBe("ok");
  });

  it("نقل إلى الجذر (targetParentId = null) صالح دائمًا لعقدة موجودة", () => {
    const tree = sampleTree();
    expect(errOf(validateNodeMove(tree, "head-3", null, 2))).toBe("ok");
  });

  it("selfDrop: الإفلات على العقدة نفسها كأب يُرفض", () => {
    const tree = sampleTree();
    expect(errOf(validateNodeMove(tree, "sec-1", "sec-1", 0))).toBe("selfDrop");
  });

  it("descendantDrop: الإفلات داخل أحد أبناء العقدة يُرفض (منع الحلقات)", () => {
    const tree = sampleTree();
    // نقل sec-1 إلى داخل row-1 (ابن من أبنائه)
    expect(errOf(validateNodeMove(tree, "sec-1", "row-1", 0))).toBe("descendantDrop");
    // وحتى إلى حفيب عميق
    expect(errOf(validateNodeMove(tree, "sec-1", "col-2", 0))).toBe("descendantDrop");
  });

  it("typeNotAllowed: الأب الهدف غير حاوية أو لا يقبل النوع", () => {
    const tree = sampleTree();
    // الأب الهدف عنوان (ورقية) — لا يستضيف أبناء
    expect(errOf(validateNodeMove(tree, "head-3", "head-2", 0))).toBe("typeNotAllowed");
    // الصف يقبل الأعمدة فقط — لا يقبل عنوانًا قادمًا من أب آخر
    expect(errOf(validateNodeMove(tree, "head-2", "row-1", 0))).toBe("typeNotAllowed");
  });

  it("containerFull: حاوية استنفدت سعة أبنائها ترفض مع إرجاع الحد", () => {
    const tree: ContentNode[] = [
      {
        id: "row-full",
        type: "row",
        children: Array.from({ length: 6 }, (_, i) => ({
          id: `c-${i}`,
          type: "column" as const,
          children: [],
        })),
      },
      { id: "col-x", type: "column", children: [] },
    ];
    const check = validateNodeMove(tree, "col-x", "row-full", 0);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.error).toBe("containerFull");
      expect(check.max).toBe(6);
    }
  });

  it("depthLimit: نقل شجرة عميقة إلى موضع أعمق من الحد يُرفض", () => {
    // سلسلة حاويات بعمق 6 (الحد الأقصى) + فرع متوازٍ حاوياته حتى العمق 4
    const deep: ContentNode = {
      id: "d1",
      type: "section",
      children: [
        {
          id: "d2",
          type: "container",
          children: [
            { id: "d3", type: "container", children: [
              { id: "d4", type: "container", children: [
                { id: "d5", type: "container", children: [
                  { id: "d6", type: "container", children: [] },
                ] },
              ] },
            ] },
          ],
        },
      ],
    };
    const parallel: ContentNode = {
      id: "p1",
      type: "section",
      children: [
        { id: "p2", type: "container", children: [
          { id: "p3", type: "container", children: [
            { id: "p4", type: "container", children: [] },
          ] },
        ] },
      ],
    };
    const tree: ContentNode[] = [deep, parallel, { id: "leaf", type: "heading", props: {} }];
    expect(MAX_TREE_DEPTH).toBe(6);
    // عنوان (شجرة فرعية بعمق 1) داخل d6 على العمق 6 → الهبوط عند 7 > 6
    expect(errOf(validateNodeMove(tree, "leaf", "d6", 0))).toBe("depthLimit");
    // d4 (ارتفاع شجرته 3) داخل p4 على العمق 4 → الهبوط 5 + 3 − 1 = 7 > 6
    expect(errOf(validateNodeMove(tree, "d4", "p4", 0))).toBe("depthLimit");
    // وعنصر تحكم: d6 (ارتفاع 1) داخل p4 → 5 ≤ 6 مقبول
    expect(errOf(validateNodeMove(tree, "d6", "p4", 0))).toBe("ok");
  });

  it("nodesLimit: حارس دفاعي فوق حد العقد الكلي يُرفض", () => {
    const tree: ContentNode[] = Array.from({ length: MAX_TREE_NODES + 1 }, (_, i) => ({
      id: `n-${i}`,
      type: "heading" as const,
      props: {},
    }));
    expect(errOf(validateNodeMove(tree, "n-0", null, 0))).toBe("nodesLimit");
  });

  it("notFound: عقدة أو هدف غير موجود", () => {
    const tree = sampleTree();
    expect(errOf(validateNodeMove(tree, "ghost", null, 0))).toBe("notFound");
    expect(errOf(validateNodeMove(tree, "head-2", "ghost", 0))).toBe("notFound");
  });
});

describe("applyNodeMove — تنفيذ النقل", () => {
  it("إعادة ترتيب في الجذر: النقل لأسفل يهبط بعد الهدف (دلالات arrayMove)", () => {
    const tree = sampleTree();
    const next = applyNodeMove(tree, "sec-1", null, 2); // بعد sec-2
    expect(next.map((n) => n.id)).toEqual(["sec-2", "sec-1"]);
  });

  it("إعادة ترتيب صعودًا: قبل الهدف", () => {
    const tree = sampleTree();
    // head-2 (فهرس 1) يُرفع قبل row-1 (فهرس الهدف 0)
    const next = applyNodeMove(tree, "head-2", "sec-1", 0);
    expect(next[0].children?.map((n) => n.id)).toEqual(["head-2", "row-1"]);
  });

  it("نقل عبر الحاويات: العقدة تصل مكانها بشجرتها وخصائصها كاملة وبمعرفاتها الأصلية", () => {
    const tree = sampleTree();
    const next = applyNodeMove(tree, "head-2", "cont-1", 1);
    const cont = next[1].children?.[0];
    expect(cont?.children?.map((n) => n.id)).toEqual(["head-3", "head-2"]);
    // الشجرة الفرعية المنقولة سليمة (لا أبناء لعنوان — لكن الخصائص تحفظ)
    const moved = cont?.children?.[1];
    expect(moved?.props).toEqual({ text: "ب" });
  });

  it("الفهرس يُمشَّط للحدود: 999 يعني النهاية وسالب يعني البداية", () => {
    const tree = sampleTree();
    expect(applyNodeMove(tree, "head-2", "sec-1", 999)[0].children?.at(-1)?.id).toBe("head-2");
    const next = applyNodeMove(tree, "head-2", "sec-1", -5);
    expect(next[0].children?.[0]?.id).toBe("head-2");
  });

  it("النقل إلى أب غير صالح يعيد المرجع نفسه دون تغيير (فشل هادئ متعاقد عليه)", () => {
    const tree = sampleTree();
    expect(applyNodeMove(tree, "sec-1", "row-1", 0)).toBe(tree); // descendantDrop
    expect(applyNodeMove(tree, "ghost", null, 0)).toBe(tree); // notFound
  });

  it("النقاء: الشجرة الأصلية لا تُمس إطلاقًا", () => {
    const tree = sampleTree();
    const before = snapshot(tree);
    applyNodeMove(tree, "head-2", "cont-1", 1);
    applyNodeMove(tree, "col-1", "row-1", 2);
    applyNodeMove(tree, "head-3", null, 0);
    expect(snapshot(tree)).toBe(before);
  });

  it("النقل لا يولد معرفات جديدة عكس اللصق — العدد الكلي ثابت", () => {
    const tree = sampleTree();
    const before = snapshot(tree);
    const next = applyNodeMove(tree, "head-3", "sec-1", 2);
    expect(snapshot(next)).not.toBe(before);
    // جمع المعرفات قبل وبعد متطابق (نفس المعرفات، ترتيب مختلف)
    const ids = (nodes: ContentNode[]): string[] => {
      const out: string[] = [];
      const walk = (list: ContentNode[]) => {
        for (const n of list) {
          out.push(n.id);
          if (n.children) walk(n.children);
        }
      };
      walk(nodes);
      return out.sort();
    };
    expect(ids(next)).toEqual(ids(tree));
  });
});
