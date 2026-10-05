"use client";

/**
 * غلاف المعاينة — شريط عائم سفلي (شارة المصدر + مبدل أجهزة + عودة للمحرر)
 * وإطار بعرض الجهاز يعرض كتل المصدر المثبت للغة المطلوبة عبر PageRenderer الحي.
 *
 * شارة المصدر (خارطة الطريق 5.5 — G11): كل معاينة مثبتة بمصدر صريح —
 * كهرمانية «مسودة» للحالة الجارية، بنفسجية «الإصدار #N» مع المؤلف والملاحظة
 * للقطة منشورة. خطأ الربط (رابط فاسد/إصدار غير موجود للغة) يُعرض صريحًا.
 */
import { useState } from "react";
import Link from "next/link";
import { Pencil, Monitor, Smartphone, Tablet, FileWarning, GitCommitVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortalContent } from "@/content/portal";
import type { ContentNode } from "@/lib/blocks/tree";
import type { Locale } from "@/lib/i18n";
import { PageRenderer } from "@/components/blocks/page-renderer";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/components/admin/helpers";
import type { PreviewDevice } from "@/components/admin/editor/editor-canvas";

const DEVICE_WIDTHS: Record<PreviewDevice, string> = {
  desktop: "max-w-[1280px]",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};

/** شارة مصدر المعاينة — مسودة جارية أو لقطة إصدار منشور */
export type PreviewBadge =
  | { kind: "draft" }
  | { kind: "version"; version: number; meta: { note: string | null; authorName: string; createdAt: string } | null };

/** خطأ ربط المعاينة بالمصدر — رسالة ودية عبر مفاتيح portal */
export type PreviewSourceError = "invalid_revision" | "version_not_found";

interface PreviewShellProps {
  pageId: string;
  nodes: ContentNode[];
  /** خطأ تحقق المحتوى التقني — يُعرض صريحًا بدل صفحة فارغة صامتة */
  loadError?: string | null;
  /** خطأ ربط المصدر (بارامتر revision) — رسالة مترجمة */
  sourceError?: PreviewSourceError | null;
  badge: PreviewBadge;
  locale: Locale; // لغة المحتوى المعروض
  uiLocale: Locale; // لغة واجهة المعاينة
  initialDevice: PreviewDevice;
}

export function PreviewShell({ pageId, nodes, loadError, sourceError, badge, locale, uiLocale, initialDevice }: PreviewShellProps) {
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
          {sourceError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
              <FileWarning className="size-8 text-amber-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-navy">
                {sourceError === "invalid_revision" ? tp.previewInvalidRevision : tp.versionNotFound}
              </p>
              <p className="max-w-md text-xs leading-6 text-muted-foreground">{tp.previewSourceHint}</p>
            </div>
          ) : loadError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
              <FileWarning className="size-8 text-amber-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-navy">{uiLocale === "en" ? "Content could not be rendered" : "تعذّر عرض المحتوى"}</p>
              <p dir="ltr" className="max-w-md text-xs leading-6 text-muted-foreground">{loadError}</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm font-semibold text-navy">{tp.empty}</p>
              <p className="max-w-xs text-xs leading-6 text-muted-foreground">{tp.emptyBody}</p>
            </div>
          ) : (
            /* وضع test — المعاينة للمراجعة: النماذج تُحاكى ولا يصل أي طلب حقيقي */
            <PageRenderer nodes={nodes} locale={locale} mode="test" />
          )}
        </div>
      </div>

      {/* الشريط العائم */}
      <div
        dir={uiLocale === "ar" ? "rtl" : "ltr"}
        className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      >
        {badge.kind === "draft" ? (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            {te.preview} · {tp.draft}
          </span>
        ) : (
          <span
            className="flex max-w-72 items-center gap-1.5 truncate rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
            title={
              badge.meta
                ? `${badge.meta.authorName} · ${fmtDateTime(badge.meta.createdAt, uiLocale)}${badge.meta.note ? ` — ${badge.meta.note}` : ""}`
                : undefined
            }
          >
            <GitCommitVertical className="size-3.5 shrink-0" aria-hidden="true" />
            {te.preview} · {tp.versionN.replace("{n}", String(badge.version))}
            {badge.meta?.note ? <span className="truncate font-normal opacity-80">— {badge.meta.note}</span> : null}
          </span>
        )}

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
