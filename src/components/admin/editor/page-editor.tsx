"use client";

/**
 * محرر الصفحات — قلب لوحة المحتوى:
 * - شريط علوي: عودة، عنوان (حوار إعدادات)، تبويب لغة المسودة، مؤشر حالة الحفظ،
 *   تراجع/إعادة، أجهزة المعاينة، الإصدارات، النشر (بصلاحيته).
 * - ثلاث لوحات: المكتبة (إضافة كتل) / الرسم (عرض حي + سحب وإفلات dnd-kit) /
 *   الخصائص (نموذج عام من سجل الحقول + المظهر).
 * - تاريخ تراجع على لقطات {ar,en} (فوري للعمليات المنفصلة، مجمّل 500ms للكتابة)،
 *   حفظ تلقائي مؤجل 2000ms مع كشف تعارض 409، تحقق محلي قبل الحفظ،
 *   حارس beforeunload، نشر بعد حفظ فوري، واستعادة إصدارات إلى المسودة.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  FileWarning,
  History,
  Loader2,
  Monitor,
  Pencil,
  PlusCircle,
  Redo2,
  RotateCw,
  Search,
  Settings2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import { validateBlocks, type Block, type BlockType } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";
import { apiErrorMessage, apiGet, apiSend, ApiError } from "@/components/admin/helpers";
import type { Me } from "@/components/admin/types";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";
import { BlockLibrary } from "./block-library";
import { BlockPalette } from "./block-palette";
import { EditorCanvas, type PreviewDevice } from "./editor-canvas";
import { PropertiesPanel } from "./properties-panel";
import { PageSettingsDialog } from "./page-settings-dialog";
import { VersionsDialog } from "./versions-dialog";
import { assertDefaultProps, defaultProps } from "./prop-fields";
import {
  newBlockId,
  type DraftLocale,
  type DraftState,
  type PageDetail,
  type PageDetailResponse,
  type PatchPageResponse,
  type PublishResponse,
} from "./types";

type SaveStatus = "saved" | "saving" | "dirty" | "error";
type LoadStatus = "loading" | "ready" | "notFound" | "error" | "invalid";

interface EditorState {
  draft: DraftState;
  past: DraftState[];
  future: DraftState[];
}

interface PageEditorProps {
  me: Me;
  locale: Locale; // لغة واجهة الإدارة
  pageId: string;
}

const HISTORY_LIMIT = 50;
const AUTOSAVE_DELAY = 2000;
const HISTORY_DEBOUNCE = 500;

export function PageEditor({ me, locale, pageId }: PageEditorProps) {
  const t = getPortalContent(locale);
  const te = t.admin.editor;
  const tp = t.admin.pages;
  const canPublish = can(me, "pages.publish");

  // ——— الحالة ———
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageDetail | null>(null);
  const [state, setReactState] = useState<EditorState | null>(null);
  const stateRef = useRef<EditorState | null>(null);
  const [draftLocale, setDraftLocale] = useState<DraftLocale>(locale === "en" ? "en" : "ar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);

  // ——— تخطيط واسع؟ (يفصل بين لوحات ثابتة وأدراج الجوال) ———
  const [lgLayout, setLgLayout] = useState(false);
  const [xlLayout, setXlLayout] = useState(false);
  useEffect(() => {
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqXl = window.matchMedia("(min-width: 1280px)");
    const update = () => {
      setLgLayout(mqLg.matches);
      setXlLayout(mqXl.matches);
    };
    update();
    mqLg.addEventListener("change", update);
    mqXl.addEventListener("change", update);
    return () => {
      mqLg.removeEventListener("change", update);
      mqXl.removeEventListener("change", update);
    };
  }, []);

  // ——— مراجع الحفظ والتاريخ ———
  const lastSavedRef = useRef<{ ar: string; en: string } | null>(null);
  const loadedStampRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const pendingBaselineRef = useRef<DraftState | null>(null);
  const performSaveRef = useRef<() => Promise<boolean>>(async () => false);

  // ——— جدولة الحفظ التلقائي ———
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current !== null) return;
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void performSaveRef.current();
    }, AUTOSAVE_DELAY);
  }, []);

  // ——— الالتزام بالحالة (مرجع متزامن + حالة React + جدولة الحفظ) ———
  const commit = useCallback(
    (next: EditorState) => {
      stateRef.current = next;
      setReactState(next);
      const saved = lastSavedRef.current;
      if (!saved) return;
      const ar = JSON.stringify(next.draft.ar);
      const en = JSON.stringify(next.draft.en);
      if (ar === saved.ar && en === saved.en) {
        setSaveStatus("saved");
        return;
      }
      setSaveStatus("dirty");
      scheduleAutosave();
    },
    [scheduleAutosave]
  );

  // ——— الحفظ (يقرأ الحالة عبر المراجع) ———
  const performSave = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    if (!s) return false;
    const blocksAr = JSON.stringify(s.draft.ar);
    const blocksEn = JSON.stringify(s.draft.en);
    const saved = lastSavedRef.current;
    if (saved && blocksAr === saved.ar && blocksEn === saved.en) {
      setSaveStatus("saved");
      return true;
    }
    if (savingRef.current) return false; // حفظ جارٍ — يُعاد الجدولة عند انتهائه

    // تحقق محلي أولًا — لا تُرسل حالة غير صالحة أبدًا
    for (const json of [blocksAr, blocksEn]) {
      const check = validateBlocks(json);
      if (!check.ok) {
        setSaveStatus("error");
        toast.error(`${tp.title} — ${check.error}`);
        return false;
      }
    }

    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const res = await apiSend<PatchPageResponse>(`/api/admin/pages/${pageId}`, "PATCH", {
        draftBlocksAr: blocksAr,
        draftBlocksEn: blocksEn,
        ...(loadedStampRef.current ? { draftUpdatedAt: loadedStampRef.current } : {}),
      });
      lastSavedRef.current = { ar: blocksAr, en: blocksEn };
      loadedStampRef.current = res.page.draftUpdatedAt;
      setPage((prev) => (prev ? { ...prev, slug: res.page.slug, status: res.page.status } : prev));
      setSaveStatus("saved");
      return true;
    } catch (err) {
      // لا نجاح زائف أبدًا: المؤشر يتحول إلى «فشل الحفظ» مع زر إعادة
      setSaveStatus("error");
      if (err instanceof ApiError && err.code === "conflict") setConflictOpen(true);
      return false;
    } finally {
      savingRef.current = false;
      const cur = stateRef.current;
      const last = lastSavedRef.current;
      if (
        cur &&
        last &&
        (JSON.stringify(cur.draft.ar) !== last.ar || JSON.stringify(cur.draft.en) !== last.en)
      ) {
        scheduleAutosave();
      }
    }
  }, [pageId, scheduleAutosave, tp.title]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // ——— تاريخ التراجع ———
  const clearPendingHistory = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    pendingBaselineRef.current = null;
  }, []);

  /** عملية منفصلة (إضافة/حذف/ترتيب/نقل/مظهر): دفع فوري لما قبلها */
  const applyDiscrete = useCallback(
    (updater: (draft: DraftState) => DraftState) => {
      const s = stateRef.current;
      if (!s) return;
      clearPendingHistory();
      const next = updater(s.draft);
      commit({ draft: next, past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.draft], future: [] });
    },
    [clearPendingHistory, commit]
  );

  /** تعديل متتابع (كتابة في الحقول): دفع مجمّل بعد 500ms من السكون */
  const scheduleHistoryDebounce = useCallback(() => {
    if (historyTimerRef.current === null) {
      pendingBaselineRef.current = stateRef.current?.draft ?? null;
      historyTimerRef.current = window.setTimeout(() => {
        historyTimerRef.current = null;
        const baseline = pendingBaselineRef.current;
        pendingBaselineRef.current = null;
        const s = stateRef.current;
        if (!s || !baseline || baseline === s.draft) return;
        commit({ draft: s.draft, past: [...s.past.slice(-(HISTORY_LIMIT - 1)), baseline], future: [] });
      }, HISTORY_DEBOUNCE);
    }
  }, [commit]);

  const applyContinuous = useCallback(
    (updater: (draft: DraftState) => DraftState) => {
      const s = stateRef.current;
      if (!s) return;
      scheduleHistoryDebounce();
      commit({ draft: updater(s.draft), past: s.past, future: [] });
    },
    [commit, scheduleHistoryDebounce]
  );

  const undo = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.past.length === 0) return;
    clearPendingHistory();
    const snapshot = s.past[s.past.length - 1];
    commit({ draft: snapshot, past: s.past.slice(0, -1), future: [s.draft, ...s.future.slice(0, HISTORY_LIMIT - 1)] });
  }, [clearPendingHistory, commit]);

  const redo = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.future.length === 0) return;
    clearPendingHistory();
    const snapshot = s.future[0];
    commit({ draft: snapshot, past: [...s.past.slice(-(HISTORY_LIMIT - 1)), s.draft], future: s.future.slice(1) });
  }, [clearPendingHistory, commit]);

  // ——— تحميل الصفحة ———
  const loadPage = useCallback(async () => {
    setLoadStatus("loading");
    try {
      const res = await apiGet<PageDetailResponse>(`/api/admin/pages/${pageId}`);
      const checkAr = validateBlocks(res.page.draftBlocksAr);
      const checkEn = validateBlocks(res.page.draftBlocksEn);
      if (!checkAr.ok || !checkEn.ok) {
        setPage(res.page);
        setLoadStatus("invalid");
        return;
      }
      const draft: DraftState = { ar: checkAr.blocks, en: checkEn.blocks };
      lastSavedRef.current = { ar: JSON.stringify(draft.ar), en: JSON.stringify(draft.en) };
      loadedStampRef.current = res.page.draftUpdatedAt;
      clearPendingHistory();
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      savingRef.current = false;
      setConflictOpen(false);
      setPage(res.page);
      commit({ draft, past: [], future: [] });
      setSelectedId(null);
      setLoadStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.code === "not_found") setLoadStatus("notFound");
      else {
        setLoadError(apiErrorMessage(err, t.auth.errors));
        setLoadStatus("error");
      }
    }
  }, [clearPendingHistory, commit, pageId, t.auth.errors]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  // تحقق تطوري للخصائص الافتراضية (dev فقط)
  useEffect(() => {
    assertDefaultProps();
  }, []);

  // اختصارات لوحة المفاتيح: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+S،
  // وCtrl+/ للوحة الإضافة السريعة، وEscape لإلغاء التحديد (خارج الحوارات)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // حوار/لوحة مفتوحة؟ Escape يخصّها — تغلقه دون إلغاء تحديد الكتلة خلفها
        if (
          paletteOpen ||
          settingsOpen ||
          versionsOpen ||
          conflictOpen ||
          confirmDeleteId !== null ||
          mobileLibraryOpen ||
          mobilePropsOpen
        ) {
          return;
        }
        const target = e.target as HTMLElement | null;
        const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!inField) setSelectedId(null);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      } else if (key === "s") {
        // حفظ فوري للمسودة — مثل محررات المستندات (يعمل حتى داخل حقول التحرير)
        e.preventDefault();
        void performSaveRef.current().then((ok) => {
          if (ok) toast.success(te.saved);
        });
      } else if (key === "/") {
        // لوحة الإضافة السريعة — تعمل من أي موضع داخل المحرر (تبديل)
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    undo,
    redo,
    te.saved,
    paletteOpen,
    settingsOpen,
    versionsOpen,
    conflictOpen,
    confirmDeleteId,
    mobileLibraryOpen,
    mobilePropsOpen,
  ]);

  // ——— حارس المغادرة ———
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "error") {
        e.preventDefault();
        e.returnValue = te.leaveWarning;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus, te.leaveWarning]);

  // ——— عمليات الكتل ———
  const addBlock = useCallback(
    (type: BlockType) => {
      const s = stateRef.current;
      if (!s) return;
      const blocks = s.draft[draftLocale];
      const id = newBlockId(type, blocks.map((b) => b.id));
      const block: Block = { id, type, props: defaultProps(type) };
      const index = selectedId ? blocks.findIndex((b) => b.id === selectedId) : -1;
      const insertAt = index >= 0 ? index + 1 : blocks.length;
      applyDiscrete((draft) => {
        const list = [...draft[draftLocale]];
        list.splice(insertAt, 0, block);
        return { ...draft, [draftLocale]: list };
      });
      setSelectedId(id);
      setMobileLibraryOpen(false);
    },
    [applyDiscrete, draftLocale, selectedId]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      applyDiscrete((draft) => ({ ...draft, [draftLocale]: draft[draftLocale].filter((b) => b.id !== id) }));
      setSelectedId((cur) => (cur === id ? null : cur));
      setConfirmDeleteId(null);
    },
    [applyDiscrete, draftLocale]
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (!s) return;
      const blocks = s.draft[draftLocale];
      const index = blocks.findIndex((b) => b.id === id);
      if (index < 0) return;
      const source = blocks[index];
      const cloneId = newBlockId(source.type, blocks.map((b) => b.id));
      const clone: Block = {
        ...source,
        id: cloneId,
        props: JSON.parse(JSON.stringify(source.props)) as Record<string, unknown>,
      };
      applyDiscrete((draft) => {
        const list = [...draft[draftLocale]];
        list.splice(index + 1, 0, clone);
        return { ...draft, [draftLocale]: list };
      });
      setSelectedId(cloneId);
    },
    [applyDiscrete, draftLocale]
  );

  const moveBlock = useCallback(
    (index: number, dir: -1 | 1) => {
      applyDiscrete((draft) => {
        const list = [...draft[draftLocale]];
        const target = index + dir;
        if (target < 0 || target >= list.length) return draft;
        [list[index], list[target]] = [list[target], list[index]];
        return { ...draft, [draftLocale]: list };
      });
    },
    [applyDiscrete, draftLocale]
  );

  const reorderBlocks = useCallback(
    (ids: string[]) => {
      applyDiscrete((draft) => {
        const map = new Map(draft[draftLocale].map((b) => [b.id, b]));
        const list = ids.map((id) => map.get(id)).filter((b): b is Block => Boolean(b));
        return { ...draft, [draftLocale]: list };
      });
    },
    [applyDiscrete, draftLocale]
  );

  const updateProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      applyContinuous((draft) => ({
        ...draft,
        [draftLocale]: draft[draftLocale].map((b) => (b.id === id ? { ...b, props } : b)),
      }));
    },
    [applyContinuous, draftLocale]
  );

  const updateStyle = useCallback(
    (id: string, patch: Partial<NonNullable<Block["style"]>>) => {
      applyDiscrete((draft) => ({
        ...draft,
        [draftLocale]: draft[draftLocale].map((b) => (b.id === id ? { ...b, style: { ...(b.style ?? {}), ...patch } } : b)),
      }));
    },
    [applyDiscrete, draftLocale]
  );

  const updateVisibility = useCallback(
    (id: string, key: "mobile" | "tablet" | "desktop", value: boolean) => {
      applyDiscrete((draft) => ({
        ...draft,
        [draftLocale]: draft[draftLocale].map((b) =>
          b.id === id
            ? { ...b, visibility: { ...(b.visibility ?? { mobile: true, tablet: true, desktop: true }), [key]: value } }
            : b
        ),
      }));
    },
    [applyDiscrete, draftLocale]
  );

  const updateAnchor = useCallback(
    (id: string, anchorId: string | undefined) => {
      applyDiscrete((draft) => ({
        ...draft,
        [draftLocale]: draft[draftLocale].map((b) => (b.id === id ? { ...b, anchorId } : b)),
      }));
    },
    [applyDiscrete, draftLocale]
  );

  // ——— النشر (حفظ فوري أولًا ثم نشر) ———
  const publish = useCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const saved = await performSave();
      if (!saved) return;
      const res = await apiSend<PublishResponse>(`/api/admin/pages/${pageId}/publish`, "POST");
      toast.success(te.publishedOk);
      setPage((prev) => (prev ? { ...prev, publishedAt: res.publishedAt, status: "published" } : prev));
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setPublishing(false);
    }
  }, [pageId, performSave, publishing, t.auth.errors, te.publishedOk]);

  // ——— المشتقات ———
  const blocks = state?.draft[draftLocale] ?? [];
  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);
  const canUndo = (state?.past.length ?? 0) > 0;
  const canRedo = (state?.future.length ?? 0) > 0;
  const pageTitle = page ? (draftLocale === "en" ? page.titleEn : page.titleAr) : "";
  const liveHref = page ? (page.slug ? `/${draftLocale}/${page.slug}` : `/${draftLocale}`) : "#";

  // تحديد كتلة يفتح لوحة الخصائص كدرج على الشاشات الضيقة فقط
  useEffect(() => {
    if (selectedId && !xlLayout) setMobilePropsOpen(true);
  }, [selectedId, xlLayout]);

  // ——— حالات التحميل ———
  if (loadStatus === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[13rem_1fr] xl:grid-cols-[13rem_1fr_20rem]">
          <Skeleton className="hidden h-96 rounded-xl lg:block" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="hidden h-96 rounded-xl xl:block" />
        </div>
      </div>
    );
  }

  if (loadStatus === "notFound") {
    return <EmptyState icon={FileWarning} title={tp.empty} body={tp.emptyBody} />;
  }

  if (loadStatus === "error" || loadStatus === "invalid") {
    return (
      <EmptyState
        icon={FileWarning}
        title={te.saveFailed}
        body={loadError ?? (loadStatus === "invalid" ? `invalid_blocks` : "")}
      />
    );
  }

  // ——— مؤشر حالة الحفظ ———
  const statusIndicator =
    saveStatus === "saved" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {te.saved}
      </span>
    ) : saveStatus === "saving" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-brand-strong">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        {te.saving}
      </span>
    ) : saveStatus === "error" ? (
      <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
        {te.saveFailed}
      </span>
    ) : (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        {te.unsaved}
      </span>
    );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-3">
        {/* ——— الشريط العلوي ——— */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-10 rtl:rotate-180"
            aria-label={te.backToList}
            title={te.backToList}
          >
            <Link href={`/${locale}/admin/pages`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex min-h-10 max-w-56 cursor-pointer items-center gap-2 rounded-xl px-3 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            title={te.pageSettings}
          >
            <span className="truncate text-sm font-bold text-navy">{pageTitle}</span>
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>

          {/* تبويب لغة المسودة */}
          <Tabs
            value={draftLocale}
            onValueChange={(v) => {
              setDraftLocale(v as DraftLocale);
              setSelectedId(null);
            }}
          >
            <TabsList className="h-9">
              <TabsTrigger value="ar" className="px-3 text-xs">
                {te.ar}
              </TabsTrigger>
              <TabsTrigger value="en" className="px-3 text-xs">
                {te.en}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {statusIndicator}

          {saveStatus === "error" && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => void performSave()}
              aria-label={te.saveFailed}
              title={te.saveFailed}
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
            </Button>
          )}

          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            {/* المكتبة على الشاشات الصغيرة */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 lg:hidden"
              onClick={() => setMobileLibraryOpen(true)}
            >
              <PlusCircle className="size-4" aria-hidden="true" />
              {te.library}
            </Button>

            {/* تراجع/إعادة/الأجهزة/المعاينة/الإصدارات/الإعدادات — مقطع واحد */}
            <div className="flex flex-wrap items-center gap-1 rounded-full bg-muted/60 p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={undo}
                disabled={!canUndo}
                aria-label={te.undo}
                title={te.undo}
              >
                <Undo2 className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={redo}
                disabled={!canRedo}
                aria-label={te.redo}
                title={te.redo}
              >
                <Redo2 className="size-4" aria-hidden="true" />
              </Button>

              {/* أجهزة المعاينة */}
              <div className="flex items-center" role="group" aria-label={te.preview}>
                {(
                  [
                    { key: "desktop", icon: Monitor, label: te.deviceDesktop },
                    { key: "tablet", icon: Tablet, label: te.deviceTablet },
                    { key: "mobile", icon: Smartphone, label: te.deviceMobile },
                  ] as const
                ).map((d) => (
                  <Button
                    key={d.key}
                    type="button"
                    variant={device === d.key ? "secondary" : "ghost"}
                    size="icon"
                    className={cn("size-8", device === d.key && "bg-white text-navy shadow-sm")}
                    onClick={() => setDevice(d.key)}
                    aria-label={d.label}
                    title={d.label}
                    aria-pressed={device === d.key}
                  >
                    <d.icon className="size-4" aria-hidden="true" />
                  </Button>
                ))}
              </div>

              {/* معاينة مستقلة */}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={te.preview}
                title={te.preview}
              >
                <Link
                  href={`/${locale}/admin/pages/${pageId}/preview?locale=${draftLocale}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
              </Button>

              {/* الإصدارات */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setVersionsOpen(true)}
                aria-label={tp.versions}
                title={tp.versions}
              >
                <History className="size-4" aria-hidden="true" />
              </Button>

              {/* الإعدادات */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setSettingsOpen(true)}
                aria-label={te.pageSettings}
                title={te.pageSettings}
              >
                <Settings2 className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {/* النشر */}
            {canPublish ? (
              <Button type="button" className="min-h-9 rounded-full px-5" onClick={() => void publish()} disabled={publishing}>
                {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {te.publish}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <Button type="button" className="min-h-9 rounded-full px-5" disabled aria-disabled>
                      {te.publish}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{te.publishDisabled}</TooltipContent>
              </Tooltip>
            )}

            {/* عرض المنشور حيًّا */}
            {page?.publishedAt && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9 rounded-full"
                aria-label={te.publishedOk}
                title={te.publishedOk}
              >
                <Link href={liveHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ——— اللوحات الثلاث ——— */}
        <div className="grid min-h-0 gap-3 lg:grid-cols-[13rem_1fr] xl:grid-cols-[13rem_1fr_20rem]">
          {/* المكتبة */}
          <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:flex">
            <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-navy">{te.library}</h2>
                <p className="text-[11px] text-muted-foreground">{te.autosaveOn}</p>
              </div>
              {/* إضافة سريعة — Ctrl+/ */}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label={te.quickAdd}
                aria-keyshortcuts="Control+/"
                title={te.quickAdd}
                className="flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border/70 bg-white px-2 text-muted-foreground transition-colors hover:border-brand hover:bg-accent/20 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Search className="size-3.5" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="ltr-isolate flex items-center gap-0.5 font-mono text-[10px] leading-none"
                >
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5">Ctrl</kbd>
                  <kbd className="rounded border border-border bg-muted px-1 py-0.5">/</kbd>
                </span>
              </button>
            </header>
            <div className="min-h-0 flex-1">
              <BlockLibrary locale={locale} onAdd={addBlock} />
            </div>
          </aside>

          {/* الرسم */}
          <section className="flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-sm font-bold text-navy">{te.canvas}</h2>
              <p className="text-[11px] text-muted-foreground">
                {draftLocale === "ar" ? te.ar : te.en} · {blocks.length} {te.blocks}
              </p>
            </header>
            <div className="min-h-0 flex-1">
              <EditorCanvas
                blocks={blocks}
                locale={draftLocale}
                uiLocale={locale}
                device={device}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={reorderBlocks}
                onMove={moveBlock}
                onDuplicate={duplicateBlock}
                onDelete={setConfirmDeleteId}
              />
            </div>
          </section>

          {/* الخصائص — ثابتة على xl+ */}
          <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm xl:flex">
            {selectedBlock ? (
              <PropertiesPanel
                block={selectedBlock}
                locale={locale}
                me={me}
                onPropsChange={updateProps}
                onStyleChange={updateStyle}
                onVisibilityChange={updateVisibility}
                onAnchorChange={updateAnchor}
                onDuplicate={duplicateBlock}
                onDelete={setConfirmDeleteId}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand-strong">
                  <Settings2 className="size-6" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-navy">{te.noSelection}</p>
                <p className="text-xs leading-6 text-muted-foreground">{te.noSelectionBody}</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ——— المكتبة على الشاشات الصغيرة ——— */}
      <Sheet open={mobileLibraryOpen && !lgLayout} onOpenChange={setMobileLibraryOpen}>
        <SheetContent side={locale === "ar" ? "right" : "left"} className="w-72 p-0">
          <SheetHeader className="border-b border-border p-3">
            <SheetTitle className="text-sm">{te.library}</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100dvh-4.5rem)]">
            <BlockLibrary locale={locale} onAdd={addBlock} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ——— الخصائص على الشاشات الصغيرة ——— */}
      <Sheet
        open={mobilePropsOpen && !!selectedBlock && !xlLayout}
        onOpenChange={(o) => {
          if (!o) {
            setMobilePropsOpen(false);
            setSelectedId(null);
          }
        }}
      >
        <SheetContent side={locale === "ar" ? "left" : "right"} className="w-[22rem] max-w-[92vw] p-0 sm:max-w-[22rem]">
          <SheetHeader className="sr-only">
            <SheetTitle>{te.properties}</SheetTitle>
          </SheetHeader>
          <div className="h-full">
            {selectedBlock && (
              <PropertiesPanel
                block={selectedBlock}
                locale={locale}
                me={me}
                onPropsChange={updateProps}
                onStyleChange={updateStyle}
                onVisibilityChange={updateVisibility}
                onAnchorChange={updateAnchor}
                onDuplicate={duplicateBlock}
                onDelete={setConfirmDeleteId}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ——— تأكيد حذف كتلة ——— */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{te.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{te.dirtyIndicator}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDeleteId) deleteBlock(confirmDeleteId);
              }}
            >
              {te.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ——— تعارض التحرير ——— */}
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
              {te.conflictTitle}
            </DialogTitle>
            <DialogDescription>{te.conflictBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setConflictOpen(false);
                void loadPage();
              }}
            >
              <RotateCw className="size-4" aria-hidden="true" />
              {te.reload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ——— إعدادات الصفحة ——— */}
      {page && (
        <PageSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          page={page}
          locale={locale}
          me={me}
          draftUpdatedAt={loadedStampRef.current}
          onSaved={({ slug, loadedStamp }) => {
            setPage((prev) => (prev ? { ...prev, slug: slug ?? prev.slug } : prev));
            if (loadedStamp) loadedStampRef.current = loadedStamp;
          }}
          onConflict={() => setConflictOpen(true)}
        />
      )}

      {/* ——— الإصدارات ——— */}
      <VersionsDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        pageId={pageId}
        locale={locale}
        me={me}
        onRestored={() => void loadPage()}
      />

      {/* ——— لوحة الإضافة السريعة (Ctrl+/) ——— */}
      <BlockPalette locale={locale} open={paletteOpen} onOpenChange={setPaletteOpen} onAdd={addBlock} />
    </TooltipProvider>
  );
}
