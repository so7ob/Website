"use client";

/**
 * دليل المحرر — نافذة مساعدة ثنائية اللغة داخل التطبيق.
 *
 * - ستة أقسام موسوعية (نظرة عامة، المكتبة والرسم، التحرير المباشر، الحفظ والمراجعات،
 *   الإصدارات والقوالب، النشر والجدولة) في أكورديون قابل للفلترة بكلمة مفتاحية.
 * - جدول اختصارات لوحة المفاتيح الفعلية للمحرر (مطابق للمعالجات في page-editor).
 * - الفلترة تخفي الأقسام غير المطابقة وتعرض حالة «لا نتائج» عند الضرورة.
 * - يُفتح من زر الشريط العلوي أو F1 / ؟ (انظر page-editor).
 */
import { useMemo, useState } from "react";
import {
  BookOpen,
  History,
  LayoutDashboard,
  MousePointerClick,
  PenLine,
  Save,
  Search,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { getPortalContent } from "@/content/portal";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface EditorGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}

/** أيقونات الأقسام بترتيبها في المحتوى — ثابتة بالموضع لا بالمفتاح */
const SECTION_ICONS: LucideIcon[] = [
  LayoutDashboard,
  MousePointerClick,
  PenLine,
  Save,
  History,
  Send,
];

const SECTION_ICON_STYLES = [
  "bg-brand-soft text-brand-strong",
  "bg-skydrop/20 text-brand-strong",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

export function EditorGuide({ open, onOpenChange, locale }: EditorGuideProps) {
  const t = getPortalContent(locale);
  const g = t.admin.editor.editorGuide;
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    if (!q) return g.sections.map((s, i) => ({ ...s, index: i }));
    return g.sections
      .map((s, i) => ({ ...s, index: i }))
      .filter((s) => {
        const haystack = [s.title, ...s.body].join(" ").toLowerCase();
        return haystack.includes(q);
      });
  }, [g.sections, q]);

  const visibleShortcuts = useMemo(() => {
    if (!q) return g.shortcuts;
    return g.shortcuts.filter((s) =>
      `${s.keys} ${s.description}`.toLowerCase().includes(q)
    );
  }, [g.shortcuts, q]);

  const nothing = visibleSections.length === 0 && visibleShortcuts.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQuery(""); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1.5 border-b border-border bg-gradient-to-b from-brand-soft/60 to-transparent p-5">
          <DialogTitle className="flex items-center gap-2.5 text-navy">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
              <BookOpen className="size-5" aria-hidden="true" />
            </span>
            {g.title}
            <span className="ms-auto hidden items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground sm:inline-flex" dir="ltr">
              {g.openHint}
            </span>
          </DialogTitle>
          <DialogDescription className="text-start">{g.description}</DialogDescription>
        </DialogHeader>

        {/* فلترة الدليل */}
        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground start-3" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={g.filterPlaceholder}
              aria-label={g.filterPlaceholder}
              className="h-10 rounded-xl ps-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {nothing ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-navy">{g.noResults}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleSections.length > 0 && (
                <Accordion
                  key={q}
                  type="multiple"
                  // عند البحث تُفتح كل الأقسام المطابقة تلقائيًا؛ بلا بحث يُفتح القسم الأول فقط
                  defaultValue={(q ? visibleSections : visibleSections.slice(0, 1)).map((s) => `sec-${s.index}`)}
                >
                  {visibleSections.map((s) => {
                    const Icon = SECTION_ICONS[s.index] ?? BookOpen;
                    const tone = SECTION_ICON_STYLES[s.index] ?? "bg-muted text-muted-foreground";
                    return (
                      <AccordionItem key={s.index} value={`sec-${s.index}`} className="border-border/70">
                        <AccordionTrigger className="gap-3 rounded-xl px-2 py-3 text-start hover:bg-muted/50 hover:no-underline">
                          <span className="flex items-center gap-3">
                            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                              <Icon className="size-4" aria-hidden="true" />
                            </span>
                            <span className="text-sm font-bold text-navy">{s.title}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2.5 px-2 pb-3">
                          {s.body.map((paragraph, pi) => (
                            <p key={pi} className="text-sm leading-6 text-muted-foreground">
                              {paragraph}
                            </p>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}

              {visibleShortcuts.length > 0 && (
                <section aria-label={g.shortcutsTitle} className="rounded-2xl border border-border bg-muted/30 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-navy">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy/10 text-navy">
                      <BookOpen className="size-4" aria-hidden="true" />
                    </span>
                    {g.shortcutsTitle}
                  </h3>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {visibleShortcuts.map((s) => (
                      <li key={s.keys} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
                        <span className="text-xs text-muted-foreground">{s.description}</span>
                        <kbd className="ltr-isolate shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-navy" dir="ltr">
                          {s.keys}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
