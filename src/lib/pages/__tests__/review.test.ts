import { describe, expect, it } from "vitest";
import {
  REVIEW_NOTE_MAX,
  canReviewDecision,
  canSubmitForReview,
  isSaveLocked,
  normalizeReviewNote,
} from "../review";

describe("دورة المراجعة — انتقالات الحالة", () => {
  it("الإرسال للمراجعة جائز من المسودة والمنشورة فقط", () => {
    expect(canSubmitForReview("draft")).toBe(true);
    expect(canSubmitForReview("published")).toBe(true);
    expect(canSubmitForReview("in_review")).toBe(false);
    expect(canSubmitForReview("archived")).toBe(false);
    expect(canSubmitForReview("")).toBe(false);
    expect(canSubmitForReview("unknown")).toBe(false);
  });

  it("قرار المراجعة جائز من قيد المراجعة فقط", () => {
    expect(canReviewDecision("in_review")).toBe(true);
    expect(canReviewDecision("draft")).toBe(false);
    expect(canReviewDecision("published")).toBe(false);
    expect(canReviewDecision("archived")).toBe(false);
  });

  it("قفل الحفظ الآلي أثناء المراجعة فقط", () => {
    expect(isSaveLocked("in_review")).toBe(true);
    expect(isSaveLocked("draft")).toBe(false);
    expect(isSaveLocked("published")).toBe(false);
    expect(isSaveLocked("archived")).toBe(false);
  });
});

describe("دورة المراجعة — تطبيع الملاحظة", () => {
  it("الفراغ والغائب يعيدان null (الملاحظة اختيارية)", () => {
    expect(normalizeReviewNote(undefined)).toBeNull();
    expect(normalizeReviewNote(null)).toBeNull();
    expect(normalizeReviewNote("   ")).toBeNull();
    expect(normalizeReviewNote("")).toBeNull();
  });

  it("النص الصالح يُقصّ أطرافه ويعاد كما هو", () => {
    expect(normalizeReviewNote("  أضف مصدرًا للإحصاءات  ")).toBe("أضف مصدرًا للإحصاءات");
  });

  it("النص الأطول من الحد يُقصّ لا يُرفض (القص آمن ويطابق سلوك الحفظ)", () => {
    const long = "م".repeat(REVIEW_NOTE_MAX + 120);
    const out = normalizeReviewNote(long);
    expect(out).not.toBeNull();
    expect(out?.length).toBe(REVIEW_NOTE_MAX);
  });

  it("النوع غير النصي يُرفض صراحة — لا كتابة صامتة", () => {
    expect(() => normalizeReviewNote(42)).toThrow(TypeError);
    expect(() => normalizeReviewNote({ note: "x" })).toThrow(TypeError);
    expect(() => normalizeReviewNote(["a"])).toThrow(TypeError);
  });
});
