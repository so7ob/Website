import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { RequestsView } from "@/components/account/requests-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.requests.title };
}

export default async function AccountRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!locales.includes(raw as Locale)) notFound();
  const locale = raw as Locale;
  const portal = getPortalContent(locale);

  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy="true">
          <div className="h-9 w-48 animate-pulse rounded bg-slate-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-50" />
        </div>
      }
    >
      <RequestsView
        locale={locale}
        t={portal.account.requests}
        authErrors={portal.auth.errors}
        awaitingLabel={portal.account.dashboard.awaitingReply}
        allLabel={portal.account.dashboard.viewAll}
      />
    </Suspense>
  );
}
