/**
 * اختبارات جولة 35 (§D جدولة النشر):
 * - parseScheduleInput: مدخل الموعد (ISO صالح، مهلة دنيا، أفق أقصى، رفض الشوائب)
 * - decideScheduledPublish: قرار التنفيذ عند الاستحقاق (مراجعة مطابقة/متعارضة، أرشفة، حالة شاذة)
 * كلاهما خالص (لا قاعدة بيانات) — الاختبار حتمي بتاريخ الآن صريح.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_SCHEDULE_HORIZON_MS,
  MIN_SCHEDULE_LEAD_MS,
  decideScheduledPublish,
  parseScheduleInput,
} from "@/lib/pages/schedule";

const NOW = new Date("2026-01-15T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;

describe("parseScheduleInput — تحقق مدخل الجدولة", () => {
  it("موعد مستقبلي صالح يُقبل ويحفظ اللحظة", () => {
    const iso = new Date(NOW.getTime() + HOUR).toISOString();
    const r = parseScheduleInput(iso, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date.toISOString()).toBe(iso);
  });

  it("سلاسل غير صالحة تُرفض invalid_time", () => {
    expect(parseScheduleInput(null, NOW)).toEqual({ ok: false, code: "invalid_time" });
    expect(parseScheduleInput(undefined, NOW)).toEqual({ ok: false, code: "invalid_time" });
    expect(parseScheduleInput(123, NOW)).toEqual({ ok: false, code: "invalid_time" });
    expect(parseScheduleInput("", NOW)).toEqual({ ok: false, code: "invalid_time" });
    expect(parseScheduleInput("   ", NOW)).toEqual({ ok: false, code: "invalid_time" });
    expect(parseScheduleInput("بكرة الصبح", NOW)).toEqual({ ok: false, code: "invalid_time" });
    expect(parseScheduleInput("2026-13-45T99:99", NOW)).toEqual({ ok: false, code: "invalid_time" });
  });

  it("الماضي وأقل من المهلة الدنيا يُرفضان past_time", () => {
    const past = new Date(NOW.getTime() - HOUR).toISOString();
    expect(parseScheduleInput(past, NOW)).toEqual({ ok: false, code: "past_time" });

    // أقل من المهلة (10 ثوانٍ < 30 ثانية)
    const tooSoon = new Date(NOW.getTime() + 10_000).toISOString();
    expect(parseScheduleInput(tooSoon, NOW)).toEqual({ ok: false, code: "past_time" });
  });

  it("عند حدود المهلة الدنيا: المساواة تُقبل وما دونها يُرفض", () => {
    expect(MIN_SCHEDULE_LEAD_MS).toBe(30_000);
    const exact = new Date(NOW.getTime() + MIN_SCHEDULE_LEAD_MS).toISOString();
    expect(parseScheduleInput(exact, NOW).ok).toBe(true);
    const justUnder = new Date(NOW.getTime() + MIN_SCHEDULE_LEAD_MS - 1).toISOString();
    expect(parseScheduleInput(justUnder, NOW)).toEqual({ ok: false, code: "past_time" });
  });

  it("الأفق الأقصى (سنتان) يُرفض far_future وما داخله يُقبل", () => {
    expect(MAX_SCHEDULE_HORIZON_MS).toBe(2 * 365 * 24 * HOUR);
    const inside = new Date(NOW.getTime() + MAX_SCHEDULE_HORIZON_MS).toISOString();
    expect(parseScheduleInput(inside, NOW).ok).toBe(true);
    const beyond = new Date(NOW.getTime() + MAX_SCHEDULE_HORIZON_MS + 1).toISOString();
    expect(parseScheduleInput(beyond, NOW)).toEqual({ ok: false, code: "far_future" });
  });
});

describe("decideScheduledPublish — قرار التنفيذ عند الاستحقاق", () => {
  const base = { status: "published", draftRevision: 7, scheduledRevision: 7 as number | null };

  it("مراجعة مطابقة وصفحة مستحقة → publish", () => {
    expect(decideScheduledPublish(base, NOW, new Date(NOW.getTime() - 1000)).action).toBe("publish");
  });

  it("المسودة تغيرت بعد الجدولة → skip revision_conflict (لا يُنشر شيء لم يوافق عليه صاحب الجدولة)", () => {
    const r = decideScheduledPublish({ ...base, draftRevision: 9 }, NOW, new Date(NOW.getTime() - 1000));
    expect(r).toEqual({ action: "skip", reason: "revision_conflict" });
  });

  it("الصفحة المؤرشفة لا تُنشر → skip archived", () => {
    const r = decideScheduledPublish({ ...base, status: "archived" }, NOW, new Date(NOW.getTime() - 1000));
    expect(r).toEqual({ action: "skip", reason: "archived" });
  });

  it("حالة شاذة: بلا مراجعة مجدولة أو لم يستحق الموعد بعد → skip invalid_state", () => {
    expect(
      decideScheduledPublish({ ...base, scheduledRevision: null }, NOW, new Date(NOW.getTime() - 1000))
    ).toEqual({ action: "skip", reason: "invalid_state" });
    expect(
      decideScheduledPublish(base, NOW, new Date(NOW.getTime() + 60_000)).action
    ).toBe("skip");
  });
});
