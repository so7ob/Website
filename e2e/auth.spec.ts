/**
 * اختبارات قبول المصادقة والأدوار — الطور 3.1 (G8).
 *
 * العقود: دخول المدير يفتح الإدارة، رفض الاعتماد الخاطئ بلا جلسة،
 * حماية المسار بلا جلسة، عزل دور العميل عن الإدارة، وإبطال الخروج.
 */
import { expect, test } from "@playwright/test";
import { CREDENTIALS, apiLogin, apiLogout } from "./helpers";

test.describe("المصادقة والأدوار", () => {
  test("دخول super_admin يفتح لوحة الإدارة", async ({ page }) => {
    const login = await apiLogin(page, CREDENTIALS.admin);
    expect(login.sessionCookieFound, "كوكي الجلسة يجب أن تستقر").toBeTruthy();

    await page.goto("/ar/admin");
    await expect(page).toHaveURL(/\/ar\/admin\/?$/);
    await expect(
      page.getByRole("heading", { name: "اللوحة" }).or(page.locator("h1, h2").filter({ hasText: "اللوحة" }).first()),
    ).toBeVisible();
  });

  test("كلمة مرور خاطئة تُرفض دون إنشاء جلسة", async ({ page }) => {
    const login = await apiLogin(page, {
      email: CREDENTIALS.admin.email,
      password: "WrongPassword#2026!",
    });
    const cookies = await page.context().cookies();
    const session = cookies.some((c) => c.name.includes("session-token"));
    expect(session, "لا يجوز استقرار جلسة ببيانات خاطئة").toBeFalsy();
    expect(login.sessionCookieFound).toBeFalsy();
  });

  test("مسار الإدارة بلا جلسة يُحوَّل إلى تسجيل الدخول", async ({ page }) => {
    await page.goto("/ar/admin");
    await expect(page).toHaveURL(/\/ar\/auth\/login/, { timeout: 30_000 });
  });

  test("دور العميل يُحجب عن الإدارة ويُعاد إلى بوابة العميل", async ({ page }) => {
    const login = await apiLogin(page, CREDENTIALS.client);
    expect(login.sessionCookieFound).toBeTruthy();

    await page.goto("/ar/admin");
    // العقد: لا يصل إلى الإدارة — التحويل من layout الإدارة إلى بوابة الحساب
    await expect(page).not.toHaveURL(/\/ar\/admin(\/|$)/, { timeout: 30_000 });
    expect(await page.url()).not.toMatch(/\/ar\/admin(\/|$)/);
  });

  test("تسجيل الخروج يُبطل الجلسة ويغلق الإدارة", async ({ page }) => {
    await apiLogin(page, CREDENTIALS.admin);
    await page.goto("/ar/admin");
    await expect(page).toHaveURL(/\/ar\/admin\/?$/);

    await apiLogout(page);
    await page.goto("/ar/admin");
    await expect(page).toHaveURL(/\/ar\/auth\/login/, { timeout: 30_000 });
  });
});
