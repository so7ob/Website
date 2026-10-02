import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalContent } from "@/content/portal";
import { locales, type Locale } from "@/lib/i18n";
import { InquiriesView } from "@/components/account/inquiries-view";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return { title: getPortalContent(locale as Locale).account.inquiries.title };
}

export default async function AccountInquiriesPage({ params }: { params: Promise<{ locale: string }> }) {
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
      <InquiriesView
        locale={locale}
        t={portal.account.inquiries}
        authErrors={portal.auth.errors}
        searchLabel={portal.account.requests.search}
        searchPlaceholder={portal.account.requests.searchPlaceholder}
        clearSearchLabel={portal.account.requests.clearSearch}
      />
    </Suspense>
  );
}
