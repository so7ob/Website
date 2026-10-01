"use client";

/**
 * مكتبة الكتل (اللوحة اليسرى/الأولى) — كل الأنواع مجمعة حسب BLOCK_LIBRARY
 * مع أيقونة واسم بلغة الواجهة؛ النقر يضيف كتلة بعد المحدد أو في النهاية.
 */
import { type LucideIcon } from "lucide-react";
import {
  Rocket,
  LayoutGrid,
  Grid3x3,
  Briefcase,
  ListOrdered,
  CircleHelp,
  Megaphone,
  PanelTop,
  FileText,
  Compass,
  Hash,
  Navigation,
  Layers,
  FolderOpen,
  Workflow,
  ClipboardList,
  Phone,
  Heading2,
  Type,
  Image,
  Images,
  MousePointerClick,
  Columns3,
  Table,
  Minus,
  MoveVertical,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPortalContent } from "@/content/portal";
import { BLOCK_LIBRARY, type BlockType } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<BlockType, LucideIcon> = {
  hero: Rocket,
  servicesGrid: LayoutGrid,
  featureGrid: Grid3x3,
  worksShowcase: Briefcase,
  processSteps: ListOrdered,
  faqSection: CircleHelp,
  ctaSection: Megaphone,
  pageHeader: PanelTop,
  richText: FileText,
  visionMission: Compass,
  numberedValues: Hash,
  numberedList: ListOrdered,
  navCtaBanner: Navigation,
  servicesDetail: Layers,
  worksFull: FolderOpen,
  processFull: Workflow,
  requestForm: ClipboardList,
  contactInfo: Phone,
  heading: Heading2,
  text: Type,
  image: Image,
  gallery: Images,
  buttonLink: MousePointerClick,
  columns: Columns3,
  simpleTable: Table,
  divider: Minus,
  spacer: MoveVertical,
};

const GROUP_ORDER = ["home", "pages", "generic", "layout"] as const;

interface BlockLibraryProps {
  locale: Locale;
  onAdd: (type: BlockType) => void;
  className?: string;
}

export function BlockLibrary({ locale, onAdd, className }: BlockLibraryProps) {
  const t = getPortalContent(locale).admin.editor;

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="space-y-5 p-3">
        {GROUP_ORDER.map((group) => {
          const items = BLOCK_LIBRARY.filter((entry) => entry.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`lib-group-${group}`}>
              <h3 id={`lib-group-${group}`} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.groups[group]}
              </h3>
              <ul className="space-y-1">
                {items.map((entry) => {
                  const Icon = TYPE_ICONS[entry.type];
                  return (
                    <li key={entry.type}>
                      <button
                        type="button"
                        onClick={() => onAdd(entry.type)}
                        title={t.addBlock}
                        className="flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white px-3 text-start text-sm font-medium text-navy transition-all hover:border-brand/40 hover:bg-accent/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-strong">
                          <Icon className="size-4" aria-hidden="true" strokeWidth={1.8} />
                        </span>
                        <span className="truncate">{locale === "en" ? entry.en : entry.ar}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </ScrollArea>
  );
}
