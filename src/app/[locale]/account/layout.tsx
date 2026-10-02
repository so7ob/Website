import { notFound, redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { getAuthUser } from "@/lib/auth/session";
import { getPortalContent } from "@/content/portal";
import { locales, localeMeta, type Locale } from "@/lib/i18n";
import { AccountShell } from "@/components/account/account-shell";

/** بوابة العميل: تخطيط محمي — التحقق الكامل في الخادم ثم هيكل القائمة الجانبية */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;

  const user = await getAuthUser();
  if (!user) {
    redirect(`/${locale}/auth/login?next=/${locale}/account`);
  }

  const portal = getPortalContent(locale);

  return (
    <div dir={localeMeta[locale].dir}>
      <AccountShell
        locale={locale}
        nav={portal.account.nav}
        auth={{ pendingTitle: portal.auth.pendingVerification, pendingBody: portal.auth.pendingVerificationBody }}
        user={{ name: user.name, email: user.email, roleKey: user.roleKey, emailVerified: user.emailVerified }}
      >
        {children}
      </AccountShell>
      <Toaster richColors position="top-center" dir={localeMeta[locale].dir} />
    </div>
  );
}
