"use client";

/**
 * قائمة الحافظة عبر الصفحات — بند 1.1 من خارطة الطريق (فجوة G1).
 *
 * زر في شريط المحرر العلوي يعرض آخر النسخ (الأحدث أولًا): اختيار أي مدخل
 * يلصقه في المسودة الحالية بمعرفات جديدة. شارة عدّ على الزر، وحالة فراغ
 * مع تلميح، وإفراغ كلي من أسفل القائمة.
 */
import { ClipboardCopy, ClipboardPaste, Trash2 } from "lucide-react";
import { getPortalContent } from "@/content/portal";
import { BLOCK_REGISTRY, type ContentNode } from "@/lib/blocks/tree";
import type { ClipboardEntry } from "@/lib/blocks/clipboard";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TYPE_ICONS } from "./block-library";

interface ClipboardMenuProps {
  entries: ClipboardEntry[];
  uiLocale: Locale;
  onPaste: (entry: ClipboardEntry) => void;
  onClear: () => void;
}

/** تسمية النوع بلغة الواجهة (لبعض الأنواع القديمة غير المسجلة) */
function entryLabel(type: string, locale: Locale): string {
  const def = (BLOCK_REGISTRY as Record<string, { ar: string; en: string } | undefined>)[type];
  if (def) return locale === "en" ? def.en : def.ar;
  return type;
}

export function ClipboardMenu({ entries, uiLocale, onPaste, onClear }: ClipboardMenuProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const count = entries.length;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-9"
              aria-label={te.pasteFromClipboard}
              title={te.pasteFromClipboard}
            >
              <ClipboardPaste className="size-4" aria-hidden="true" />
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand text-[9px] font-bold leading-none text-white tabular-nums"
                >
                  {count}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{te.pasteFromClipboard}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="center" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <ClipboardPaste className="size-3.5 text-brand-strong" aria-hidden="true" />
          {te.pasteFromClipboard}
        </DropdownMenuLabel>

        {count === 0 ? (
          <p className="px-2 py-5 text-center text-xs leading-6 text-muted-foreground">{te.clipboardEmpty}</p>
        ) : (
          <>
            {entries.map((entry) => {
              const Icon = TYPE_ICONS[entry.node.type as keyof typeof TYPE_ICONS];
              const time = entry.copiedAt
                ? new Date(entry.copiedAt).toLocaleTimeString(uiLocale === "ar" ? "ar" : "en", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
              return (
                <DropdownMenuItem
                  key={entry.entryId}
                  onSelect={() => onPaste(entry)}
                  className="cursor-pointer gap-2"
                  aria-label={`${te.paste} — ${entryLabel(entry.node.type, uiLocale)}`}
                >
                  {Icon ? (
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <span className="size-4 shrink-0 rounded bg-muted" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs">{entryLabel(entry.node.type, uiLocale)}</span>
                  {time && (
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums" dir="ltr">
                      {time}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClear} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
              <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
              {te.clearClipboard}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** زر نسخ إلى الحافظة — نفس نبرة أزرار شريط الأدوات العائم/شجرة الطبقات */
export function CopyToClipboardButton({
  node,
  uiLocale,
  onCopy,
  size = "md",
  className,
}: {
  node: ContentNode;
  uiLocale: Locale;
  onCopy: (id: string) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const te = getPortalContent(uiLocale).admin.editor;
  const cls =
    size === "xs"
      ? "flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      : size === "sm"
      ? "size-6 rounded text-muted-foreground transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      : "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  return (
    <button
      type="button"
      onClick={() => onCopy(node.id)}
      title={te.copyToClipboard}
      aria-label={te.copyToClipboard}
      className={cn("cursor-pointer items-center justify-center", cls, className)}
    >
      <ClipboardCopy className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" />
    </button>
  );
}
