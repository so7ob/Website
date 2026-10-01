import { describe, it, expect } from "vitest";
import { checkRateLimit, isDuplicate, fingerprint, memoryStore } from "@/lib/ratelimit";

const LIMITS = { shortMax: 3, shortWindowMs: 10 * 60 * 1000, dailyMax: 8, dailyWindowMs: 24 * 60 * 60 * 1000 };

describe("checkRateLimit — حد المعدل", () => {
  it("يسمح حتى الحد القصير ثم يمنع مع زمن إعادة محاولة", () => {
    const store = memoryStore();
    const t0 = 1_000_000;
    expect(checkRateLimit(store, "k", t0, LIMITS).allowed).toBe(true);
    expect(checkRateLimit(store, "k", t0 + 1, LIMITS).allowed).toBe(true);
    expect(checkRateLimit(store, "k", t0 + 2, LIMITS).allowed).toBe(true);
    const blocked = checkRateLimit(store, "k", t0 + 3, LIMITS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(LIMITS.shortWindowMs / 1000);
  });

  it("يعيد السماح بعد انقضاء النافذة القصيرة", () => {
    const store = memoryStore();
    const t0 = 2_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit(store, "k", t0 + i, LIMITS);
    expect(checkRateLimit(store, "k", t0 + 3, LIMITS).allowed).toBe(false);
    // بعد النافذة القصيرة (10 دقائق)
    const after = checkRateLimit(store, "k", t0 + LIMITS.shortWindowMs + 1, LIMITS);
    expect(after.allowed).toBe(true);
  });

  it("يمنع بعد تجاوز الحد اليومي حتى لو تباعدت المحاولات", () => {
    const store = memoryStore();
    const t0 = 3_000_000;
    let last = { allowed: true, retryAfterSec: 0 };
    for (let i = 0; i < 8; i++) last = checkRateLimit(store, "k", t0 + i * 60 * 60 * 1000, LIMITS);
    expect(last.allowed).toBe(true); // الثامنة ضمن اليومي
    const ninth = checkRateLimit(store, "k", t0 + 8 * 60 * 60 * 1000, LIMITS);
    expect(ninth.allowed).toBe(false);
  });

  it("يعزل المفاتيح عن بعضها", () => {
    const store = memoryStore();
    const t0 = 4_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit(store, "a", t0 + i, LIMITS);
    expect(checkRateLimit(store, "a", t0 + 5, LIMITS).allowed).toBe(false);
    expect(checkRateLimit(store, "b", t0 + 5, LIMITS).allowed).toBe(true);
  });
});

describe("isDuplicate — منع الإرسال المتكرر", () => {
  const now = 10_000_000;
  const hash1 = fingerprint("نص الطلب الأول");
  const hash2 = fingerprint("نص مختلف تمامًا عن الأول");

  it("يكشف نفس البريد ونفس الوصف داخل النافذة", () => {
    const recent = [{ email: "A@Example.com ", descriptionHash: hash1, createdAt: now - 5 * 60 * 1000 }];
    expect(isDuplicate(recent, "a@example.com", hash1, now)).toBe(true);
  });

  it("يسمح بنفس البريد مع وصف مختلف", () => {
    const recent = [{ email: "a@example.com", descriptionHash: hash1, createdAt: now - 5 * 60 * 1000 }];
    expect(isDuplicate(recent, "a@example.com", hash2, now)).toBe(false);
  });

  it("يسمح بعد انقضاء النافذة (30 دقيقة افتراضيًا)", () => {
    const recent = [{ email: "a@example.com", descriptionHash: hash1, createdAt: now - 31 * 60 * 1000 }];
    expect(isDuplicate(recent, "a@example.com", hash1, now)).toBe(false);
  });

  it("يتجاهل اختلاف حالة الأحرف والمسافات في البريد", () => {
    const recent = [{ email: "  user@site.com", descriptionHash: hash1, createdAt: now - 1000 }];
    expect(isDuplicate(recent, "USER@site.com ", hash1, now)).toBe(true);
  });

  it("يبني بصمات مستقرة للنص نفسه ومختلفة للنصوص المختلفة", () => {
    expect(fingerprint("  نص  ")).toBe(fingerprint("نص"));
    expect(fingerprint("نص")).not.toBe(fingerprint("نص آخر"));
  });
});
