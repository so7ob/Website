import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertSameOrigin } from "../auth/session";

/** بناء طلب بترويسات محددة */
function req(headers: Record<string, string>, url = "http://localhost:3000/api/admin/settings"): NextRequest {
  return new NextRequest(url, { method: "PATCH", headers });
}

describe("assertSameOrigin — واعٍ بالبروكسي", () => {
  it("يتعتمد على sec-fetch-site نفس-الأصل حتى لو Host أُعيدت كتابته", () => {
    const r = req({ "sec-fetch-site": "same-origin", origin: "https://public.example.com", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(true);
  });

  it("يقبل same-site (نطاق فرعي لنفس الموقع)", () => {
    const r = req({ "sec-fetch-site": "same-site", origin: "https://app.example.com", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(true);
  });

  it("يقبل none (تنقل مباشر) — لا خطر CSRF", () => {
    const r = req({ "sec-fetch-site": "none", origin: "https://public.example.com", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(true);
  });

  it("يرفض cross-site دائمًا (طلب موقع آخر)", () => {
    const r = req({ "sec-fetch-site": "cross-site", origin: "https://attacker.example.com", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(false);
  });

  it("يرفض cross-site حتى لو Origin مطابق ظاهريًا — الإشارة أقوى", () => {
    const r = req({ "sec-fetch-site": "cross-site", origin: "https://localhost:3000", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(false);
  });

  it("بلا sec-fetch-site: يطابق Origin مع x-forwarded-host (أول قيمة في قائمة مفصولة)", () => {
    const r = req({
      origin: "https://public.example.com",
      "x-forwarded-host": "public.example.com, inner.local",
      host: "localhost:3000",
    });
    expect(assertSameOrigin(r)).toBe(true);
  });

  it("بلا sec-fetch-site: يطابق Origin مع Host المباشر", () => {
    const r = req({ origin: "http://localhost:3000", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(true);
  });

  it("بلا sec-fetch-site: يرفض Origin غريبًا عن كل المضيفات", () => {
    const r = req({ origin: "https://attacker.example.com", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(false);
  });

  it("بلا Origin إطلاقًا (curl/عملاء خارجيون) — سماح، الحماية من SameSite cookies", () => {
    const r = req({ host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(true);
  });

  it("Origin مشوه — رفض صامت", () => {
    const r = req({ origin: "::not-a-url::", host: "localhost:3000" });
    expect(assertSameOrigin(r)).toBe(false);
  });
});
