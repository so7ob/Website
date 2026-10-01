import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).auth.verifyTitle };
}

/** نتيجة تأكيد البريد — ?status=ok|already|invalid */
export default async function VerifiedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const t = getPortalContent(locale).auth;

  const sp = await searchParams;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = statusParam === "ok" ? "ok" : statusParam === "already" ? "already" : "invalid";

  const heading = status === "ok" ? t.verifyOk : status === "already" ? t.verifyAlready : t.verifyInvalid;
  const body = status === "invalid" ? t.verifyInvalidBody : t.verifyOkBody;

  return (
    <section className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm sm:p-10" role="status">
      <span
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          status === "invalid" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
        }`}
      >
        {status === "ok" ? (
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        ) : status === "already" ? (
          <CircleCheck className="h-8 w-8" aria-hidden="true" />
        ) : (
          <ShieldX className="h-8 w-8" aria-hidden="true" />
        )}
      </span>
      <h1 className="mt-5 text-xl font-bold text-navy sm:text-2xl">{t.verifyTitle}</h1>
      <p className="mt-2 text-lg font-semibold text-navy">{heading}</p>
      <p className="mx-auto mt-3 max-w-md leading-8 text-muted-foreground">{body}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button
          asChild
          className="h-12 w-full rounded-full bg-primary px-10 text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong sm:w-auto"
        >
          <Link href={`/${locale}/auth/login`}>{t.loginTitle}</Link>
        </Button>
        <Link href={`/${locale}`} className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
          {t.backHome}
        </Link>
      </div>
    </section>
  );
}
