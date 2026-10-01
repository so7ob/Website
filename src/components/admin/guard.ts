/**
 * حارس صفحات الإدارة (خادم فقط): جلسة + صلاحية القسم — يعيد هوية «me» للمكونات العميلة.
 * لا يوثق أبدًا بهوية قادمة من المتصفح؛ القرار الأمني دائمًا هنا وفي الواجهات.
 */
import { redirect } from "next/navigation";
import { getAuthUser, can } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import type { Me } from "./types";

/**
 * يتحقق من الجلسة والصلاحية المطلوبة للصفحة.
 * - بلا جلسة → صفحة الدخول مع رابط العودة.
 * - بلا صلاحية → جذر لوحة الإدارة (العملاء يُحوّلون أصلًا من تخطيط اللوحة).
 */
export async function requireMe(locale: Locale, permission: Permission, nextPath: string): Promise<Me> {
  const user = await getAuthUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!can(user, permission)) {
    redirect(`/${locale}/admin`);
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleKey: user.roleKey,
    locale: user.locale,
    permissions: user.permissions,
  };
}
