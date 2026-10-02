import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { db } from "@/lib/db";
import { locales, type Locale } from "@/lib/i18n";
import { getAuthUser } from "@/lib/auth/session";
import { ProfileForm } from "@/components/account/profile-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.profile.title };
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  const user = await getAuthUser();
  if (!user) notFound();

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, phone: true, company: true, locale: true, emailVerifiedAt: true },
  });
  if (!row) notFound();

  return (
    <ProfileForm
      locale={locale}
      t={portal.account.profile}
      authErrors={portal.auth.errors}
      emailLabel={portal.auth.email}
      initial={{
        email: row.email,
        name: row.name,
        phone: row.phone ?? "",
        company: row.company ?? "",
        userLocale: row.locale === "en" ? "en" : "ar",
        emailVerified: Boolean(row.emailVerifiedAt),
      }}
    />
  );
}
