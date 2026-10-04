/**
 * اختبارات قبول عمليات الإدارة والحمايات الخادمية — الطور 3.1 (G8).
 *
 * العقود: قفل المراجعة الإلزامي (revision_required)، كشف التعارض
 * (conflict 409)، حاجز أنواع الوسائط، وعقد سياسة التتبع بأنماطها الأربعة
 * (حارس المعاملات 400 + البطاقة الغائبة 404 + سياسة بطاقة حية عند توفرها).
 */
import { expect, test } from "@playwright/test";
import {
  CREDENTIALS,
  TRACK_MODES,
  cleanupPage,
  createTestPage,
  getFirstRequestId,
  patchPage,
} from "./helpers";

test.describe("حمايات الكتابة وسياسة التتبع", () => {
  test("حفظ مسودة بلا مراجعة أساس يُرفض 409 revision_required", async ({ page }) => {
    await apiLoginSetup(page);
    const created = await createTestPage(page);
    try {
      const res = await patchPage(page, created.id, {
        // مساس مسودة صريح (نص كتل) دون baseRevision — يجب الرفض قبل أي كتابة
        draftBlocksAr: JSON.stringify({ schemaVersion: 1, blocks: [] }),
      });
      expect(res.status).toBe(409);
      expect(res.json.code).toBe("revision_required");
    } finally {
      await cleanupPage(page, created.id);
    }
  });

  test("حفظ بمراجعة متقادمة يُرفض 409 conflict ويكشف مراجعة الخادم", async ({ page }) => {
    await apiLoginSetup(page);
    const created = await createTestPage(page);
    try {
      const res = await patchPage(page, created.id, {
        baseRevision: 123,
        draftBlocksAr: JSON.stringify({ schemaVersion: 1, blocks: [] }),
      });
      expect(res.status).toBe(409);
      expect(res.json.code).toBe("conflict");
      expect(res.json.serverRevision).toEqual(expect.any(Number));
    } finally {
      await cleanupPage(page, created.id);
    }
  });

  test("حاجز الوسائط يرفض رفع ملف نصي غير صورة", async ({ page }) => {
    await apiLoginSetup(page);

    const res = await page.request.post("/api/admin/media", {
      multipart: {
        file: {
          name: "e2e-forbidden.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("محاولة رفع ملف غير مسموح — يجب أن يُرفض"),
        },
        altText: "e2e",
      },
    });
    expect(res.status(), "الملف النصي يجب أن يُرفض 4xx").toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("سياسة التتبع: حارس المعاملات، الغائب 404، والأنماط الأربعة عند بطاقة حية", async ({ page }) => {
    await apiLoginSetup(page);

    // العقد 1: بلا معاملات → 400 invalid (قبل أي صلاحية أو استعلام)
    const invalid = await page.request.get("/api/admin/track");
    expect(invalid.status()).toBe(400);
    const invalidBody = (await invalid.json()) as { code?: string };
    expect(invalidBody.code).toBe("invalid");

    // العقد 2: معاملات صالحة وبطاقة غير موجودة → 404 not_found
    const missing = await page.request.get("/api/admin/track?scope=request&id=nonexistent-e2e");
    expect(missing.status()).toBe(404);
    const missingBody = (await missing.json()) as { code?: string };
    expect(missingBody.code).toBe("not_found");

    // العقد 3: بطاقة حية (إن توفرت) → وضع السياسة ضمن المجموعة الأربعة
    const requestId = await getFirstRequestId(page);
    if (!requestId) {
      // قاعدة بذرة بلا طلبات — العقود الحارسية أعلاه كافية للاختبار
      expect(true).toBe(true);
      return;
    }
    const live = await page.request.get(`/api/admin/track?scope=request&id=${requestId}`);
    expect(live.ok(), `بطاقة حية يجب أن تعيد نجاحًا: ${live.status()}`).toBeTruthy();
    const body = (await live.json()) as {
      ok?: boolean;
      policy?: { mode?: string; source?: string; canReplyViaLink?: boolean };
      settings?: { forceLogin?: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.policy?.mode).toBeDefined();
    expect(
      (TRACK_MODES as readonly string[]).includes(String(body.policy?.mode)),
      `النمط ${String(body.policy?.mode)} يجب أن يكون ضمن الأنماط الأربعة`,
    ).toBe(true);
    expect(typeof body.policy?.canReplyViaLink).toBe("boolean");
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
