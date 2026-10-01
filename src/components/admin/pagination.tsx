"use client";

/**
 * ترقيم صفحات بسيط: السابق/التالي + مؤشر رقمي (صفحة/إجمالي) ونطاق الصفوف.
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

export function AdminPagination({ page, total, pageSize, locale, onPage, className }: AdminPaginationProps) {
  const pages = totalPages(total, pageSize);
  if (total <= 0) return null;

  // في العربية «التالي» يشير لليسار والعكس صحيح
  const NextIcon = locale === "ar" ? ChevronLeft : ChevronRight;
  const PrevIcon = locale === "ar" ? ChevronRight : ChevronLeft;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

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
          className="size-9"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={String(page - 1)}
        >
          <PrevIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="min-w-16 text-center text-sm font-medium tabular-nums text-foreground">
          {page} / {pages}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
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
