"use client";

/**
 * ترقيم صفحات: أزرار رقمية بنافذة حول الصفحة الحالية + السابق/التالي ومؤشر النطاق.
 * نصوص منطقية فقط (أرقام ورموز) — الأيقونات تنعكس مع اتجاه اللغة.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { totalPages } from "./helpers";
import type { Locale } from "@/lib/i18n";

interface AdminPaginationProps {
  page: number;
  total: number;
  pageSize: number;
  locale: Locale;
  onPage: (page: number) => void;
  className?: string;
}

/** بناء نافذة أرقام الصفحات: تُعرض كلها إن قلّت، وإلا الأولى والأخيرة ± الجارية مع فجوات */
function pageItems(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) items.push("gap");
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pages - 1) items.push("gap");
  items.push(pages);
  return items;
}

export function AdminPagination({ page, total, pageSize, locale, onPage, className }: AdminPaginationProps) {
  const pages = totalPages(total, pageSize);
  if (total <= 0) return null;

  // في العربية «التالي» يشير لليسار والعكس صحيح
  const NextIcon = locale === "ar" ? ChevronLeft : ChevronRight;
  const PrevIcon = locale === "ar" ? ChevronRight : ChevronLeft;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const items = pageItems(page, pages);

  return (
    <nav className={cn("flex flex-wrap items-center justify-between gap-3 pt-2", className)}>
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {from}–{to} / {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-100 disabled:text-muted-foreground/50"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={String(page - 1)}
        >
          <PrevIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        {items.map((item, i) =>
          item === "gap" ? (
            <span
              key={`gap-${i}`}
              className="flex h-10 w-5 select-none items-center justify-center text-xs text-muted-foreground/60"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "size-10 rounded-full text-sm font-medium tabular-nums transition-colors",
                item === page
                  ? "border-transparent bg-navy text-white hover:bg-navy hover:text-white"
                  : "hover:bg-muted"
              )}
              onClick={() => onPage(item)}
              aria-label={String(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-100 disabled:text-muted-foreground/50"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={String(page + 1)}
        >
          <NextIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
