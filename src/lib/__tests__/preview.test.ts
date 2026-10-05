/**
 * اختبارات ربط المعاينة بالمصدر — خارطة الطريق 5.5 (G11):
 * - parseRevisionParam: غياب/فراغ → مسودة، صحيح ≥1 → رقم، شوائب → غير صالح
 * - resolvePreviewSource: مسودة اللغة الصحيحة، لقطة الإصدار ببياناتها،
 *   إصدار غير موجود للغة، وبارامتر غير صالح يسبق أي استعلام (المُحقن لا يُستدعى)
 * دوال خالصة بمُحقن جلب — بلا قاعدة بيانات، حتمية بالكامل.
 */
import { describe, expect, it, vi } from "vitest";
import {
  parseRevisionParam,
  resolvePreviewSource,
  previewSourceErrorKind,
  type PreviewVersionRecord,
} from "@/lib/pages/preview";

const PAGE = { draftBlocksAr: "[{\"type\":\"heroAr\"}]", draftBlocksEn: "[{\"type\":\"heroEn\"}]" };
const PAGE_ID = "page-1";

const RECORD: PreviewVersionRecord = {
  version: 2,
  blocks: "[{\"type\":\"v2\"}]",
  note: "قبل تعديل الخدمات",
  authorName: "مدير الموقع",
  createdAt: new Date("2026-10-01T09:00:00.000Z"),
};

function makeFetcher(record: PreviewVersionRecord | null) {
  return vi.fn(async (_pageId: string, _locale: string, _version: number): Promise<PreviewVersionRecord | null> => record);
}

describe("parseRevisionParam — تحليل بارامتر المعاينة", () => {
  it("الغياب والفراغ والفراغات البيضاء تعني معاينة المسودة (null)", () => {
    expect(parseRevisionParam(undefined)).toBeNull();
    expect(parseRevisionParam(null)).toBeNull();
    expect(parseRevisionParam("")).toBeNull();
    expect(parseRevisionParam("   ")).toBeNull();
  });

  it("عدد صحيح موجب يُقبل", () => {
    expect(parseRevisionParam("1")).toBe(1);
    expect(parseRevisionParam("42")).toBe(42);
    expect(parseRevisionParam(" 7 ")).toBe(7);
  });

  it("الصفر والسالب والكسور والنصوص والأعداد غير الآمنة تُرفض صراحةً", () => {
    expect(parseRevisionParam("0")).toBe("invalid");
    expect(parseRevisionParam("-2")).toBe("invalid");
    expect(parseRevisionParam("1.5")).toBe("invalid");
    expect(parseRevisionParam("abc")).toBe("invalid");
    expect(parseRevisionParam("12abc")).toBe("invalid");
    expect(parseRevisionParam("99999999999999999999")).toBe("invalid"); // خارج Number.isSafeInteger
    expect(parseRevisionParam("٣")).toBe("invalid"); // أرقام عربية-هندية لا تُقبل
  });
});

describe("resolvePreviewSource — ربط المعاينة بمصدرها", () => {
  it("بلا بارامتر: مسودة العربية", async () => {
    const fetcher = makeFetcher(null);
    const source = await resolvePreviewSource(PAGE, { pageId: PAGE_ID, locale: "ar", revisionParam: undefined, fetchVersion: fetcher });
    expect(source).toEqual({ kind: "draft", blocksJson: PAGE.draftBlocksAr });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("بلا بارامتر: مسودة الإنجليزية", async () => {
    const source = await resolvePreviewSource(PAGE, { pageId: PAGE_ID, locale: "en", revisionParam: null, fetchVersion: makeFetcher(null) });
    expect(source).toEqual({ kind: "draft", blocksJson: PAGE.draftBlocksEn });
  });

  it("إصدار موجود يعيد اللقطة ببياناتها الكاملة", async () => {
    const source = await resolvePreviewSource(PAGE, { pageId: PAGE_ID, locale: "ar", revisionParam: "2", fetchVersion: makeFetcher(RECORD) });
    expect(source).toEqual({
      kind: "version",
      blocksJson: RECORD.blocks,
      meta: { version: 2, note: RECORD.note, authorName: RECORD.authorName, createdAt: RECORD.createdAt },
    });
  });

  it("إصدار غير موجود (أو موجود للغة أخرى فقط) → version_not_found", async () => {
    const source = await resolvePreviewSource(PAGE, { pageId: PAGE_ID, locale: "en", revisionParam: "2", fetchVersion: makeFetcher(null) });
    expect(source).toEqual({ kind: "version_not_found" });
  });

  it("بارامتر غير صالح يُرفض قبل أي استعلام — المُحقن لا يُستدعى إطلاقًا", async () => {
    const fetcher = makeFetcher(RECORD);
    for (const bad of ["0", "abc", "-3", "1.5"]) {
      const source = await resolvePreviewSource(PAGE, { pageId: PAGE_ID, locale: "ar", revisionParam: bad, fetchVersion: fetcher });
      expect(source).toEqual({ kind: "invalid_revision" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("previewSourceErrorKind — تصنيف أخطاء الربط", () => {
  it("يرجع نوع الخطأ فقط للحالتين الصريحتين", async () => {
    expect(previewSourceErrorKind({ kind: "invalid_revision" })).toBe("invalid_revision");
    expect(previewSourceErrorKind({ kind: "version_not_found" })).toBe("version_not_found");
    expect(previewSourceErrorKind({ kind: "draft", blocksJson: "[]" })).toBeNull();
    expect(
      previewSourceErrorKind({ kind: "version", blocksJson: "[]", meta: { version: 1, note: null, authorName: "—", createdAt: new Date() } })
    ).toBeNull();
  });
});
