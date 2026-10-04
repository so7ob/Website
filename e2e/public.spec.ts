/**
 * اختبارات قبول الواجهات العامة — الطور 3.1 (G8).
 *
 * العقود: التحويل اللغوي، العلامة بالغتين، بوابة التتبع،
 * sitemap وrobots، ونقطة جاهزية الصحة.
 */
import { expect, test } from "@playwright/test";

test.describe("الواجهات العامة والعقود التسويقية للبحث", () => {
  test("الجذر / يوجَّه إلى المسار اللغوي المناسب", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(ar|en)(\/|$)/, { timeout: 30_000 });
  });

  test("/ar يعرض العلامة الكاملة بعنوان رئيسي", async ({ page }) => {
    await page.goto("/ar");
    await expect(page).toHaveURL(/\/ar\/?$/);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("تُمطِرُ حلولًا ذكية");
  });

  test("/en يعرض النسخة الإنجليزية بعنوان رئيسي", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveURL(/\/en\/?$/);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    const text = (await h1.textContent()) ?? "";
    expect(text.trim().length, "العنوان الإنجليزي يجب ألا يكون فارغًا").toBeGreaterThan(0);
  });

  test("بوابة التتبع العامة /ar/track متاحة", async ({ page }) => {
    const res = await page.goto("/ar/track");
    expect(res?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  });

  test("sitemap.xml يقدم XML صالحًا بروابط اللغتين", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/ar");
  });

  test("robots.txt يشير إلى خريطة الموقع", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Sitemap");
  });

  test("نقطة جاهزية الصحة تؤكد القاعدة والتخزين", async ({ request }) => {
    const res = await request.get("/api/health/ready");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { ready?: boolean };
    expect(body.ready).toBe(true);
  });
});
