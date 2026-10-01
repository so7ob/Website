import { describe, it, expect } from "vitest";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import type { SiteContent } from "@/content/types";

/** يستخرج خريطة المفاتيح الورقية لأي كائن */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

/** يزيل الفهارس الرقمية من المسارات لمقارنة بنية القوائم طولًا ونوعًا */
function normalize(paths: string[]): string[] {
  return paths.map((p) => p.replace(/\.\d+/g, ".*")).sort();
}

describe("تكافؤ الترجمات — العربية والإنجليزية", () => {
  const arPaths = normalize(keyPaths(ar as unknown as SiteContent));
  const enPaths = normalize(keyPaths(en as unknown as SiteContent));

  it("يطابق بنية المفاتيح بين النسختين تمامًا", () => {
    expect(enPaths).toEqual(arPaths);
  });

  it("لا يحتوي أي نص عربي في النسخة الإنجليزية (عدا اسم العلامة العربي المقصود)", () => {
    const arabic = /[\u0600-\u06FF]/;
    const offenders: string[] = [];
    const walk = (obj: unknown, path: string) => {
      if (typeof obj === "string") {
        if (arabic.test(obj) && !path.endsWith("nameAr") && !obj.includes("سُحُب")) offenders.push(path);
      } else if (obj && typeof obj === "object") {
        Object.entries(obj).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
      }
    };
    walk(en, "");
    expect(offenders).toEqual([]);
  });

  it("لا يحتوي أي نص إنجليزي بعلامات لاتينية في العناوين العربية الرئيسية", () => {
    // صحة اتجاه العناوين: العنوان الرئيسي عربي بالكامل
    expect(/^[\u0600-\u06FF\s.،!?—-]+$/.test(ar.home.hero.title + " " + ar.home.hero.titleAccent)).toBe(true);
  });

  it("يحتوي النسختان على 9 أسئلة شائعة و6 خدمات و3 حالات أعمال", () => {
    expect(ar.faq.items).toHaveLength(9);
    expect(en.faq.items).toHaveLength(9);
    expect(ar.services.items).toHaveLength(6);
    expect(en.services.items).toHaveLength(6);
    expect(ar.works.cases).toHaveLength(3);
    expect(en.works.cases).toHaveLength(3);
  });

  it("متطابقة مفاتيح الخدمات بين المحتوى وقوائم النموذج", () => {
    const serviceKeys = ar.services.items.map((s) => s.service).sort();
    const formKeys = Object.keys(ar.form.services).filter((k) => k !== "unsure").sort();
    expect(serviceKeys).toEqual(formKeys);
  });
});

describe("سلامة المحتوى العربي — الصدق", () => {
  it("لا يذكر أرقام إنجازات أو عملاء أو سنوات خبرة", () => {
    const all = JSON.stringify(ar);
    for (const banned of ["سنوات خبرة", "عملاؤنا", "أكثر من [0-9]+ عميل", "نسبة رضا"]) {
      expect(all).not.toMatch(new RegExp(banned));
    }
  });

  it("لا يحتوي نصوصًا تجريبية", () => {
    const all = JSON.stringify({ ar, en });
    expect(all.toLowerCase()).not.toContain("lorem ipsum");
  });
});
