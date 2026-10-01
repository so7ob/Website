import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, locales } from "@/lib/i18n";

/**
 * الوسيط المركزي:
 * 1) تحويل الجذر «/» إلى المسار اللغوي المناسب (كوكي ← متصفح ← افتراضي).
 * 2) حماية مسارات بوابة العميل ولوحة الإدارة: وجود كوكي الجلسة مطلوب —
 *    التحقق الكامل من الحالة والدور يتم داخل الخادم (layout/API) لا هنا.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
      return NextResponse.redirect(new URL(`/${cookieLocale}`, request.url));
    }
    const accept = (request.headers.get("accept-language") ?? "").toLowerCase();
    const prefersEnglish = accept.split(",").some((tag) => tag.trim().startsWith("en"));
    return NextResponse.redirect(new URL(`/${prefersEnglish ? "en" : defaultLocale}`, request.url));
  }

  // حماية المسارات الخاصة — فحص الكوكي فقط (سريع)؛ القرار الأمني في الخادم
  const protectedMatch = pathname.match(/^\/(ar|en)\/(account|admin)(\/|$)/);
  if (protectedMatch) {
    const hasSession =
      Boolean(request.cookies.get("next-auth.session-token")?.value) ||
      Boolean(request.cookies.get("__Secure-next-auth.session-token")?.value);
    if (!hasSession) {
      const locale = protectedMatch[1];
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/:locale/account/:path*", "/:locale/admin/:path*"],
};
