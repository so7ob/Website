/**
 * مساعدات حزمة القبول E2E — عقود المصادقة والإنشاء المشتركة.
 *
 * المصادقة عبر قناة NextAuth API (نمط سكربتات الدخان المُثبتة):
 * 1) GET /api/auth/csrf لجلب الرمز مع تخزين الكوكيز في سياق الطلب،
 * 2) POST /api/auth/callback/credentials بنفس السياق → كوكيز الجلسة
 *    تُحقن تلقائيًا في سياق الصفحة لأن page.request يشاركها.
 */
import { type Page, expect } from "@playwright/test";

/** بيانات الحسابات التجريبية — المصدر: scripts/restore-demo-users.ts */
export const CREDENTIALS = {
  admin: { email: "admin@so7ob.local", password: "AdminS7ob2026!" },
  support: { email: "support@so7ob.local", password: "SupportS7ob2026!" },
  client: { email: "client@so7ob.local", password: "ClientS7ob2026!" },
} as const;

export const CLIPBOARD_STORAGE_KEY = "so7ob.editor.clipboard.v1";

/** أنماط التتبع الأربعة — المصدر: src/lib/track/policy.ts */
export const TRACK_MODES = [
  "login_required",
  "link_view",
  "link_reply",
  "link_view_login_reply",
] as const;

export interface LoginResult {
  status: number;
  sessionCookieFound: boolean;
}

/** تسجيل دخول عبر API — يتحقق أن كوكي جلسة فعلًا استقرت في سياق الصفحة */
export async function apiLogin(
  page: Page,
  creds: { email: string; password: string },
): Promise<LoginResult> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  expect(csrfRes.ok(), "فشل جلب CSRF").toBeTruthy();
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const res = await page.request.post("/api/auth/callback/credentials", {
    data: { email: creds.email, password: creds.password, csrfToken, json: true },
    headers: { "Content-Type": "application/json" },
  });

  const cookies = await page.context().cookies();
  const sessionCookieFound = cookies.some((c) => c.name.includes("session-token"));
  return { status: res.status(), sessionCookieFound };
}

/** خروج كامل عبر نقطة NextAuth (إبطال الجلسة من سياق الصفحة) */
export async function apiLogout(page: Page): Promise<void> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  await page.request.post("/api/auth/signout", {
    data: { csrfToken, json: true },
    headers: { "Content-Type": "application/json" },
  });
}

/** إنشاء صفحة اختبار بمعرف فريد — يعيد المعرف لتنظيفها لاحقًا */
export async function createTestPage(
  page: Page,
  prefix = "e2e",
): Promise<{ slug: string; id: string; titleAr: string }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const slug = `${prefix}-${stamp}`;
  const titleAr = `صفحة قبول ${stamp}`;

  const res = await page.request.post("/api/admin/pages", {
    data: { slug, titleAr, titleEn: `E2E Acceptance ${stamp}` },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.ok(), `فشل إنشاء صفحة الاختبار: ${res.status()}`).toBeTruthy();

  const body = (await res.json()) as {
    page?: { id?: string };
    id?: string;
  };
  const id = body.page?.id ?? body.id;
  expect(id, "استجابة الإنشاء يجب أن تحمل معرف الصفحة").toBeTruthy();
  return { slug, id: id as string, titleAr };
}

/** حذف صفحة الاختبار — تنظيف مهذب لا يعطل الاختبار إن فشل */
export async function cleanupPage(page: Page, id: string): Promise<void> {
  try {
    await page.request.delete(`/api/admin/pages/${id}`);
  } catch {
    /* التنظيف لطيف */
  }
}

/** PATCH صفحة بجسم معين — يُعيد الحالة وجسم JSON مهما كان شكل الاستجابة */
export async function patchPage(
  page: Page,
  id: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await page.request.patch(`/api/admin/pages/${id}`, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* استجابة غير JSON — تُترك فارغة */
  }
  return { status: res.status(), json };
}

/**
 * معرف صفحة إدارية من slug — مسار المحرر يعتمد id القاعدة لا slug.
 * المصدر: GET /api/admin/pages → { ok, pages: [{id, slug}] }
 */
export async function getAdminPageIdBySlug(page: Page, slug: string): Promise<string | null> {
  const res = await page.request.get("/api/admin/pages");
  if (!res.ok()) return null;
  const body = (await res.json()) as { pages?: Array<{ id?: string; slug?: string }> };
  const found = body.pages?.find((p) => p.slug === slug);
  return found?.id ?? null;
}

/** أول بطاقة طلب متاحة (لعقد سياسة التتبع) — null إن كانت القاعدة بلا طلبات */
export async function getFirstRequestId(page: Page): Promise<string | null> {
  const res = await page.request.get("/api/admin/requests");
  if (!res.ok()) return null;
  const body = (await res.json()) as {
    items?: Array<{ id?: string }>;
    requests?: Array<{ id?: string }>;
  };
  const list = body.items ?? body.requests ?? [];
  return list[0]?.id ?? null;
}
