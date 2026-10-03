import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  CLIPBOARD_KEY,
  CLIPBOARD_MAX,
  clearClipboardStorage,
  copyToClipboard,
  pasteEntryNode,
  readClipboard,
  removeFromClipboard,
  type ClipboardEntry,
} from "../blocks/clipboard";
import { collectIds, countNodes, maxDepth, type ContentNode } from "../blocks/tree";

/** محاكاة localStorage — بيئة vitest عقدية بلا window */
function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    map,
  };
}

let storage: ReturnType<typeof fakeLocalStorage>;

beforeEach(() => {
  storage = fakeLocalStorage();
  vi.stubGlobal("window", { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** شجرة تجريبية: قسم يحوي صفًا بعمودين وأنماط أجهزة مختلفة */
function sampleTree(): ContentNode {
  return {
    id: "b-section-1",
    type: "section",
    style: { base: { paddingY: "lg" }, mobile: { paddingY: "sm" }, tablet: { paddingY: "md" } },
    visibility: { mobile: true, tablet: true, desktop: false },
    children: [
      {
        id: "b-row-1",
        type: "row",
        props: { gap: "lg" },
        children: [
          { id: "b-column-1", type: "column", props: { gap: "md", span: "auto", align: "start" }, children: [] },
          { id: "b-heading-1", type: "heading", props: { text: "مرحبا", level: 2, align: "start" } },
        ],
      },
    ],
  };
}

const suffixGen = () => Math.random().toString(36).slice(2, 8);

describe("الحافظة عبر الصفحات — نسخ/لصق (G1)", () => {
  it("round-trip: النسخ ثم القراءة يعيدان لقطة مطابقة للعقدة بأبنائها", () => {
    copyToClipboard(sampleTree());
    const entries = readClipboard();
    expect(entries).toHaveLength(1);
    expect(entries[0].node.type).toBe("section");
    expect(entries[0].node.children?.[0].type).toBe("row");
    expect(entries[0].node.children?.[0].children).toHaveLength(2);
    expect(entries[0].copiedAt).not.toBe("");
  });

  it("اللصق يولد معرفات جديدة فريدة لكل عقدة في الشجرة ولا يفسد الأصل", () => {
    copyToClipboard(sampleTree());
    const [entry] = readClipboard();
    const originalIds = collectIds([sampleTree()]);
    const takenForPaste = new Set(originalIds); // نسخة تتوسع بالمعرفات الجديدة أثناء الاستنساخ
    const pasted = pasteEntryNode(entry, takenForPaste, suffixGen);
    // كل معرف جديد ليس ضمن معرفات الصفحة الأصلية
    for (const id of collectIds([pasted])) expect(originalIds.has(id)).toBe(false);
    // البنية محفوظة: نفس الأنواع وعدد العقد
    expect(countNodes([pasted])).toBe(countNodes([sampleTree()]));
    expect(pasted.type).toBe("section");
  });

  it("أنماط الأجهزة والظهور لكل جهاز تُحفظ عبر النسخ واللصق", () => {
    copyToClipboard(sampleTree());
    const [entry] = readClipboard();
    const pasted = pasteEntryNode(entry, new Set(), suffixGen);
    expect(pasted.style?.base?.paddingY).toBe("lg");
    expect(pasted.style?.mobile?.paddingY).toBe("sm");
    expect(pasted.style?.tablet?.paddingY).toBe("md");
    expect(pasted.visibility?.desktop).toBe(false);
    expect(pasted.visibility?.mobile).toBe(true);
  });

  it("نسخ نفس الجذر مرة ثانية يستبدل المدخل القديم بآخر لقطة", () => {
    const node = sampleTree();
    copyToClipboard(node);
    node.children![0].props = { gap: "xs" };
    copyToClipboard(node);
    const entries = readClipboard();
    expect(entries).toHaveLength(1);
    expect((entries[0].node.children![0].props as { gap: string }).gap).toBe("xs");
  });

  it("السعة القصوى: الأقدم يُسقط عند تجاوز الحد", () => {
    for (let i = 0; i < CLIPBOARD_MAX + 2; i++) {
      const node = sampleTree();
      node.id = `b-section-${i}`;
      copyToClipboard(node);
    }
    const entries = readClipboard();
    expect(entries).toHaveLength(CLIPBOARD_MAX);
    // الأحدث أولًا
    expect(entries[0].node.id).toBe(`b-section-${CLIPBOARD_MAX + 1}`);
  });

  it("قراءة دفاعية: JSON فاسد أو شكل غير متوقع يعيد قائمة فارغة", () => {
    storage.setItem(CLIPBOARD_KEY, "{not json");
    expect(readClipboard()).toEqual([]);
    storage.setItem(CLIPBOARD_KEY, JSON.stringify({ oops: true }));
    expect(readClipboard()).toEqual([]);
    storage.setItem(CLIPBOARD_KEY, JSON.stringify([{ entryId: "x", node: { id: "" } }]));
    expect(readClipboard()).toEqual([]);
    // مدخل صالح وسط فاسدين يُبقى عليه
    copyToClipboard(sampleTree());
    storage.setItem(
      CLIPBOARD_KEY,
      JSON.stringify([{ garbage: 1 }, readClipboard()[0], { entryId: "y", node: null }])
    );
    expect(readClipboard()).toHaveLength(1);
  });

  it("إزالة مدخل واحد وإفراغ الكل يعملان على التخزين الفعلي", () => {
    copyToClipboard(sampleTree());
    copyToClipboard({ ...sampleTree(), id: "b-section-other" });
    let entries: ClipboardEntry[] = readClipboard();
    expect(entries).toHaveLength(2);
    entries = removeFromClipboard(entries[0].entryId);
    expect(readClipboard()).toHaveLength(1);
    clearClipboardStorage();
    expect(readClipboard()).toEqual([]);
    expect(storage.map.has(CLIPBOARD_KEY)).toBe(false);
  });

  it("على الخادم (بلا window) القراءة تعيد [] والكتابة لا تنكسر", () => {
    vi.stubGlobal("window", undefined);
    expect(readClipboard()).toEqual([]);
    expect(() => copyToClipboard(sampleTree())).not.toThrow();
    expect(() => clearClipboardStorage()).not.toThrow();
  });

  it("العمق بعد اللصق يطابق عمق الأصل — الفحص يعتمد maxDepth الصحيح", () => {
    copyToClipboard(sampleTree());
    const [entry] = readClipboard();
    const pasted = pasteEntryNode(entry, new Set(), suffixGen);
    expect(maxDepth([pasted])).toBe(maxDepth([sampleTree()]));
  });
});
