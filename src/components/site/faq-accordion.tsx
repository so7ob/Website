"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

/**
 * أكورديون الأسئلة — مبني على Radix: قابل للوحة المفاتيح بالكامل
 * (أسهم للتنقل، Enter/Space للفتح)، بحالات aria-expanded واضحة.
 */
export function FaqAccordion({ items, selected }: { items: { q: string; a: string }[]; selected?: number[] }) {
  const list = selected ? selected.map((i) => items[i]).filter(Boolean) : items;

  return (
    <Accordion.Root type="single" collapsible className="space-y-3">
      {list.map((item) => (
        <Accordion.Item
          key={item.q}
          value={item.q}
          className="overflow-hidden rounded-xl border border-border bg-white transition-colors data-[state=open]:border-brand/40"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-[15px] font-bold text-navy transition-colors hover:text-brand sm:px-6 sm:py-5">
              {item.q}
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-brand-strong transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden="true"
              >
                <ChevronDown className="h-4 w-4" />
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <p className="border-t border-border/70 px-5 py-4 text-[15px] leading-8 text-muted-foreground sm:px-6">{item.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
