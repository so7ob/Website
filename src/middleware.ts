import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, defaultLocale, locales } from "@/lib/i18n";

/**
 * تحويل جذر الموقع «/» إلى المسار اللغوي المناسب:
 * 1) الكوكي المحفوظ من زيارة سابقة أو تبديل لغة صريح.
 * 2) ثم تفضيل لغة المتصفح (Accept-Language).
 * 3) وإلا العربية (اللغة الأساسية).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return NextResponse.redirect(new URL(`/${cookieLocale}`, request.url));
  }

  const accept = (request.headers.get("accept-language") ?? "").toLowerCase();
  const prefersEnglish = accept.split(",").some((tag) => tag.trim().startsWith("en"));
  const target = prefersEnglish ? "en" : defaultLocale;
  return NextResponse.redirect(new URL(`/${target}`, request.url));
}

export const config = {
  matcher: ["/"],
};
