"use client";

/**
 * شجرة الطبقات — عرض بنّي للمسودة (التبويب الثاني في لوحة المكتبة):
 * صفوف متداخلة بأسهم طي/فتح، أيقونة وتسمية كل عقدة من BLOCK_REGISTRY،
 * نقر يحدد العقدة، بحث يرشّح بالاسم/النوع (مع إبقاء الأسلاف ظاهرين)،
 * وأزرار لكل صف: إظهار/إخفاء لكل جهاز، تكرار، حذف — وقفل معلوماتي
 * للعقد التي بلغت أقصى عمق أو استنفدت سعة أبنائها.
 *
 * السحب والإفلات (بند 1.2 — G2): كل صف مقبضه GripVertical قابل للسحب عبر
 * dnd-kit (نفس مكتبة الرسم) — الإفلات على صف يُدرج قبله/بعده ضمن إخوته
 * (بحسب اتجاه السحب)، وشريط «إفلات داخل الحاوية» أسفل أبناء كل حاوية
 * موسّعة يُلحق العقدة بنهايتها — والنقل عبر الحاويات يمر بقيود اللصق نفسها
 * (حد العقد، حد العمق من موضع الهدف، قواعد أبناء الحاوية، ومنع الإفلات
 * داخل أنفاس العقدة) عبر moveNodeTo في page-editor. أثناء البحث يُعطَّل
 * السحب كله (المعرفات المرشّحة تكسر دلالات إعادة الترتيب).
 */
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Monitor,
  SearchX,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPortalContent } from "@/content/portal";
import {
  BLOCK_REGISTRY,
  MAX_TREE_DEPTH,
  findNode,
  isContainerType,
  type ContentNode,
} from "@/lib/blocks/tree";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TYPE_ICONS } from "./block-library";
import { CopyToClipboardButton } from "./clipboard-menu";

interface LayerTreeProps {
  nodes: ContentNode[];
  uiLocale: Locale;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** نقل عقدة (بشجرتها) إلى أب هدف بفهرس إدراج — يتحقق من القيود ويعرض سبب الرفض */
  onMoveTo: (id: string, targetParentId: string | null, insertIndex: number) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onVisibilityChange: (id: string, key: "mobile" | "tablet" | "desktop", value: boolean) => void;
}

/** كل المعرفات في مسار الأسلاف (بلا العقدة نفسها) */
function ancestorIds(nodes: ContentNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return trail;
    if (node.children?.length) {
      const found = ancestorIds(node.children, id, [...trail, node.id]);
      if (found) return found;
    }
  }
  return null;
}

function matchesQuery(node: ContentNode, q: string, locale: Locale): boolean {
  const def = BLOCK_REGISTRY[node.type];
  return (
    def.ar.toLowerCase().includes(q) ||
    def.en.toLowerCase().includes(q) ||
    node.type.toLowerCase().includes(q) ||
    (locale === "en" ? def.ar : def.en).toLowerCase().includes(q)
  );
}

/** إبقاء العقد المطابقة + أسلافها فقط */
function filterTree(nodes: ContentNode[], q: string, locale: Locale): ContentNode[] {
  const out: ContentNode[] = [];
  for (const node of nodes) {
    const childHits = node.children?.length ? filterTree(node.children, q, locale) : [];
    if (matchesQuery(node, q, locale) || childHits.length > 0) {
      out.push(childHits.length ? { ...node, children: childHits } : { ...node });
    }
  }
  return out;
}

export function LayerTree({
  nodes,
  uiLocale,
  selectedId,
  onSelect,
  onMoveTo,
  onDuplicate,
  onCopy,
  onDelete,
  onVisibilityChange,
}: LayerTreeProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const searching = q !== "";
  const visible = useMemo(
    () => (searching ? filterTree(nodes, q, uiLocale) : nodes),
    [nodes, q, searching, uiLocale]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id));
  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over, delta } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // شريط «إفلات داخل الحاوية» → إلحاق بنهاية أبناء الحاوية الهدف
    if (overId.startsWith("into:")) {
      const targetParentId = overId.slice("into:".length);
      const target = findNode(nodes, targetParentId);
      if (!target) return;
      onMoveTo(activeId, targetParentId, target.node.children?.length ?? 0);
      return;
    }

    const a = findNode(nodes, activeId);
    const o = findNode(nodes, overId);
    if (!a || !o) return;
    const aParent = a.parent?.id ?? null;
    const oParent = o.parent?.id ?? null;
    const overIndex = o.siblings.findIndex((n) => n.id === overId);
    if (overIndex < 0) return;

    if (aParent === oParent) {
      // إعادة ترتيب داخل نفس القائمة — دلالات arrayMove (هبوطًا بعد الهدف وصعودًا قبله)
      const oldIndex = a.siblings.findIndex((n) => n.id === activeId);
      const insertIndex = oldIndex < overIndex ? overIndex + 1 : overIndex;
      onMoveTo(activeId, aParent, insertIndex);
    } else {
      // نقل عبر الحاويات: السحب صعودًا يُدرج قبل الهدف وهبوطًا بعده
      const insertIndex = delta.y < 0 ? overIndex : overIndex + 1;
      onMoveTo(activeId, oParent, insertIndex);
    }
  };

  // أسلاف العقدة المحددة تُفتح دائمًا (اشتقاق بلا تأثير — لا يُخفى موقع التحديد)
  const selectedTrail = useMemo(
    () => (selectedId ? new Set(ancestorIds(nodes, selectedId) ?? []) : new Set<string>()),
    [nodes, selectedId]
  );

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" aria-hidden="true" />
        </span>
        <p className="text-xs text-muted-foreground">{te.noBlocks}</p>
      </div>
    );
  }

  const draggingNode = draggingId ? findNode(nodes, draggingId)?.node ?? null : null;
  const dragDisabled = searching;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={te.searchLayers}
          className="min-h-8 bg-muted/40 text-xs"
          aria-label={te.searchLayers}
        />
      </div>
      {/* تمرير أصلي — ScrollArea (display:table) كان يوسّع المحتوى لأقصى عرض
          ويُخرج الصفوف عن حدود اللوحة الضيقة فيُقتطع المقود والأزرار */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="p-2">
            <ul className="space-y-0.5">
              {visible.length === 0 ? (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">{te.noBlocks}</li>
              ) : (
                <SortableContext items={visible.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  {visible.map((node) => (
                    <LayerRow
                      key={node.id}
                      node={node}
                      depth={0}
                      dragDisabled={dragDisabled}
                      collapsed={collapsed}
                      searching={searching}
                      forceOpen={selectedTrail}
                      uiLocale={uiLocale}
                      selectedId={selectedId}
                      onToggle={toggle}
                      onSelect={onSelect}
                      onDuplicate={onDuplicate}
                      onCopy={onCopy}
                      onDelete={onDelete}
                      onVisibilityChange={onVisibilityChange}
                    />
                  ))}
                </SortableContext>
              )}
            </ul>
          </div>

          <DragOverlay>
            {draggingNode ? (
              <div
                dir={uiLocale === "ar" ? "rtl" : "ltr"}
                className="flex items-center gap-2 rounded-xl border border-brand bg-white px-3 py-1.5 shadow-lg"
              >
                <GripVertical className="size-3.5 text-brand" aria-hidden="true" />
                {(() => {
                  const Icon = TYPE_ICONS[draggingNode.type];
                  return <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" strokeWidth={1.8} />;
                })()}
                <span className="text-xs font-bold text-navy">
                  {uiLocale === "en"
                    ? BLOCK_REGISTRY[draggingNode.type].en
                    : BLOCK_REGISTRY[draggingNode.type].ar}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

interface LayerRowProps {
  node: ContentNode;
  depth: number;
  dragDisabled: boolean;
  collapsed: Set<string>;
  searching: boolean;
  forceOpen: Set<string>;
  uiLocale: Locale;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
  onVisibilityChange: (id: string, key: "mobile" | "tablet" | "desktop", value: boolean) => void;
}

/** شريط إفلات داخل حاوية — يُلحق العقدة المنقولة بنهاية أبنائها */
function IntoContainerDropZone({
  containerId,
  uiLocale,
  depth,
  disabled,
}: {
  containerId: string;
  uiLocale: Locale;
  depth: number;
  disabled: boolean;
}) {
  const te = getPortalContent(uiLocale).admin.editor;
  const { isOver, setNodeRef } = useDroppable({ id: `into:${containerId}`, disabled });
  return (
    <li style={{ paddingInlineStart: `${depth * 0.85 + 0.25}rem` }}>
      <div
        ref={setNodeRef}
        role="button"
        tabIndex={-1}
        aria-label={te.dropIntoContainer}
        className={cn(
          "mx-1 mt-0.5 flex h-5 items-center justify-center rounded-md border border-dashed text-[10px] transition-colors",
          isOver
            ? "border-brand bg-accent text-brand-strong"
            : "border-border/70 text-transparent hover:border-border"
        )}
      >
        {isOver ? <span className="font-semibold">{te.dropIntoContainer}</span> : null}
      </div>
    </li>
  );
}

function LayerRow({
  node,
  depth,
  dragDisabled,
  collapsed,
  searching,
  forceOpen,
  uiLocale,
  selectedId,
  onToggle,
  onSelect,
  onDuplicate,
  onCopy,
  onDelete,
  onVisibilityChange,
}: LayerRowProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const def = BLOCK_REGISTRY[node.type];
  const label = uiLocale === "en" ? def.en : def.ar;
  const Icon = TYPE_ICONS[node.type];
  const isContainer = isContainerType(node.type);
  const hasChildren = Boolean(node.children?.length);
  const expanded = searching || forceOpen.has(node.id) || !collapsed.has(node.id);
  const selected = selectedId === node.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id, disabled: dragDisabled });

  // قفل معلوماتي: حاوية بلغت أقصى عمق أو استنفدت سعة أبنائها
  const rule = isContainer ? def.children : undefined;
  const locked =
    isContainer &&
    (depth + 1 >= MAX_TREE_DEPTH || (rule ? (node.children?.length ?? 0) >= rule.max : false));

  const visibility = node.visibility ?? {};
  const deviceButtons = [
    { key: "mobile" as const, icon: Smartphone, title: te.hiddenOnMobile },
    { key: "tablet" as const, icon: Tablet, title: te.hiddenOnTablet },
    { key: "desktop" as const, icon: Monitor, title: te.hiddenOnDesktop },
  ];

  return (
    <li>
      <div
        ref={setNodeRef}
        style={{
          paddingInlineStart: `${depth * 0.85 + 0.25}rem`,
          transform: CSS.Translate.toString(transform),
          transition,
        }}
        className={cn(
          "group/row flex min-h-8 items-center gap-1 rounded-lg pe-1 transition-colors",
          selected ? "bg-accent/70" : "hover:bg-muted/60",
          isDragging && "opacity-40"
        )}
      >
        {/* مقبض السحب — ظاهر دائمًا (السحب من هنا لا يتعارض مع النقر للتحديد) */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`${te.layerDragHandle}: ${label}`}
          aria-roledescription="sortable"
          disabled={dragDisabled}
          className={cn(
            "flex size-4 shrink-0 touch-none items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            dragDisabled ? "cursor-not-allowed opacity-30" : "cursor-grab active:cursor-grabbing"
          )}
        >
          <GripVertical className="size-3" aria-hidden="true" />
        </button>

        {/* طي/فتح — الحاويات دائمًا قابلة للفتح حتى الفارغة (شريط الإفلات داخلها) */}
        {isContainer ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={`${label} ${expanded ? "−" : "+"}`}
            aria-expanded={expanded}
            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            ) : uiLocale === "ar" ? (
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}

        {/* الصف: أيقونة + تسمية */}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          title={label}
          aria-current={selected ? "true" : undefined}
          className={cn(
            "flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            selected ? "text-navy" : "text-foreground/80"
          )}
        >
          <Icon
            className={cn("size-3.5 shrink-0", selected ? "text-brand-strong" : "text-muted-foreground")}
            aria-hidden="true"
            strokeWidth={1.8}
          />
          <span className={cn("truncate text-xs", selected && "font-bold")}>{label}</span>
          {locked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="top">{te.maxDepthHint}</TooltipContent>
            </Tooltip>
          )}
        </button>

        {/* أزرار الصف — تظهر عند التحويم أو التحديد */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100",
            selected && "opacity-100"
          )}
        >
          {deviceButtons.map((d) => {
            const visible = visibility[d.key] !== false;
            return (
              <Tooltip key={d.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onVisibilityChange(node.id, d.key, !visible)}
                    aria-label={d.title}
                    aria-pressed={!visible}
                    className={cn(
                      "flex size-5 cursor-pointer items-center justify-center rounded transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                      visible ? "text-muted-foreground hover:text-navy" : "text-amber-600 hover:text-amber-700"
                    )}
                  >
                    {visible ? (
                      <Eye className="size-3.5" aria-hidden="true" />
                    ) : (
                      <EyeOff className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">{d.title}</TooltipContent>
              </Tooltip>
            );
          })}
          <CopyToClipboardButton node={node} uiLocale={uiLocale} onCopy={onCopy} size="xs" />
          <button
            type="button"
            onClick={() => onDuplicate(node.id)}
            title={te.duplicate}
            aria-label={te.duplicate}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            title={te.delete}
            aria-label={te.delete}
            className="flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* الأبناء + شريط الإفلات داخل الحاوية */}
      {isContainer && expanded && (
        <ul className="space-y-0.5">
          <SortableContext
            items={(node.children ?? []).map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {(node.children ?? []).map((child) => (
              <LayerRow
                key={child.id}
                node={child}
                depth={depth + 1}
                dragDisabled={dragDisabled}
                collapsed={collapsed}
                searching={searching}
                forceOpen={forceOpen}
                uiLocale={uiLocale}
                selectedId={selectedId}
                onToggle={onToggle}
                onSelect={onSelect}
                onDuplicate={onDuplicate}
                onCopy={onCopy}
                onDelete={onDelete}
                onVisibilityChange={onVisibilityChange}
              />
            ))}
          </SortableContext>
          <IntoContainerDropZone containerId={node.id} uiLocale={uiLocale} depth={depth + 1} disabled={dragDisabled} />
        </ul>
      )}
    </li>
  );
}
