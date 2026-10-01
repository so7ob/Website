import { describe, it, expect } from "vitest";
import { validateProjectRequest, LIMITS, type ProjectRequestInput } from "@/lib/validation";

const BASE: ProjectRequestInput = {
  requestType: "discussion",
  serviceType: "web",
  description: "نريد موقعًا تعريفيًا لشركتنا مع نموذج استقبال طلبات يعمل بالعربية والإنجليزية.",
  budget: "unspecified",
  currency: "",
  timeline: "flexible",
  name: "سالم العمري",
  company: "",
  email: "salem@example.com",
  phone: "",
  preferredContact: "email",
  referenceUrl: "",
  website: "",
  startedAt: Date.now() - 10_000,
  locale: "ar",
};

function input(overrides: Partial<ProjectRequestInput> = {}) {
  return { ...BASE, ...overrides };
}

describe("validateProjectRequest — الحقول المطلوبة", () => {
  it("يقبل طلبًا مكتملًا صحيحًا", () => {
    const r = validateProjectRequest(input());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe("salem@example.com");
  });

  it("يرفض الحقول المطلوبة الفارغة برمز required", () => {
    const r = validateProjectRequest(input({ name: "", email: "", description: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBe("required");
      expect(r.errors.email).toBe("required");
      expect(r.errors.description).toBe("required");
    }
  });

  it("يرفض قيمًا خارج القوائم المعتمدة", () => {
    const r = validateProjectRequest(input({ requestType: "hacking" as never, budget: "million" as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.requestType).toBe("required");
      expect(r.errors.budget).toBe("required");
    }
  });
});

describe("validateProjectRequest — الوصف", () => {
  it("يرفض وصفًا أقصر من الحد الأدنى", () => {
    const r = validateProjectRequest(input({ description: "وصف قصير" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.description).toBe("descriptionShort");
  });

  it("يقبل وصفًا عند الحد الأدنى تمامًا", () => {
    const desc = "أ".repeat(LIMITS.descriptionMin);
    const r = validateProjectRequest(input({ description: desc }));
    expect(r.ok).toBe(true);
  });

  it("يرفض وصفًا أطول من الحد الأقصى", () => {
    const r = validateProjectRequest(input({ description: "أ".repeat(LIMITS.descriptionMax + 1) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.description).toBe("descriptionLong");
  });
});

describe("validateProjectRequest — الميزانية والعملة", () => {
  it("يطلب العملة عند تحديد ميزانية غير «لم أحدد»", () => {
    const r = validateProjectRequest(input({ budget: "tier2", currency: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.currency).toBe("currencyRequired");
  });

  it("لا يطلب عملة عند «لم أحدد بعد» حتى لو أُرسلت قيمة", () => {
    const r = validateProjectRequest(input({ budget: "unspecified", currency: "USD" as never }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.currency).toBe("");
  });

  it("يقبل عملة من القائمة مع ميزانية محددة", () => {
    const r = validateProjectRequest(input({ budget: "tier1", currency: "SAR" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.currency).toBe("SAR");
  });
});

describe("validateProjectRequest — البريد والهاتف", () => {
  it.each(["plain", "a@b", "missing-at.example", "spaces in@mail.com"])("يرفض بريدًا غير صحيح: %s", (bad) => {
    const r = validateProjectRequest(input({ email: bad }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBe("invalidEmail");
  });

  it("يرفض هاتفًا بحروف أو أقصر من المعقول", () => {
    const r = validateProjectRequest(input({ phone: "abc12" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.phone).toBe("invalidPhone");
  });

  it("يقبل هاتفًا بصيغة دولية", () => {
    const r = validateProjectRequest(input({ phone: "+966 50 123 4567", preferredContact: "phone" }));
    expect(r.ok).toBe(true);
  });

  it("يطلب رقمًا عند اختيار الهاتف وسيلةً مفضلة", () => {
    const r = validateProjectRequest(input({ preferredContact: "phone", phone: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.preferredContact).toBe("phoneRequiredForPreferred");
  });
});

describe("validateProjectRequest — الروابط والحماية", () => {
  it("يرفض رابطًا مرجعيًا ليس http/https", () => {
    const r = validateProjectRequest(input({ referenceUrl: "javascript:alert(1)" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.referenceUrl).toBe("invalidUrl");
  });

  it("يقبل رابطًا مرجعيًا صحيحًا", () => {
    const r = validateProjectRequest(input({ referenceUrl: "https://example.com/brief" }));
    expect(r.ok).toBe(true);
  });

  it("يمرر حقل العسل الممتلئ إلى كاشف البوتات (يُحسم في الخادم)", () => {
    const r = validateProjectRequest(input({ website: "spam-link.example" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.website).toBe("spam-link.example");
  });
});
