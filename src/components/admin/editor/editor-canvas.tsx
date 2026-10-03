"use client";

/**
 * لوحة الرسم (الوسط) — عرض شجري تفاعلي لمسودة الشجرة v1:
 * - كل عقدة (حاوية أو ورقية) في غلاف قابل للفرز (dnd-kit) مع حلقة تحديد،
 *   شريط أدوات عائم (قبضة سحب + أعلى/أسفل + تكرار + حذف) وزر «إضافة عنصر»
 *   للحاويات (قائمة أنواع مفروزة وفق قواعد الأبناء في BLOCK_REGISTRY).
 * - الحاويات ترسم بنيتها نفسها (قسم بعرض موقع / صف شبكة / عمود كومة / صندوق)
 *   وتستضيف SortableContext خاصًا بأبنائها — تعشيق حقيقي حتى MAX_TREE_DEPTH.
 * - السحب يعيد الترتيب داخل نفس القائمة فقط؛ الإفلات عبر الحاويات يُتجاهل.
 * - وضع الاختبار (test): بلا غلاف مانع — أزرار تحديد صغيرة بالأركان حتى
 *   يعمل التفاعل الحقيقي (روابط/نماذج — الإرسال محاكى في العارض).
 */
import { memo, useMemo, useState } from "react";
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
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  LayoutGrid,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPortalContent } from "@/content/portal";
import {
  BLOCK_REGISTRY,
  LIBRARY_HIDDEN_TYPES,
  MAX_TREE_DEPTH,
  findNode,
  isContainerType,
  type ContentNode,
} from "@/lib/blocks/tree";
import { nodeStyleClasses, nodeAlignClasses } from "@/lib/blocks/style";
import { isInlineEditableType } from "@/lib/blocks/inline-fields";
import { InlineEditSessionContext, type InlineEditSession } from "@/components/blocks/inline-edit-context";
import type { BlockType } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { PageRenderer } from "@/components/blocks/page-renderer";
import type { RenderMode } from "@/components/blocks/nested-context";
import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "./block-library";
import { CopyToClipboardButton } from "./clipboard-menu";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export const DEVICE_WIDTHS: Record<PreviewDevice, string> = {
  desktop: "max-w-[1280px]",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};

const DEVICE_PX: Record<PreviewDevice, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

export { DEVICE_PX };

function nodeLabel(type: BlockType, locale: Locale): string {
  const def = BLOCK_REGISTRY[type];
  return locale === "en" ? def.en : def.ar;
}

/** صنف إخفاء حسب الجهاز (نسخة المحرر من سلوك العارض) */
function visibilityClasses(visibility: ContentNode["visibility"]): string {
  return [
    visibility?.mobile === false ? "max-md:hidden" : "",
    visibility?.tablet === false ? "md:max-lg:hidden" : "",
    visibility?.desktop === false ? "lg:hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── خريطة الشبكة للصف (مطابقة للعارض) ───

const ROW_GRID_DESKTOP: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const ROW_GRID_TABLET: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const COLUMN_SPAN: Record<string, string> = {
  "1": "lg:col-span-1",
  "2": "lg:col-span-2",
  "3": "lg:col-span-3",
  "4": "lg:col-span-4",
};

const GAP_CLASS: Record<string, string> = {
  xs: "gap-2",
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-10",
};

function asStringProp(props: unknown, key: string, fallback: string): string {
  if (typeof props !== "object" || props === null) return fallback;
  const v = (props as Record<string, unknown>)[key];
  return typeof v === "string" ? v : fallback;
}

// ─── جسم الكتلة الورقية: عرض حي مُحسّن ───

const LeafBody = memo(function LeafBody({
  node,
  locale,
  mode,
  session,
}: {
  node: ContentNode;
  locale: Locale;
  mode: RenderMode;
  session: InlineEditSession | null;
}) {
  return (
    <InlineEditSessionContext.Provider value={session}>
      <PageRenderer nodes={[node]} locale={locale} mode={mode} />
    </InlineEditSessionContext.Provider>
  );
});

// ─── قائمة «إضافة عنصر» المفروزة وفق قواعد الأبناء ───

interface AddChildMenuProps {
  parentId: string;
  allowed: readonly BlockType[];
  uiLocale: Locale;
  align?: "start" | "center" | "end";
  onAddChild: (parentId: string, type: BlockType) => void;
  children: React.ReactNode;
}

function AddChildMenu({ parentId, allowed, uiLocale, align = "start", onAddChild, children }: AddChildMenuProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  if (allowed.length === 0) return <>{children}</>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{te.selectType}</DropdownMenuLabel>
        {allowed.map((type) => {
          const Icon = TYPE_ICONS[type];
          const def = BLOCK_REGISTRY[type];
          return (
            <DropdownMenuItem
              key={type}
              onClick={() => onAddChild(parentId, type)}
              className="cursor-pointer gap-2.5 text-sm"
            >
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" strokeWidth={1.8} />
              {uiLocale === "en" ? def.en : def.ar}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** الأنواع المسموح إدراجها داخل حاوية — بعد استثناء الأنواع المُرحّلة */
function allowedChildrenFor(type: BlockType): BlockType[] {
  const rule = BLOCK_REGISTRY[type].children;
  return rule ? rule.allowed.filter((t) => !LIBRARY_HIDDEN_TYPES.includes(t)) : [];
}

// ─── اللوحة ───

interface EditorCanvasProps {
  nodes: ContentNode[];
  locale: Locale; // لغة المحتوى المعروض (المسودة)
  uiLocale: Locale; // لغة واجهة المحرر
  device: PreviewDevice;
  mode: RenderMode; // edit — غلاف مانع للتفاعل / test — تفاعل حقيقي محاكى الإرسال
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** نقل داخل الإخوة (زر أعلى/أسفل) */
  onMove: (id: string, dir: -1 | 1) => void;
  /** إعادة ترتيب قائمة أبناء والد معين (null = الجذر) */
  onReorder: (parentId: string | null, ids: string[]) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type: BlockType) => void;
  /** جلسة التحرير النصي المباشر — معرف العقدة أو null */
  inlineEditId: string | null;
  onInlineEditBegin: (id: string) => void;
  onInlineEditEnd: () => void;
  onInlineChange: (id: string, field: string, value: string) => void;
}

export function EditorCanvas({
  nodes,
  locale,
  uiLocale,
  device,
  mode,
  selectedId,
  onSelect,
  onMove,
  onReorder,
  onDuplicate,
  onCopy,
  onDelete,
  onAddChild,
  inlineEditId,
  onInlineEditBegin,
  onInlineEditEnd,
  onInlineChange,
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
    const a = findNode(nodes, String(active.id));
    const o = findNode(nodes, String(over.id));
    if (!a || !o) return;
    // الإفلات عبر حاويتين مختلفتين يُتجاهل — الترتيب داخل قائمة الأبناء نفسها فقط
    const aParent = a.parent?.id ?? null;
    const oParent = o.parent?.id ?? null;
    if (aParent !== oParent) return;
    const oldIndex = a.siblings.findIndex((n) => n.id === active.id);
    const newIndex = o.siblings.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(aParent, arrayMove(a.siblings, oldIndex, newIndex).map((n) => n.id));
  };

  const draggingNode = draggingId ? findNode(nodes, draggingId)?.node ?? null : null;

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
            {nodes.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand-strong">
                  <LayoutGrid className="size-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-navy">{te.blocks}</p>
                <p className="max-w-xs text-xs leading-6 text-muted-foreground">{te.noSelectionBody}</p>
              </div>
            ) : (
              <div className="pt-2.5">
                <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  {nodes.map((node, index) => (
                    <NodeWrapper
                      key={node.id}
                      node={node}
                      parentId={null}
                      index={index}
                      total={nodes.length}
                      depth={1}
                      locale={locale}
                      uiLocale={uiLocale}
                      mode={mode}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      onMove={onMove}
                      onDuplicate={onDuplicate}
                      onCopy={onCopy}
                      onDelete={onDelete}
                      onAddChild={onAddChild}
                      inlineEditId={inlineEditId}
                      onInlineEditBegin={onInlineEditBegin}
                      onInlineEditEnd={onInlineEditEnd}
                      onInlineChange={onInlineChange}
                    />
                  ))}
                </SortableContext>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {draggingNode ? (
            <div
              dir={uiLocale === "ar" ? "rtl" : "ltr"}
              className="flex items-center gap-2 rounded-xl border border-brand bg-white px-4 py-2.5 shadow-lg"
            >
              <GripVertical className="size-4 text-brand" aria-hidden="true" />
              <span className="text-sm font-semibold text-navy">{nodeLabel(draggingNode.type, uiLocale)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ─── غلاف العقدة القابل للفرز (تعشيق شجري) ───

interface NodeWrapperProps {
  node: ContentNode;
  parentId: string | null;
  index: number;
  total: number;
  depth: number;
  locale: Locale;
  uiLocale: Locale;
  mode: RenderMode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type: BlockType) => void;
  inlineEditId: string | null;
  onInlineEditBegin: (id: string) => void;
  onInlineEditEnd: () => void;
  onInlineChange: (id: string, field: string, value: string) => void;
}

function NodeWrapper({
  node,
  parentId,
  index,
  total,
  depth,
  locale,
  uiLocale,
  mode,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onCopy,
  onDelete,
  onAddChild,
  inlineEditId,
  onInlineEditBegin,
  onInlineEditEnd,
  onInlineChange,
}: NodeWrapperProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: node.id });
  const selected = selectedId === node.id;
  const isContainer = isContainerType(node.type);
  const label = nodeLabel(node.type, uiLocale);
  const testMode = mode === "test";
  const inlineEditing = !testMode && inlineEditId === node.id;
  const inlineEditable = !isContainer && isInlineEditableType(node.type);

  // جلسة هذه العقدة — كائن ثابت الهوية عبر إعادة الرسم حتى لا يُعاد التركيز
  const session = useMemo<InlineEditSession | null>(
    () =>
      inlineEditing
        ? {
            nodeId: node.id,
            onChange: (field, value) => onInlineChange(node.id, field, value),
            onEnd: onInlineEditEnd,
          }
        : null,
    [inlineEditing, node.id, onInlineChange, onInlineEditEnd]
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-inline-edit-node={inlineEditing ? node.id : undefined}
      className={cn(
        "group relative transition-shadow",
        selected || inlineEditing ? "z-10" : "",
        parentId !== null && "min-w-0"
      )}
    >
      <div
        className={cn(
          "relative rounded-sm",
          isContainer && !testMode && "outline outline-1 outline-dashed outline-border/40 group-hover:outline-brand/40",
          !isContainer && "border border-dashed border-transparent group-hover:border-border",
          selected && "ring-2 ring-brand/50",
          inlineEditing && "ring-2 ring-brand bg-brand/[0.02]"
        )}
      >
        {/* وضع الاختبار: زر تحديد صغير بالركن بدل الغلاف المانع — التفاعل الحقيقي يعمل */}
        {testMode && (
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-label={`${te.selectedBlock}: ${label}`}
            title={`${te.selectedBlock}: ${label}`}
            className="absolute end-1 top-1 z-30 flex size-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-white/90 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <MousePointerClick className="size-3.5" aria-hidden="true" />
          </button>
        )}

        {isContainer ? (
          <>
            {/* غلاف الالتقاط يُرسم قبل الأبناء — يلتقط الفراغ ولا يحجب العناصر الداخلية */}
            {!testMode && (
              <button
                type="button"
                aria-label={`${te.selectedBlock}: ${label}`}
                onClick={() => onSelect(node.id)}
                className="absolute inset-0 block h-full w-full cursor-pointer bg-transparent focus-visible:outline-none"
              />
            )}
            <ContainerBody
              node={node}
              depth={depth}
              locale={locale}
              uiLocale={uiLocale}
              mode={mode}
              selectedId={selectedId}
              onSelect={onSelect}
              onMove={onMove}
              onDuplicate={onDuplicate}
              onCopy={onCopy}
              onDelete={onDelete}
              onAddChild={onAddChild}
              inlineEditId={inlineEditId}
              onInlineEditBegin={onInlineEditBegin}
              onInlineEditEnd={onInlineEditEnd}
              onInlineChange={onInlineChange}
            />
          </>
        ) : (
          <>
            <LeafBody node={node} locale={locale} mode={mode} session={session} />
            {/* طبقة شفافة تمنع تفاعل الروابط/النماذج وتلتقط النقر للتحديد —
                والنقر المزدوج يفتح التحرير المباشر للأنواع النصية.
                أثناء الجلسة تُزال الطبقة كي يعمل caret داخل النص */}
            {!testMode && !inlineEditing && (
              <button
                type="button"
                aria-label={`${te.selectedBlock}: ${label}`}
                title={inlineEditable ? te.inlineEditHint : undefined}
                onClick={() => onSelect(node.id)}
                onDoubleClick={() => inlineEditable && onInlineEditBegin(node.id)}
                className="absolute inset-0 z-10 block h-full w-full cursor-pointer bg-transparent focus-visible:outline-none"
              />
            )}
          </>
        )}

        {/* شارة نوع الحاوية — مساعد التعشيق (تحرير فقط) */}
        {isContainer && !testMode && (
          <span className="pointer-events-none absolute -top-2 start-3 z-30 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold leading-4 text-navy">
            {label}
          </span>
        )}

        {/* شارة جلسة التحرير المباشر */}
        {inlineEditing && (
          <span
            dir={uiLocale === "ar" ? "rtl" : "ltr"}
            className="pointer-events-none absolute -top-2.5 start-3 z-30 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold leading-4 text-white shadow-sm"
          >
            <Pencil className="size-2.5" aria-hidden="true" />
            {te.inlineEditingBadge}
          </span>
        )}
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
          {label}
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
        {isContainer && (
          <AddChildMenu parentId={node.id} allowed={allowedChildrenFor(node.type)} uiLocale={uiLocale} onAddChild={onAddChild}>
            <button
              type="button"
              title={te.addChild}
              aria-label={te.addChild}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </AddChildMenu>
        )}
        {!isContainer && inlineEditable && !testMode && (
          <button
            type="button"
            onClick={() => onInlineEditBegin(node.id)}
            title={te.inlineEdit}
            aria-label={te.inlineEdit}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              inlineEditing
                ? "bg-brand text-white"
                : "text-muted-foreground hover:bg-accent hover:text-brand-strong"
            )}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onMove(node.id, -1)}
          disabled={index === 0}
          title={te.moveUp}
          aria-label={te.moveUp}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(node.id, 1)}
          disabled={index === total - 1}
          title={te.moveDown}
          aria-label={te.moveDown}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowDown className="size-4" aria-hidden="true" />
        </button>
        <CopyToClipboardButton node={node} uiLocale={uiLocale} onCopy={onCopy} />
        <button
          type="button"
          onClick={() => onDuplicate(node.id)}
          title={te.duplicate}
          aria-label={te.duplicate}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(node.id)}
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

// ─── بنية الحاوية (مطابقة للعارض) + أبناؤها التفاعليون ───

interface ContainerBodyProps {
  node: ContentNode;
  depth: number;
  locale: Locale;
  uiLocale: Locale;
  mode: RenderMode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type: BlockType) => void;
  inlineEditId: string | null;
  onInlineEditBegin: (id: string) => void;
  onInlineEditEnd: () => void;
  onInlineChange: (id: string, field: string, value: string) => void;
}

function ContainerBody({
  node,
  depth,
  locale,
  uiLocale,
  mode,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onCopy,
  onDelete,
  onAddChild,
  inlineEditId,
  onInlineEditBegin,
  onInlineEditEnd,
  onInlineChange,
}: ContainerBodyProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const type = node.type;
  const styleClasses = nodeStyleClasses(node.style);
  const visClass = visibilityClasses(node.visibility);
  const children = node.children ?? [];
  const canNest = depth < MAX_TREE_DEPTH;
  const allowed = allowedChildrenFor(node.type);

  const renderChildren = () => {
    if (!canNest) {
      return (
        <p className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
          {te.maxDepthHint}
        </p>
      );
    }
    if (children.length === 0) {
      return (
        <AddChildMenu parentId={node.id} allowed={allowed} uiLocale={uiLocale} align="center" onAddChild={onAddChild}>
          <button
            type="button"
            className="relative z-10 flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border p-6 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:bg-accent/20 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Plus className="size-4" aria-hidden="true" />
            {te.emptyContainer}
          </button>
        </AddChildMenu>
      );
    }
    return (
      <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {children.map((child, index) => (
          <NodeWrapper
            key={child.id}
            node={child}
            parentId={node.id}
            index={index}
            total={children.length}
            depth={depth + 1}
            locale={locale}
            uiLocale={uiLocale}
            mode={mode}
            selectedId={selectedId}
            onSelect={onSelect}
            onMove={onMove}
            onDuplicate={onDuplicate}
            onCopy={onCopy}
            onDelete={onDelete}
            onAddChild={onAddChild}
            inlineEditId={inlineEditId}
            onInlineEditBegin={onInlineEditBegin}
            onInlineEditEnd={onInlineEditEnd}
            onInlineChange={onInlineChange}
          />
        ))}
      </SortableContext>
    );
  };

  if (type === "section") {
    return (
      <section className={`${styleClasses} ${visClass}`.trim() || undefined}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{renderChildren()}</div>
      </section>
    );
  }

  if (type === "row") {
    const count = children.length;
    const declared =
      typeof (node.props as Record<string, unknown> | undefined)?.columns === "number"
        ? ((node.props as Record<string, unknown>).columns as number)
        : null;
    const desktopCount = Math.min(6, Math.max(1, declared ?? count));
    const tabletCount = Math.min(4, Math.max(1, Math.ceil(desktopCount / 2)));
    const gap = GAP_CLASS[asStringProp(node.props, "gap", "md")] ?? "gap-6";
    return (
      <div
        className={`grid grid-cols-1 ${ROW_GRID_TABLET[tabletCount]} ${ROW_GRID_DESKTOP[desktopCount]} ${gap} ${styleClasses} ${visClass}`.trim()}
      >
        {renderChildren()}
      </div>
    );
  }

  if (type === "column") {
    const gap = GAP_CLASS[asStringProp(node.props, "gap", "md")] ?? "gap-6";
    const span = COLUMN_SPAN[asStringProp(node.props, "span", "auto")] ?? "";
    const align = nodeAlignClasses(node.style);
    return (
      <div className={`flex flex-col ${gap} ${align} ${span} ${styleClasses} ${visClass}`.trim()}>{renderChildren()}</div>
    );
  }

  // container — صندوق عام
  return <div className={`${styleClasses} ${visClass}`.trim() || undefined}>{renderChildren()}</div>;
}
