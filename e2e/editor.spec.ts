/**
 * اختبارات قبول المحرر — الطور 3.1 (G8).
 *
 * العقود: المحرر يفتح بشجرة كتل، الحفظ بمراجعة صحيحة يعيد 200،
 * الصفحات الجديدة تظهر بالقائمة، مدخل v0 يُخزَّن مغلفًا v1 (الترحيل)،
 * وحافظة الكتل تحفظ النسخة في التخزين المحلي (G1).
 *
 * ملاحظة مسار: محرر الصفحات يعتمد id القاعدة (/ar/admin/pages/<id>/edit)
 * — يتم جلبه من GET /api/admin/pages لا من slug.
 */
import { expect, test } from "@playwright/test";
import {
  CREDENTIALS,
  cleanupPage,
  createTestPage,
  getAdminPageIdBySlug,
  patchPage,
} from "./helpers";

test.describe("محرر الصفحات", () => {
  test("محرر صفحة موجودة يفتح ويعرض أدوات شجرة الكتل", async ({ page }) => {
    await apiLoginSetup(page);
    const aboutId = await getAdminPageIdBySlug(page, "about");
    expect(aboutId, "صفحة about المزروعة يجب أن تكون متاحة").toBeTruthy();

    await page.goto(`/ar/admin/pages/${aboutId}/edit`);
    // زر النسخ يتواجد في صفوف شجرة الكتل — برهان تحميل الشجرة
    await expect(page.getByLabel("نسخ إلى الحافظة").first()).toBeVisible({ timeout: 60_000 });
  });

  test("الحفظ بمراجعة أساس صحيحة يعيد 200 ويرفع المراجعة", async ({ page }) => {
    await apiLoginSetup(page);
    const created = await createTestPage(page);
    try {
      // مراجعة أساس خاطئة أولاً → 409 مع كشف المراجعة الفعلية من الخادم
      const stale = await patchPage(page, created.id, {
        baseRevision: 999_999,
        draftBlocksAr: JSON.stringify({ schemaVersion: 1, blocks: [] }),
      });
      expect(stale.status).toBe(409);
      const serverRevision = stale.json.serverRevision;
      expect(serverRevision, "التعارض يجب أن يكشف مراجعة الخادم").toEqual(expect.any(Number));

      // الحفظ بمراجعة صحيحة → 200
      const ok = await patchPage(page, created.id, {
        baseRevision: serverRevision,
        draftBlocksAr: JSON.stringify({ schemaVersion: 1, blocks: [] }),
      });
      expect(ok.status).toBe(200);

      // مراجعة القيم بعد الحفظ — المراجعة تقدمت
      const stale2 = await patchPage(page, created.id, {
        baseRevision: 999_999,
        draftBlocksAr: JSON.stringify({ schemaVersion: 1, blocks: [] }),
      });
      expect(stale2.status).toBe(409);
      expect(Number(stale2.json.serverRevision)).toBeGreaterThan(Number(serverRevision));
    } finally {
      await cleanupPage(page, created.id);
    }
  });

  test("صفحة جديدة تُنشأ عبر API وتظهر في قائمة الصفحات", async ({ page }) => {
    await apiLoginSetup(page);
    const created = await createTestPage(page);
    try {
      await page.goto("/ar/admin/pages");
      await expect(
        page.getByText(created.titleAr).first(),
        "العنوان يجب أن يظهر في جدول الصفحات",
      ).toBeVisible({ timeout: 60_000 });
    } finally {
      await cleanupPage(page, created.id);
    }
  });

  test("عقد الترحيل: مدخل v0 مسطح يُطعَّم ويُخزَّن مغلفًا v1", async ({ page }) => {
    await apiLoginSetup(page);
    const created = await createTestPage(page);
    try {
      // مراجعة الخادم الحالية عبر تعارض مقصود
      const stale = await patchPage(page, created.id, {
        baseRevision: 999_999,
        draftBlocksAr: JSON.stringify({ schemaVersion: 1, blocks: [] }),
      });
      expect(stale.status).toBe(409);
      const baseRevision = Number(stale.json.serverRevision);

      // محتوى v0 — مصفوفة مسطحة بلا غلاف
      const v0Blocks = JSON.stringify([
        {
          id: "b-e2e-v0-1",
          type: "richText",
          props: { paragraphs: ["مرحبًا من الترحيل"] },
        },
      ]);

      const saved = await patchPage(page, created.id, {
        baseRevision,
        draftBlocksAr: v0Blocks,
      });
      expect(saved.status, JSON.stringify(saved.json)).toBe(200);

      // قراءة المخزّن — يجب أن يكون غلاف v1 لا مصفوفة v0
      const fetched = await page.request.get(`/api/admin/pages/${created.id}`);
      expect(fetched.ok()).toBeTruthy();
      const pageBody = (await fetched.json()) as {
        page?: { draftBlocksAr?: string };
        draftBlocksAr?: string;
      };
      const stored = pageBody.page?.draftBlocksAr ?? pageBody.draftBlocksAr;
      expect(stored, "المحتوى المخزّن يجب أن يكون متاحًا").toBeTruthy();

      const parsed = JSON.parse(stored as string) as {
        schemaVersion?: number;
        blocks?: Array<{ id?: string; type?: string }>;
      };
      expect(parsed.schemaVersion, "الغلاف يجب أن يحمل schemaVersion=1").toBe(1);
      expect(Array.isArray(parsed.blocks)).toBeTruthy();
      const migrated = parsed.blocks?.find((b) => b.id === "b-e2e-v0-1");
      expect(migrated, "كتلة v0 يجب أن تُرحَّل بمعرفها المشتق").toBeTruthy();
    } finally {
      await cleanupPage(page, created.id);
    }
  });

  test("حافظة المحرر (G1): النسخ يسجل مدخلًا في التخزين المحلي", async ({ page }) => {
    await apiLoginSetup(page);
    const aboutId = await getAdminPageIdBySlug(page, "about");
    expect(aboutId, "صفحة about المزروعة يجب أن تكون متاحة").toBeTruthy();

    await page.goto(`/ar/admin/pages/${aboutId}/edit`);

    // الشجرة داخل Radix TabsContent — نقر حقيقي يفعّل التبويب.
    const layersTab = page.getByRole("tab", { name: "الطبقات" });
    await expect(layersTab).toBeVisible({ timeout: 60_000 });
    await layersTab.click();

    // زر النسخ داخل صفوف الشجرة (li) يظهر بمجرد تفعيل التبويب —
    // النقر عبر DOM يشغّل onClick العادي لـ React (copyNode) مباشرة،
    // متجاوزًا opacity-0 الذي يخفيه دون تحويم (headless لا يولّد hover).
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              [...document.querySelectorAll('button[aria-label="نسخ إلى الحافظة"]')].filter((b) => b.closest("li"))
                .length,
          ),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="نسخ إلى الحافظة"]')].find((b) =>
        b.closest("li"),
      );
      btn?.click();
    });
    await page.waitForTimeout(1_000);

    // ملاحظة: داخل page.evaluate تُستخدم السلسلة الحرفية — الاستيرادات
    // لا تُسلسل إلى سياق المتصفح (قيود transpile).
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            window.localStorage.getItem("so7ob.editor.clipboard.v1"),
          ),
        { timeout: 15_000 },
      )
      .toBeTruthy();

    const stored = (await page.evaluate(() =>
      window.localStorage.getItem("so7ob.editor.clipboard.v1"),
    )) as string | null;
    // البنية الفعلية: مصفوفة مدخلات مباشرة [{entryId, node, copiedAt}]
    const entries = JSON.parse(stored as string) as unknown[];
    expect(
      Array.isArray(entries) && entries.length > 0,
      "الحافظة يجب أن تحوي مدخل نسخ واحدًا على الأقل",
    ).toBeTruthy();

    // تنظيف — لا تلوث لاختبارات لاحقة
    await page.evaluate(() =>
      window.localStorage.removeItem("so7ob.editor.clipboard.v1"),
    );
  });
});

/** دخول admin عبر قناة NextAuth ثم تثبيت الكوكيز في سياق الصفحة */
async function apiLoginSetup(page: import("@playwright/test").Page): Promise<void> {
  const csrf = await page.request.get("/api/auth/csrf");
  expect(csrf.ok()).toBeTruthy();
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  await page.request.post("/api/auth/callback/credentials", {
    data: { ...CREDENTIALS.admin, csrfToken, json: true },
    headers: { "Content-Type": "application/json" },
  });
}
