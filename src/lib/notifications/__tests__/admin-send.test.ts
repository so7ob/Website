import { describe, expect, it } from "vitest";
import {
  ADMIN_NOTIFICATION_LIMITS,
  normalizeRecipientEmail,
  normalizeAdminNotificationSubject,
  normalizeAdminNotificationMessage,
} from "../admin-send";

describe("normalizeRecipientEmail", () => {
  it("يقص الفراغ ويوحّد حالة الأحرف", () => {
    expect(normalizeRecipientEmail("  Admin@So7ob.LOCAL  ")).toBe("admin@so7ob.local");
  });

  it("يقبل البريد الصحيح ويرفض غير النصي", () => {
    expect(normalizeRecipientEmail("support@so7ob.local")).toBe("support@so7ob.local");
    expect(normalizeRecipientEmail(undefined)).toBeNull();
    expect(normalizeRecipientEmail(null)).toBeNull();
    expect(normalizeRecipientEmail(42)).toBeNull();
  });

  it("يرفض البريد المشوه والطويل جدًا والفارغ", () => {
    expect(normalizeRecipientEmail("not-an-email")).toBeNull();
    expect(normalizeRecipientEmail("missing-at.example.com")).toBeNull();
    expect(normalizeRecipientEmail("")).toBeNull();
    expect(normalizeRecipientEmail("   ")).toBeNull();
    expect(normalizeRecipientEmail(`a@${"x".repeat(210)}.com`)).toBeNull();
  });
});

describe("normalizeAdminNotificationSubject", () => {
  it("يقص الفراغ الطرفي ويقبل موضوعًا سليمًا", () => {
    expect(normalizeAdminNotificationSubject("  تحديث حالة الطلب  ")).toBe("تحديث حالة الطلب");
  });

  it("يرفض الأقل من الحد الأدنى ويرفض الفراغ", () => {
    expect(normalizeAdminNotificationSubject("")).toBeNull();
    expect(normalizeAdminNotificationSubject("   ")).toBeNull();
    expect(normalizeAdminNotificationSubject("ab")).toBeNull(); // أقل من subjectMin=3
    expect(normalizeAdminNotificationSubject("abc")).toBe("abc");
  });

  it("يقص فوق الحد الأقصى", () => {
    const long = "م".repeat(ADMIN_NOTIFICATION_LIMITS.subjectMax + 50);
    const out = normalizeAdminNotificationSubject(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(ADMIN_NOTIFICATION_LIMITS.subjectMax);
  });

  it("يرمي TypeError على النوع غير النصي (سوء استخدام برمجي)", () => {
    expect(() => normalizeAdminNotificationSubject(123 as unknown as string)).toThrow(TypeError);
    expect(() => normalizeAdminNotificationSubject(undefined as unknown as string)).toThrow(TypeError);
  });
});

describe("normalizeAdminNotificationMessage", () => {
  it("يقبل نصًا سليمًا ويقص الفراغ", () => {
    expect(normalizeAdminNotificationMessage("  مرحبًا، هذا إشعار تجريبي  ")).toBe("مرحبًا، هذا إشعار تجريبي");
  });

  it("يرفض الأقل من الحد الأدنى (10) والفراغ", () => {
    expect(normalizeAdminNotificationMessage("قصير")).toBeNull();
    expect(normalizeAdminNotificationMessage("")).toBeNull();
    const exactly = "خ".repeat(ADMIN_NOTIFICATION_LIMITS.messageMin);
    expect(normalizeAdminNotificationMessage(exactly)).toBe(exactly);
  });

  it("يقص فوق الحد الأقصى (5000)", () => {
    const long = "ن".repeat(ADMIN_NOTIFICATION_LIMITS.messageMax + 100);
    const out = normalizeAdminNotificationMessage(long);
    expect(out!.length).toBe(ADMIN_NOTIFICATION_LIMITS.messageMax);
  });

  it("يرمي TypeError على النوع غير النصي", () => {
    expect(() => normalizeAdminNotificationMessage({} as unknown as string)).toThrow(TypeError);
  });
});
