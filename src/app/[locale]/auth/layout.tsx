import Link from "next/link";
import { notFound } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { Logo } from "@/components/site/logo";
import { locales, localeMeta, localePath, type Locale } from "@/lib/i18n";

/** تخطيط المصادقة: بطاقة مركزية بلا قوائم البوابة — داخل تخطيط الموقع العام */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const dir = localeMeta[locale].dir;

  return (
    <div dir={dir} className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={localePath(locale)}
        className="mb-8 inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        aria-label="so7ob"
      >
        <Logo size="md" nameLang={locale === "ar" ? "ar" : "en"} />
      </Link>
      <div className="w-full">{children}</div>
      <Toaster richColors position="top-center" dir={dir} />
    </div>
  );
}
