"use client";

/**
 * لوحة الإضافة السريعة (Ctrl+/) — حوار بحث فوري في مكتبة الكتل:
 * البحث يقارن الاسمين العربي والإنجليزي معًا (غير حسّاس للحالة)،
 * فالكتابة «Hero» تعمل في الواجهة العربية و«واجهة» في الإنجليزية.
 * الأسهم تنقّل بين النتائج وEnter يُدرج الكتلة النشطة —
 * الإدراج يتم بنفس onAdd الذي تستخدمه المكتبة الجانبية.
 */
import { useState } from "react";
import { SearchX } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPortalContent } from "@/content/portal";
import { BLOCK_LIBRARY, type BlockType } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { TYPE_ICONS } from "./block-library";

interface BlockPaletteProps {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** نفس مُرتجع الإضافة الذي تستخدمه المكتبة الجانبية */
  onAdd: (type: BlockType) => void;
}

export function BlockPalette({ locale, open, onOpenChange, onAdd }: BlockPaletteProps) {
  const te = getPortalContent(locale).admin.editor;
  const [query, setQuery] = useState("");

  // بحث ثنائي اللغة: يقارن الاسمين معًا ويحفظ ترتيب BLOCK_LIBRARY
  const q = query.trim().toLowerCase();
  const results =
    q === ""
      ? BLOCK_LIBRARY
      : BLOCK_LIBRARY.filter(
          (entry) => entry.ar.toLowerCase().includes(q) || entry.en.toLowerCase().includes(q)
        );

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };

  const handleSelect = (type: BlockType) => {
    handleOpenChange(false);
    onAdd(type);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-label={te.quickAdd}
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{te.quickAdd}</DialogTitle>
          <DialogDescription>{te.searchBlocks}</DialogDescription>
        </DialogHeader>
        {/* shouldFilter={false}: التصفية هنا يدوية لتشمل الاسمين معًا؛
            التنقّل بالأسهم وتحديد العنصر النشط يتولاه cmdk */}
        <Command
          shouldFilter={false}
          label={te.searchBlocks}
          className="[&_[data-slot=command-input-wrapper]]:min-h-11"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={te.searchBlocks}
            className="min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <CommandList label={te.quickAdd} className="max-h-80 p-2">
            {results.map((entry) => {
              const Icon = TYPE_ICONS[entry.type];
              return (
                <CommandItem
                  key={entry.type}
                  value={entry.type}
                  onSelect={() => handleSelect(entry.type)}
                  className="min-h-11 cursor-pointer gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/50 data-[selected=true]:bg-accent/60 data-[selected=true]:hover:bg-accent/60"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                    <Icon className="size-4" aria-hidden="true" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-navy">
                    {locale === "en" ? entry.en : entry.ar}
                  </span>
                  <span className="ms-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {te.groups[entry.group]}
                  </span>
                </CommandItem>
              );
            })}
            <CommandEmpty>
              <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <SearchX className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-2 text-sm text-muted-foreground">{te.noBlocks}</p>
            </CommandEmpty>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
