import { describe, it, expect } from "vitest";
import { portalAr } from "@/content/portal/ar";
import { portalEn } from "@/content/portal/en";

/** تكافؤ ترجمات المنصة — بنية واحدة بين العربية والإنجليزية */

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => collectKeys(v, `${prefix}[${i}]`));
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => collectKeys(v, prefix ? `${prefix}.${k}` : k));
}

function collectLeaves(obj: unknown): string[] {
  if (typeof obj !== "object" || obj === null) return [String(obj)];
  if (Array.isArray(obj)) return obj.flatMap(collectLeaves);
  return Object.values(obj as Record<string, unknown>).flatMap(collectLeaves);
}

describe("i18n parity — ترجمات المنصة (portal)", () => {
  it("نفس المفاتيح بين اللغتين", () => {
    const arKeys = collectKeys(portalAr).sort();
    const enKeys = collectKeys(portalEn).sort();
    expect(enKeys).toEqual(arKeys);
  });

  it("لا نص فارغ في أي لغة", () => {
    for (const leaf of [...collectLeaves(portalAr), ...collectLeaves(portalEn)]) {
      expect(leaf.trim().length).toBeGreaterThan(0);
    }
  });

  it("النصوص العربية فعلاً عربية والإنجليزية فعلاً إنجليزية (عينة)", () => {
    expect(portalAr.auth.loginButton).toMatch(/[\u0600-\u06FF]/);
    expect(portalEn.auth.loginButton).toMatch(/[a-z]/i);
    // رموز الحالات كاملة ومتطابقة بين اللغتين
    expect(Object.keys(portalAr.admin.requests.statuses)).toEqual(Object.keys(portalEn.admin.requests.statuses));
    expect(Object.keys(portalAr.account.requests.services)).toEqual(Object.keys(portalEn.account.requests.services));
  });
});
