/**
 * مساعدو الجلسة للخادم — مصدر موحد لاستخراج هوية المستخدم وصلاحياته.
 * لا يُوثق أبدًا بحقول userId/role/ownerId قادمة من المتصفح.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "./options";
import { db } from "@/lib/db";
import { can, isStaff, type AuthUser, type Permission } from "./permissions";

/** مستخدم الجلسة الحالي بصلاحياته — أو null */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return null;

  const user = await db.user.findUnique({ where: { id: uid }, include: { role: true } });
  if (!user) return null;
  if (user.status === "suspended") return null; // موقوف = لا وصول

  let permissions: string[] = [];
  try {
    permissions = JSON.parse(user.role.permissions);
  } catch {
    permissions = [];
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleKey: user.roleKey,
    status: user.status,
    locale: user.locale,
    emailVerified: Boolean(user.emailVerifiedAt),
    permissions: permissions as Permission[],
  };
}

/** حارس مسارات API — يتحقق من الجلسة والصلاحية والأصل المشترك للطلبات المعدِّلة */
export type GuardResult = { ok: true; user: AuthUser } | { ok: false; response: NextResponse };

export async function guardApi(req: NextRequest, permission?: Permission): Promise<GuardResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 }) };
  }
  if (permission && !can(user, permission)) {
    return { ok: false, response: NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 }) };
  }
  // حماية CSRF: طلبات التعديل يجب أن تأتي من نفس الأصل
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const originOk = assertSameOrigin(req);
    if (!originOk) {
      return { ok: false, response: NextResponse.json({ ok: false, code: "bad_origin" }, { status: 403 }) };
    }
  }
  return { ok: true, user };
}

/** تحقق أصل الطلب — يمنع تنفيذ التعديلات من أصول أخرى (واعٍ بالبروكسي) */
export function assertSameOrigin(req: NextRequest): boolean {
  // 1) إشارة المتصفح غير القابلة للتزوير: تصف اللاقة الحقيقية بين مصدر الطلب وهدفه
  //    بغضّ النظر عن أي إعادة كتابة Host/X-Forwarded-* في سلسلة البروكسي
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "cross-site";

  // 2) بلا sec-fetch-site (متصفح قديم أو عميل خارجي): مقارنة Origin مع مضيفاتنا المعروفة
  const origin = req.headers.get("origin");
  if (!origin) return true; // عملاء غير متصفح (curl) — الكوكيات ستظل محمية بـ SameSite
  try {
    const originHost = new URL(origin).host;
    const candidates = [
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
      req.headers.get("host"),
      new URL(req.url).host,
    ].filter((h): h is string => Boolean(h));
    const ok = candidates.includes(originHost);
    if (!ok) {
      // تشخيص: تعارض أصل خلف البروكسي — يظهر في dev.log مع القيم الفعلية
      console.warn(`[origin-mismatch] origin=${originHost} candidates=${candidates.join(" | ")}`);
    }
    return ok;
  } catch {
    return false;
  }
}

/** هل الجلسة نشطة (للـ middleware السريع — تحقق كامل يتم في الخادم لاحقًا) */
export function hasSessionCookie(req: NextRequest): boolean {
  return (
    Boolean(req.cookies.get("next-auth.session-token")?.value) ||
    Boolean(req.cookies.get("__Secure-next-auth.session-token")?.value)
  );
}

/** بادئة استجابة موحدة */
export function apiError(status: number, code: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: false, code, ...extra }, { status });
}

/** استجابة json موحدة { ok: true/false } */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export { can, isStaff };
