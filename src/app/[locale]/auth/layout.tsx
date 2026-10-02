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
    <div dir={dir} className="relative mx-auto flex w-full max-w-lg flex-col items-center px-4 py-12 sm:px-6 sm:py-16">
      {/* خلفية زخرفية: تدرج ناعم بلوحة الهوية + دوائر ضبابية خلف البطاقة */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 -top-24 h-64 bg-gradient-to-b from-accent/70 via-brand/10 to-transparent" />
        <div className="absolute -top-16 start-[-6rem] size-56 rounded-full bg-skydrop/20 blur-3xl" />
        <div className="absolute top-24 end-[-7rem] size-64 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -bottom-20 start-[-4rem] size-60 rounded-full bg-brand/10 blur-3xl" />
      </div>
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
