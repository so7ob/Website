"use client";

/**
 * شريط الإعلان العلوي للموقع العام — يُدار من إعدادات لوحة الإدارة.
 * يظهر فوق الترويسة لكل الزوار، ويُخفى في المتصفح عند الإغلاق حتى
 * تُحدَّث المراجعة (revision) فتُعاد إظهاره. حالة الإخفاء تُقرأ من
 * localStorage عبر useSyncExternalStore: لقطة الخادم فارغة فلا تعارض
 * إماهة، وبعد التثبيت تُقرأ القيمة الفعلية ويعاد الرسم فورًا.
 */
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Info, TriangleAlert, CircleCheck, Megaphone, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { AnnouncementSettings, AnnouncementVariant } from "@/lib/site-data";

const STORAGE_KEY = "so7ob-announcement";

interface AnnouncementBarProps {
  announcement: AnnouncementSettings;
  locale: Locale;
  labels: { ariaLabel: string; dismiss: string };
}

const VARIANTS: Record<AnnouncementVariant, { strip: string; icon: LucideIcon; cta: string }> = {
  info: {
    strip: "bg-skydrop/15 text-navy border-b border-skydrop/30",
    icon: Info,
    cta: "bg-navy text-white hover:bg-navy-soft",
  },
  warning: {
    strip: "bg-amber-100 text-amber-900 border-b border-amber-300",
    icon: TriangleAlert,
    cta: "bg-amber-900 text-white hover:bg-amber-800",
  },
  success: {
    strip: "bg-emerald-100 text-emerald-900 border-b border-emerald-300",
    icon: CircleCheck,
    cta: "bg-emerald-900 text-white hover:bg-emerald-800",
  },
  brand: {
    strip: "bg-navy text-white border-b border-navy-soft",
    icon: Megaphone,
    cta: "bg-skydrop text-navy hover:bg-skydrop/85",
  },
};

/** اشتراك بتغييرات التخزين — يزامن الإخفاء بين تبويبات المتصفح */
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStoredRevision(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function AnnouncementBar({ announcement, locale, labels }: AnnouncementBarProps) {
  // الإخفاء المحلي يُخزَّن مع المراجعة التي طُبّق عليها — تحديث الإعلان يعيده فورًا
  const [selfDismissedFor, setSelfDismissedFor] = useState<string | null>(null);
  const storedRevision = useSyncExternalStore(subscribeStorage, readStoredRevision, () => "");

  const message = (locale === "en" ? announcement.messageEn : announcement.messageAr).trim();
  const ctaLabel = (locale === "en" ? announcement.ctaLabelEn : announcement.ctaLabelAr).trim();
  const ctaUrl = announcement.ctaUrl.trim();

  // مراجعة الإعلان — رقم الحفظ، أو بديل مشتق من المحتوى عند غيابه
  const revision =
    announcement.revision ||
    `${announcement.variant}:${announcement.messageAr}:${announcement.messageEn}:${ctaUrl}`;

  const dismissed = selfDismissedFor === revision || storedRevision === revision;
  if (!announcement.enabled || dismissed || !message) return null;

  const dismiss = () => {
    setSelfDismissedFor(revision);
    try {
      window.localStorage.setItem(STORAGE_KEY, revision);
    } catch {
      // لا يفشل الإخفاء المرئي أبدًا
    }
  };

  const variant = VARIANTS[announcement.variant];
  const Icon = variant.icon;
  const ctaClasses = cn(
    "inline-flex min-h-9 shrink-0 items-center rounded-full px-3 py-1 text-sm font-semibold transition-colors",
    variant.cta
  );

  // روابط خارجية http(s) تفتح في تبويب جديد؛ الداخلية "/" تتنقل داخليًا
  const isExternal = /^https?:\/\//i.test(ctaUrl);
  const cta =
    ctaUrl && ctaLabel ? (
      ctaUrl.startsWith("/") ? (
        <Link href={ctaUrl} className={ctaClasses}>
          {ctaLabel}
        </Link>
      ) : (
        <a
          href={ctaUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className={ctaClasses}
        >
          {ctaLabel}
        </a>
      )
    ) : null;

  return (
    <div id="site-announcement" role="region" aria-label={labels.ariaLabel} className={cn("w-full", variant.strip)}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm font-medium sm:px-6 lg:px-8">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 break-words line-clamp-1 sm:line-clamp-none" title={message}>
          {message}
        </p>
        {cta}
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.dismiss}
          className="grid size-11 shrink-0 place-items-center self-center rounded-full transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
