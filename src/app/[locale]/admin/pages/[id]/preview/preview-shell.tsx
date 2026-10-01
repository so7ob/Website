"use client";

/**
 * غلاف المعاينة — شريط عائم سفلي (شارة «مسودة» + مبدل أجهزة + عودة للمحرر)
 * وإطار بعرض الجهاز يعرض كتل المسودة للغة المطلوبة عبر PageRenderer الحي.
 */
import { useState } from "react";
import Link from "next/link";
import { Pencil, Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortalContent } from "@/content/portal";
import type { Block } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { PageRenderer } from "@/components/blocks/page-renderer";
import { cn } from "@/lib/utils";
import type { PreviewDevice } from "@/components/admin/editor/editor-canvas";

const DEVICE_WIDTHS: Record<PreviewDevice, string> = {
  desktop: "max-w-[1280px]",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};

interface PreviewShellProps {
  pageId: string;
  blocks: Block[];
  locale: Locale; // لغة المحتوى المعروض
  uiLocale: Locale; // لغة واجهة المعاينة
  initialDevice: PreviewDevice;
}

export function PreviewShell({ pageId, blocks, locale, uiLocale, initialDevice }: PreviewShellProps) {
  const t = getPortalContent(uiLocale);
  const te = t.admin.editor;
  const tp = t.admin.pages;
  const [device, setDevice] = useState<PreviewDevice>(initialDevice);

  return (
    <div className="-mx-4 pb-20 sm:-mx-6 lg:-mx-8">
      <div
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="mx-auto w-full max-w-7xl bg-white shadow-sm transition-[max-width] duration-300"
      >
        <div className={cn("mx-auto w-full", DEVICE_WIDTHS[device])}>
          {blocks.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm font-semibold text-navy">{tp.empty}</p>
              <p className="max-w-xs text-xs leading-6 text-muted-foreground">{tp.emptyBody}</p>
            </div>
          ) : (
            <PageRenderer blocks={blocks} locale={locale} />
          )}
        </div>
      </div>

      {/* الشريط العائم */}
      <div
        dir={uiLocale === "ar" ? "rtl" : "ltr"}
        className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      >
        <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {te.preview} · {tp.draft}
        </span>

        <div className="flex items-center rounded-full border border-border p-0.5" role="group" aria-label={te.preview}>
          {(
            [
              { key: "desktop", icon: Monitor, label: te.deviceDesktop },
              { key: "tablet", icon: Tablet, label: te.deviceTablet },
              { key: "mobile", icon: Smartphone, label: te.deviceMobile },
            ] as const
          ).map((d) => (
            <Button
              key={d.key}
              type="button"
              variant={device === d.key ? "secondary" : "ghost"}
              size="icon"
              className={cn("size-8 rounded-full", device === d.key && "bg-accent text-brand-strong")}
              onClick={() => setDevice(d.key)}
              aria-label={d.label}
              title={d.label}
              aria-pressed={device === d.key}
            >
              <d.icon className="size-4" aria-hidden="true" />
            </Button>
          ))}
        </div>

        <Button asChild variant="outline" size="sm" className="min-h-9 rounded-full">
          <Link href={`/${uiLocale}/admin/pages/${pageId}/edit`}>
            <Pencil className="size-3.5" aria-hidden="true" />
            {tp.edit}
          </Link>
        </Button>
      </div>
    </div>
  );
}
