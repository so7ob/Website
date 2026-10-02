"use client";

/**
 * لوحة الرسم (الوسط) — تعرض كتل المسودة للغة الحالية عبر PageRenderer
 * (عرض حي) داخل إطار بعرض الجهاز المحدد، كل كتل في غلاف SortableBlock:
 * حلقة تحديد عند التحويم، طبقة شفافة تمنع تنقل الروابط وتلتقط النقر
 * للتحديد، وشريط أدوات عائم (قبضة سحب + أعلى/أسفل + تكرار + حذف).
 * السحب والإفلات عبر dnd-kit بقبضة فقط حتى لا يعيق النصوص والنقر.
 */
import { memo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, LayoutGrid, Trash2 } from "lucide-react";
import { getPortalContent } from "@/content/portal";
import { BLOCK_LIBRARY, type Block, type BlockType } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { PageRenderer } from "@/components/blocks/page-renderer";
import { cn } from "@/lib/utils";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export const DEVICE_WIDTHS: Record<PreviewDevice, string> = {
  desktop: "max-w-[1280px]",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};

const BLOCK_LABELS = new Map(BLOCK_LIBRARY.map((entry) => [entry.type, entry]));

function blockLabel(type: BlockType, locale: Locale): string {
  const entry = BLOCK_LABELS.get(type);
  if (!entry) return type;
  return locale === "en" ? entry.en : entry.ar;
}

// ——— جسم الكتلة: عرض حي مُحسّن (لا يعاد رسمه إلا عند تغير الكتلة نفسها) ———

const BlockBody = memo(function BlockBody({ block, locale }: { block: Block; locale: Locale }) {
  return <PageRenderer blocks={[block]} locale={locale} />;
});

interface EditorCanvasProps {
  blocks: Block[];
  locale: Locale; // لغة المحتوى المعروض (المسودة)
  uiLocale: Locale; // لغة واجهة المحرر
  device: PreviewDevice;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (ids: string[]) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function EditorCanvas({
  blocks,
  locale,
  uiLocale,
  device,
  selectedId,
  onSelect,
  onReorder,
  onMove,
  onDuplicate,
  onDelete,
}: EditorCanvasProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id));
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(blocks, oldIndex, newIndex).map((b) => b.id));
  };

  const draggingBlock = draggingId ? blocks.find((b) => b.id === draggingId) : null;

  return (
    <div className="flex h-full flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className={cn(
            "mx-auto w-full flex-1 overflow-y-auto bg-muted/50 p-3 transition-[max-width] duration-300 sm:p-5",
            DEVICE_WIDTHS[device]
          )}
        >
          <div className="min-h-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            {blocks.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand-strong">
                  <LayoutGrid className="size-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-navy">{te.blocks}</p>
                <p className="max-w-xs text-xs leading-6 text-muted-foreground">{te.noSelectionBody}</p>
              </div>
            ) : (
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((block, index) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    index={index}
                    total={blocks.length}
                    locale={locale}
                    uiLocale={uiLocale}
                    selected={selectedId === block.id}
                    isDragging={draggingId === block.id}
                    onSelect={onSelect}
                    onMove={onMove}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </div>

        <DragOverlay>
          {draggingBlock ? (
            <div
              dir={uiLocale === "ar" ? "rtl" : "ltr"}
              className="flex items-center gap-2 rounded-xl border border-brand bg-white px-4 py-2.5 shadow-lg"
            >
              <GripVertical className="size-4 text-brand" aria-hidden="true" />
              <span className="text-sm font-semibold text-navy">{blockLabel(draggingBlock.type, uiLocale)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ——— غلاف الكتلة القابل للفرز ———

interface SortableBlockProps {
  block: Block;
  index: number;
  total: number;
  locale: Locale;
  uiLocale: Locale;
  selected: boolean;
  isDragging: boolean;
  onSelect: (id: string | null) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableBlock({
  block,
  index,
  total,
  locale,
  uiLocale,
  selected,
  isDragging,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: SortableBlockProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative transition-shadow",
        isDragging ? "z-20 opacity-40" : "",
        selected ? "z-10" : ""
      )}
    >
      <div
        className={cn(
          "relative border border-dashed border-transparent transition-[border-color,box-shadow]",
          selected ? "ring-2 ring-brand/50" : "group-hover:border-border"
        )}
      >
        {/* العرض الحي للمحتوى */}
        <BlockBody block={block} locale={locale} />

        {/* طبقة شفافة تمنع تفاعل الروابط/النماذج وتلتقط النقر للتحديد */}
        <button
          type="button"
          aria-label={`${te.selectedBlock}: ${blockLabel(block.type, uiLocale)}`}
          onClick={() => onSelect(block.id)}
          className="absolute inset-0 z-10 block h-full w-full cursor-pointer bg-transparent focus-visible:outline-none"
        />
      </div>

      {/* شريط الأدوات العائم */}
      <div
        dir={uiLocale === "ar" ? "rtl" : "ltr"}
        className={cn(
          "absolute top-2 start-2 z-20 flex items-center gap-0.5 rounded-xl border border-border bg-white/95 p-1 shadow-md backdrop-blur transition-opacity",
          selected ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
        )}
      >
        <span className="hidden max-w-36 truncate px-1.5 text-[11px] font-semibold text-muted-foreground sm:block">
          {blockLabel(block.type, uiLocale)}
        </span>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          title={te.blocks}
          aria-label={te.blocks}
          className="flex size-8 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          title={te.moveUp}
          aria-label={te.moveUp}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          title={te.moveDown}
          aria-label={te.moveDown}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowDown className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(block.id)}
          title={te.duplicate}
          aria-label={te.duplicate}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          title={te.delete}
          aria-label={te.delete}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
