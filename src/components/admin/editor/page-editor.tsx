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
  AppWindow,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  FileWarning,
  FlaskConical,
  History,
  Info,
  Eraser,
  LayoutTemplate,
  Loader2,
  Monitor,
  Pencil,
  PlusCircle,
  RefreshCw,
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
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import { type BlockType } from "@/lib/blocks/types";
import {
  BLOCK_REGISTRY,
  LIBRARY_HIDDEN_TYPES,
  MAX_TREE_DEPTH,
  MAX_TREE_NODES,
  cloneWithNewIds,
  collectIds,
  countNodes,
  defaultNode,
  findNode,
  isContainerType,
  removeNode,
  type ContentNode,
} from "@/lib/blocks/tree";
import type { NodeStyle } from "@/lib/blocks/style";
import { validateContent } from "@/lib/blocks/validate";
import { applyInlineField, isInlineEditableType } from "@/lib/blocks/inline-fields";
import type { Locale } from "@/lib/i18n";
import { apiErrorMessage, apiGet, apiSend, ApiError } from "@/components/admin/helpers";
import type { Me } from "@/components/admin/types";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";
import { BlockLibrary } from "./block-library";
import { BlockPalette } from "./block-palette";
import { EditorCanvas, DEVICE_PX, type PreviewDevice } from "./editor-canvas";
import { EditorGuide } from "./editor-guide";
import { LayerTree } from "./layer-tree";
import { PropertiesPanel } from "./properties-panel";
import { PageSettingsDialog } from "./page-settings-dialog";
import { ScheduleDialog } from "./schedule-dialog";
import { TemplatesDialog } from "./templates-dialog";
import { VersionsDialog } from "./versions-dialog";
import { assertDefaultProps } from "./prop-fields";
import {
  envelopeJson,
  type DraftLocale,
  type DraftState,
  type PageDetail,
  type PageDetailResponse,
  type PatchPageResponse,
  type PublishResponse,
  type DiscardResponse,
} from "./types";

type SaveStatus = "saved" | "saving" | "dirty" | "error" | "conflict";
type LoadStatus = "loading" | "ready" | "notFound" | "error" | "invalid";

/** مسار العقدة من الجذر حتى المطلوبة (شاملًا إياها) — null إن لم توجد */
function findPath(nodes: ContentNode[], id: string): ContentNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node];
    if (node.children?.length) {
      const sub = findPath(node.children, id);
      if (sub) return [node, ...sub];
    }
  }
  return null;
}

/** عمق الشجرة الفرعية (الجذر = 1) */
function subtreeDepthOf(node: ContentNode): number {
  return node.children?.length ? 1 + Math.max(...node.children.map(subtreeDepthOf)) : 1;
}

type SaveOutcome = "saved" | "clean" | "failed" | "conflict";

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
  const saveStatusRef = useRef<SaveStatus>("saved");
  const setSaveStatusSync = useCallback((status: SaveStatus) => {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  // معلومات مقارنة النسخة المحلية بالخادمية عند التعارض (عدد الكتل وتطابق اللغتين)
  const [conflictInfo, setConflictInfo] = useState<{
    serverArCount: number;
    serverEnCount: number;
    serverUpdatedAt: string | null;
    serverUpdatedByName: string | null;
    arSame: boolean;
    enSame: boolean;
    serverRevision: number;
  } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  // حوار تأكيد المغادرة عبر روابط التطبيق الداخلية مع تغييرات معلقة
  const [navGuard, setNavGuard] = useState<{ href: string } | null>(null);
  const navGuardRef = useRef<{ href: string } | null>(null);
  // حوار تأكيد الحذف — مع عدد العقد التي ستُحذف مع الحاوية
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; count: number } | null>(null);
  const [publishing, setPublishing] = useState(false);
  // استبعاد التعديلات غير المنشورة — حوار تأكيد + حالة تنفيذ
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  // جدولة النشر — حوار الموعد + شارة في الرأس
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // دليل المحرر — نافذة مساعدة (F1 أو ؟)
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);
  // وضع اختبار التفاعل: التفاعل الحقيقي داخل الرسم مع إرسال محاكى في النماذج
  const [testMode, setTestMode] = useState(false);
  // معاينة iframe حقيقية (آخر مسودة محفوظة)
  const [iframeMode, setIframeMode] = useState(false);
  // جلسة التحرير النصي المباشر في الرسم — معرف العقدة الورقية قيد التحرير
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const inlineEditIdRef = useRef<string | null>(null);
  // مرجع التحديد لاستخدامه داخل مستمعي النافذة بلا إعادة تسجيل
  const selectedIdRef = useRef<string | null>(null);

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
  const revisionRef = useRef<number>(0); // مراجعة المسودة التي بنينا عليها
  const savingRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const pendingBaselineRef = useRef<DraftState | null>(null);
  const performSaveRef = useRef<() => Promise<SaveOutcome>>(async () => "failed");

  // ——— جدولة الحفظ التلقائي — يتوقف عند التعارض أو خطأ تحقق يحتاج تدخل المستخدم ———
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
      const ar = envelopeJson(next.draft.ar);
      const en = envelopeJson(next.draft.en);
      if (ar === saved.ar && en === saved.en) {
        setSaveStatusSync("saved");
        return;
      }
      setSaveStatusSync("dirty");
      scheduleAutosave();
    },
    [scheduleAutosave, setSaveStatusSync]
  );

  // ——— الحفظ (يقرأ الحالة عبر المراجع) ———
  // يعيد نتيجة دقيقة: النشر والتدفق الآخر يعتمد عليها ولا يفترض نجاحًا صامتًا.
  const performSave = useCallback(async (): Promise<SaveOutcome> => {
    const s = stateRef.current;
    if (!s) return "failed";
    // الحفظ دائمًا بمغلف v1: { schemaVersion: 1, blocks: شجرة } — ولا يُرسل شيء غير صالح
    const blocksAr = envelopeJson(s.draft.ar);
    const blocksEn = envelopeJson(s.draft.en);
    const saved = lastSavedRef.current;
    if (saved && blocksAr === saved.ar && blocksEn === saved.en) {
      if (saveStatusRef.current !== "conflict") setSaveStatusSync("saved");
      return "clean";
    }
    if (savingRef.current) return "failed"; // حفظ جارٍ — يُعاد الجدولة عند انتهائه

    // تحقق محلي أولًا (نفس بوابة الخادم) — لا إعادة محاولة تلقائية عند الفشل
    for (const json of [blocksAr, blocksEn]) {
      const check = validateContent(json);
      if (!check.ok) {
        setSaveStatusSync("error");
        toast.error(`${tp.title} — ${te.saveFailed} (${check.error})`);
        return "failed";
      }
    }

    savingRef.current = true;
    setSaveStatusSync("saving");
    const sentRevision = revisionRef.current;
    try {
      const res = await apiSend<PatchPageResponse>(`/api/admin/pages/${pageId}`, "PATCH", {
        draftBlocksAr: blocksAr,
        draftBlocksEn: blocksEn,
        baseRevision: sentRevision,
      });
      lastSavedRef.current = { ar: blocksAr, en: blocksEn };
      revisionRef.current = res.page.draftRevision;
      setPage((prev) =>
        prev
          ? {
              ...prev,
              slug: res.page.slug,
              status: res.page.status,
              draftUpdatedAt: res.page.draftUpdatedAt,
              draftRevision: res.page.draftRevision,
              isHome: res.page.isHome ?? prev.isHome,
              hasUnpublishedChanges: true,
            }
          : prev
      );
      setSaveStatusSync("saved");
      return "saved";
    } catch (err) {
      if (err instanceof ApiError && (err.code === "conflict" || err.code === "revision_required")) {
        // تعارض حقيقي: لا نكتب فوق غيرنا ولا نعيد المحاولة تلقائيًا — القرار للمستخدم
        setSaveStatusSync("conflict");
        setConflictOpen(true);
        return "conflict";
      }
      setSaveStatusSync("error");
      return "failed";
    } finally {
      savingRef.current = false;
      // التعديلات التي حدثت أثناء الحفظ لا تُفقد — تُجدول فورًا بعد انتهائه
      const cur = stateRef.current;
      const last = lastSavedRef.current;
      const conflicted = saveStatusRef.current === "conflict";
      if (
        !conflicted &&
        cur &&
        last &&
        (envelopeJson(cur.draft.ar) !== last.ar || envelopeJson(cur.draft.en) !== last.en)
      ) {
        setSaveStatusSync("dirty");
        scheduleAutosave();
      }
    }
  }, [pageId, scheduleAutosave, tp.title, te.saveFailed, setSaveStatusSync]);

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
      // الشكلان مقبولان: مصفوفة v0 قديمة (تُرحّل) أو مغلف v1 — التحرير دائمًا من الشجرة
      const checkAr = validateContent(res.page.draftBlocksAr);
      const checkEn = validateContent(res.page.draftBlocksEn);
      if (!checkAr.ok || !checkEn.ok) {
        setPage(res.page);
        setLoadStatus("invalid");
        return;
      }
      const draft: DraftState = { ar: checkAr.tree, en: checkEn.tree };
      // أساس المقارنة = المغلف المُرسل عند الحفظ (ناتج التحقق المطبّع نفسه)
      lastSavedRef.current = { ar: checkAr.json, en: checkEn.json };
      revisionRef.current = res.page.draftRevision;
      clearPendingHistory();
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      savingRef.current = false;
      setConflictOpen(false);
      setConflictInfo(null);
      setPage(res.page);
      commit({ draft, past: [], future: [] });
      setSelectedId(null);
      setInlineEditId(null);
      setSaveStatusSync("saved");
      setLoadStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.code === "not_found") setLoadStatus("notFound");
      else {
        setLoadError(apiErrorMessage(err, t.auth.errors));
        setLoadStatus("error");
      }
    }
  }, [clearPendingHistory, commit, pageId, t.auth.errors, setSaveStatusSync]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  // ——— التعارض: مقارنة النسخة المحلية بالخادمية قبل القرار ———
  const openConflictCompare = useCallback(async () => {
    setConflictBusy(true);
    try {
      const res = await apiGet<PageDetailResponse>(`/api/admin/pages/${pageId}`);
      const checkAr = validateContent(res.page.draftBlocksAr);
      const checkEn = validateContent(res.page.draftBlocksEn);
      const local = stateRef.current?.draft;
      setConflictInfo({
        serverArCount: checkAr.ok ? countNodes(checkAr.tree) : 0,
        serverEnCount: checkEn.ok ? countNodes(checkEn.tree) : 0,
        serverUpdatedAt: res.page.draftUpdatedAt,
        serverUpdatedByName: res.page.draftUpdatedByName,
        arSame: local && checkAr.ok ? envelopeJson(local.ar) === checkAr.json : false,
        enSame: local && checkEn.ok ? envelopeJson(local.en) === checkEn.json : false,
        serverRevision: res.page.draftRevision,
      });
    } catch {
      setConflictInfo(null);
    } finally {
      setConflictBusy(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (conflictOpen) void openConflictCompare();
  }, [conflictOpen, openConflictCompare]);

  /** الاحتفاظ بتعديلاتي: إعادة بناء أساس المراجعة من الخادم ثم حفظ نسختنا فوقه */
  const keepMyChanges = useCallback(async () => {
    setConflictBusy(true);
    try {
      const res = await apiGet<PageDetailResponse>(`/api/admin/pages/${pageId}`);
      revisionRef.current = res.page.draftRevision;
      setConflictOpen(false);
      setConflictInfo(null);
      const outcome = await performSave();
      if (outcome === "saved") toast.success(te.saved);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setConflictBusy(false);
    }
  }, [pageId, performSave, te.saved, t.auth.errors]);

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
          guideOpen ||
          confirmDelete !== null ||
          mobileLibraryOpen ||
          mobilePropsOpen
        ) {
          return;
        }
        // وضع الاختبار يعمل أولًا — Escape يخرج منه قبل إلغاء التحديد
        if (testMode) {
          setTestMode(false);
          return;
        }
        // جلسة التحرير المباشر — Escape يختمها (والمؤشر داخل حقل يعالجها الحقل نفسه)
        if (inlineEditIdRef.current) {
          setInlineEditId(null);
          return;
        }
        const target = e.target as HTMLElement | null;
        const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!inField) setSelectedId(null);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      // دليل المحرر: F1 في أي موضع، أو ؟ خارج حقول الكتابة
      if (e.key === "F1") {
        e.preventDefault();
        setGuideOpen(true);
        return;
      }
      if (!mod && e.key === "?" && !e.altKey) {
        const gTarget = e.target as HTMLElement | null;
        const gInField = gTarget && (gTarget.tagName === "INPUT" || gTarget.tagName === "TEXTAREA" || gTarget.isContentEditable);
        if (!gInField) {
          e.preventDefault();
          setGuideOpen(true);
          return;
        }
      }
      if (!mod && e.key === "Enter") {
        // بديل لوحة المفاتيح للنقر المزدوج: Enter على ورقية نصية محددة يبدأ التحرير المباشر
        const target = e.target as HTMLElement | null;
        const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (inField) return;
        const s = stateRef.current;
        const sel = selectedIdRef.current;
        if (!s || !sel) return;
        const found = findNode(s.draft[draftLocale], sel);
        if (!found || isContainerType(found.node.type)) return;
        if (!isInlineEditableType(found.node.type)) return;
        e.preventDefault();
        setInlineEditId(sel);
        return;
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const inTextField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (key === "z" && !e.shiftKey) {
        // داخل حقول الكتابة: التراجع الأصلي للمحارف لا يُعترض
        if (inTextField) return;
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        if (inTextField) return;
        e.preventDefault();
        redo();
      } else if (key === "s") {
        // حفظ فوري للمسودة — مثل محررات المستندات (يعمل حتى داخل حقول التحرير)
        e.preventDefault();
        void performSaveRef.current().then((outcome) => {
          if (outcome === "saved") toast.success(te.saved);
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
    guideOpen,
    confirmDelete,
    mobileLibraryOpen,
    mobilePropsOpen,
    testMode,
  ]);

  // ——— حارس المغادرة ———
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving" || saveStatus === "error" || saveStatus === "conflict") {
        e.preventDefault();
        e.returnValue = te.leaveWarning;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus, te.leaveWarning]);

  // ——— حارس التنقل الداخلي: روابط التطبيق لا تسرق تغييرات معلقة ———
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (saveStatusRef.current !== "dirty" && saveStatusRef.current !== "saving" && saveStatusRef.current !== "conflict") return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || anchor.target === "_blank" || href.startsWith("http")) return;
      e.preventDefault();
      e.stopPropagation();
      navGuardRef.current = { href };
      setNavGuard({ href });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // ——— عمليات الشجرة ———
  // كل عملية تستنسخ شجرة اللغة الحالية (structuredClone) ثم تعدّل النسخة —
  // لقطات التاريخ تحتفظ بالأشكال القديمة سليمة بلا مشاركة مراجع.

  /** طلب حذف عقدة — يحسب عدد العقد المتأثرة للحوار التأكيدي */
  const requestDelete = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (!s) return;
      const found = findNode(s.draft[draftLocale], id);
      if (!found) return;
      setConfirmDelete({ id, count: countNodes([found.node]) });
    },
    [draftLocale]
  );

  /**
   * إدراج عقدة جديدة: داخل الحاوية الهدف (أو المحددة) إن سمحت قواعد الأبناء،
   * وإلا في الجذر بعد المحدد (أو في النهاية). كل الإدراجات عبر applyDiscrete.
   */
  const insertNode = useCallback(
    (type: BlockType, targetParentId: string | null) => {
      const s = stateRef.current;
      if (!s) return;
      if (LIBRARY_HIDDEN_TYPES.includes(type)) return; // نوع قديم مُرحّل — لا يُدرج
      const tree = s.draft[draftLocale];
      const taken = collectIds(tree);
      const node = defaultNode(type, taken);

      if (countNodes(tree) + countNodes([node]) > MAX_TREE_NODES) {
        toast.error(te.nodeLimit);
        return;
      }

      // أين يوضع؟ الحاوية الهدف أولًا ثم الحاوية المحددة ثم الجذر
      let parentId: string | null = null;
      const candidates = targetParentId ? [targetParentId, selectedId] : selectedId ? [selectedId] : [];
      for (const candidateId of candidates) {
        if (!candidateId) continue;
        const target = findNode(tree, candidateId);
        if (!target || !isContainerType(target.node.type)) continue;
        const rule = BLOCK_REGISTRY[target.node.type].children;
        if (!rule || !rule.allowed.includes(type)) break; // الحاوية المحددة لا تقبل النوع → الجذر
        if ((target.node.children?.length ?? 0) >= rule.max) {
          toast.warning(te.containerFull.replace("{max}", String(rule.max)));
          return;
        }
        const parentDepth = findPath(tree, candidateId)?.length ?? 0;
        if (parentDepth + subtreeDepthOf(node) > MAX_TREE_DEPTH) {
          toast.warning(te.maxDepthHint);
          return;
        }
        parentId = candidateId;
        break;
      }

      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        if (parentId) {
          const target = findNode(treeClone, parentId);
          if (!target?.node.children) return draft;
          target.node.children.push(node);
        } else {
          const idx = selectedId ? treeClone.findIndex((n) => n.id === selectedId) : -1;
          treeClone.splice(idx >= 0 ? idx + 1 : treeClone.length, 0, node);
        }
        return { ...draft, [draftLocale]: treeClone };
      });
      setSelectedId(node.id);
      setMobileLibraryOpen(false);
    },
    [applyDiscrete, draftLocale, selectedId, te.containerFull, te.maxDepthHint, te.nodeLimit]
  );

  /** إضافة من المكتبة/اللوحة السريعة — الهدف يحدده التحديد الحالي */
  const addNode = useCallback(
    (type: BlockType) => insertNode(type, null),
    [insertNode]
  );

  const deleteNode = useCallback(
    (id: string) => {
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        if (!removeNode(treeClone, id)) return draft;
        return { ...draft, [draftLocale]: treeClone };
      });
      setSelectedId((cur) => (cur === id ? null : cur));
      setConfirmDelete(null);
      toast(te.nodeDeleted);
    },
    [applyDiscrete, draftLocale, te.nodeDeleted]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const s = stateRef.current;
      if (!s) return;
      const tree = s.draft[draftLocale];
      const found = findNode(tree, id);
      if (!found) return;
      if (countNodes(tree) + countNodes([found.node]) > MAX_TREE_NODES) {
        toast.error(te.nodeLimit);
        return;
      }
      const taken = collectIds(tree);
      const clone = cloneWithNewIds(found.node, taken, () => Math.random().toString(36).slice(2, 8));
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const f = findNode(treeClone, id);
        if (!f) return draft;
        const idx = f.siblings.findIndex((n) => n.id === id);
        f.siblings.splice(idx + 1, 0, clone);
        return { ...draft, [draftLocale]: treeClone };
      });
      setSelectedId(clone.id);
    },
    [applyDiscrete, draftLocale, te.nodeLimit]
  );

  /** نقل داخل الإخوة (أعلى/أسفل) */
  const moveNode = useCallback(
    (id: string, dir: -1 | 1) => {
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const f = findNode(treeClone, id);
        if (!f) return draft;
        const idx = f.siblings.findIndex((n) => n.id === id);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= f.siblings.length) return draft;
        [f.siblings[idx], f.siblings[target]] = [f.siblings[target], f.siblings[idx]];
        return { ...draft, [draftLocale]: treeClone };
      });
    },
    [applyDiscrete, draftLocale]
  );

  /** إعادة ترتيب قائمة أبناء والد معين (السحب داخل نفس القائمة) */
  const reorderNodes = useCallback(
    (parentId: string | null, ids: string[]) => {
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const siblings = parentId ? findNode(treeClone, parentId)?.node.children : treeClone;
        if (!siblings) return draft;
        const map = new Map(siblings.map((n) => [n.id, n]));
        const next = ids.map((id) => map.get(id)).filter((n): n is ContentNode => Boolean(n));
        if (next.length !== siblings.length) return draft;
        siblings.splice(0, siblings.length, ...next);
        return { ...draft, [draftLocale]: treeClone };
      });
    },
    [applyDiscrete, draftLocale]
  );

  /** إضافة ابن داخل حاوية من شريط الرسم — النوع مقبول مسبقًا من قائمة الأنواع */
  const addChildTo = useCallback(
    (parentId: string, type: BlockType) => insertNode(type, parentId),
    [insertNode]
  );

  const updateProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      applyContinuous((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const found = findNode(treeClone, id);
        if (!found) return draft;
        found.node.props = props;
        return { ...draft, [draftLocale]: treeClone };
      });
    },
    [applyContinuous, draftLocale]
  );

  // ——— التحرير النصي المباشر (inline editing) ———

  /** بدء جلسة تحرير مباشر لعقدة ورقية — تُحدد أيضًا لتعرض لوحة الخصائص */
  const beginInlineEdit = useCallback((id: string) => {
    setSelectedId(id);
    setInlineEditId(id);
  }, []);

  /** إنهاء الجلسة — التغييرات مُزامَنة حية بالفعل عبر onChange */
  const endInlineEdit = useCallback(() => {
    setInlineEditId(null);
  }, []);

  /** تغيير حي من contentEditable — يُطبَّق على حقل واحد داخل props دون مساس ببقيتها */
  const inlineChange = useCallback(
    (id: string, field: string, value: string) => {
      const s = stateRef.current;
      if (!s) return;
      const found = findNode(s.draft[draftLocale], id);
      if (!found) return;
      const nextProps = applyInlineField({ ...(found.node.props ?? {}) }, field, value);
      if (!nextProps) return; // حقل غير معروف — تجاهل صامت
      updateProps(id, nextProps);
    },
    [draftLocale, updateProps]
  );

  useEffect(() => {
    inlineEditIdRef.current = inlineEditId;
  }, [inlineEditId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /** الجلسة تنتهي عند مغادرة الرسم: وضع اختبار أو معاينة iframe */
  useEffect(() => {
    if (testMode || iframeMode) setInlineEditId(null);
  }, [testMode, iframeMode]);

  /** النقر خارج عقدة الجلسة (وحواري ولوحات الواجهة) يختمها — التغييرات محفوظة حية */
  useEffect(() => {
    if (!inlineEditId) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[role="dialog"],[data-radix-popper-content-wrapper]')) return;
      const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(inlineEditId) : inlineEditId;
      if (target.closest(`[data-inline-edit-node="${escaped}"]`)) return;
      setInlineEditId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [inlineEditId]);

  const updateNodeStyle = useCallback(
    (id: string, style: NodeStyle) => {
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const found = findNode(treeClone, id);
        if (!found) return draft;
        found.node.style = style;
        return { ...draft, [draftLocale]: treeClone };
      });
    },
    [applyDiscrete, draftLocale]
  );

  const updateVisibility = useCallback(
    (id: string, key: "mobile" | "tablet" | "desktop", value: boolean) => {
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const found = findNode(treeClone, id);
        if (!found) return draft;
        found.node.visibility = { ...(found.node.visibility ?? { mobile: true, tablet: true, desktop: true }), [key]: value };
        return { ...draft, [draftLocale]: treeClone };
      });
    },
    [applyDiscrete, draftLocale]
  );

  const updateAnchor = useCallback(
    (id: string, anchorId: string | undefined) => {
      applyDiscrete((draft) => {
        const treeClone = structuredClone(draft[draftLocale]);
        const found = findNode(treeClone, id);
        if (!found) return draft;
        if (anchorId === undefined) delete found.node.anchorId;
        else found.node.anchorId = anchorId;
        return { ...draft, [draftLocale]: treeClone };
      });
    },
    [applyDiscrete, draftLocale]
  );

  // ——— النشر (حفظ فوري أولًا ثم نشر مرتبط بمراجعة محفوظة) ———
  const publish = useCallback(async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      // حفظ حتى النجاح: التعديلات التي تحدث أثناء الطلب تُحفظ في دورة تالية قبل النشر
      let outcome = await performSave();
      for (let attempt = 0; attempt < 3 && outcome === "failed" && stateRef.current; attempt++) {
        await new Promise((r) => setTimeout(r, 300));
        outcome = await performSave();
      }
      if (outcome === "conflict") return; // حوار التعارض مفتوح — القرار للمستخدم
      if (outcome === "failed") {
        toast.error(apiErrorMessage(new Error("save_failed"), t.auth.errors));
        return;
      }
      if (saveStatusRef.current === "conflict") return;
      const res = await apiSend<PublishResponse>(`/api/admin/pages/${pageId}/publish`, "POST", {
        baseRevision: revisionRef.current,
      });
      revisionRef.current = res.page.draftRevision;
      setPage((prev) =>
        prev
          ? {
              ...prev,
              slug: res.page.slug,
              publishedAt: res.publishedAt,
              status: res.page.status,
              publishedRevision: res.page.publishedRevision,
              hasUnpublishedChanges: res.page.hasUnpublishedChanges,
            }
          : prev
      );
      toast.success(te.publishedOk);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "conflict" || err.code === "revision_required")) {
        // المسودة تغيرت بعد بدء النشر — لا يُنشر شيء مختلف عمّا وافق عليه الناشر
        setSaveStatusSync("conflict");
        setConflictOpen(true);
      } else if (err instanceof ApiError && err.code === "empty_page") {
        toast.error(te.emptyPageError);
      } else if (err instanceof ApiError && err.code === "archived") {
        toast.error(te.archivedError);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setPublishing(false);
    }
  }, [pageId, performSave, publishing, t.auth.errors, te.publishedOk, te.emptyPageError, te.archivedError, setSaveStatusSync]);

  // ——— استبعاد التعديلات غير المنشورة: المسودة تعود حرفيًا لآخر نسخة منشورة ———
  const discardDraft = useCallback(async () => {
    if (discarding) return;
    setDiscarding(true);
    try {
      // ملاحظة: نرسل المراجعة المحفوظة على الخادم (لا نحفظ أولًا) —
      // الاستبعاد يرمي التعديلات غير المنشورة بما فيها غير المحفوظة منها.
      // تعارض المراجعة (حفظ تلقائي لحق للطلب) يعاد بمحاولة واحدة بمراجعة الخادم —
      // آمن هنا بنيويًا لأن الغاية رمي محتوى الخادم نفسه.
      const attempt = async (baseRevision: number) =>
        apiSend<DiscardResponse>(`/api/admin/pages/${pageId}/discard`, "POST", { baseRevision });
      let res: DiscardResponse;
      try {
        res = await attempt(revisionRef.current);
      } catch (err) {
        const server = err instanceof ApiError && err.code === "conflict" ? (err.body as { serverRevision?: number } | null)?.serverRevision : undefined;
        if (typeof server !== "number") throw err;
        res = await attempt(server);
      }
      setDiscardOpen(false);
      toast.success(te.discarded);
      // إعادة تحميل كاملة: المراجعة ترجع إلى publishedRevision والمحتوى يطابق المنشور
      await loadPage();
      void res;
    } catch (err) {
      if (err instanceof ApiError && (err.code === "conflict" || err.code === "revision_required")) {
        setDiscardOpen(false);
        setSaveStatusSync("conflict");
        setConflictOpen(true);
      } else if (err instanceof ApiError && err.code === "archived") {
        toast.error(te.archivedError);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    } finally {
      setDiscarding(false);
    }
  }, [discarding, pageId, loadPage, t.auth.errors, te.discarded, te.archivedError, setSaveStatusSync]);

  // ——— جدولة النشر: تحديث خفيف لحالة الصفحة بعد النجاح (لا يمس المحتوى ولا المراجعات) ———
  const scheduleApplied = useCallback((scheduledPublishAt: string | null) => {
    setPage((prev) => (prev ? { ...prev, scheduledPublishAt } : prev));
  }, []);

  // ——— المشتقات ———
  const nodes = state?.draft[draftLocale] ?? [];
  const selectedPath = useMemo(() => (selectedId ? findPath(nodes, selectedId) : null), [nodes, selectedId]);
  const selectedNode = selectedPath ? selectedPath[selectedPath.length - 1] : null;
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
  const lastSavedLabel = page?.draftUpdatedAt
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar", { hour: "2-digit", minute: "2-digit" }).format(new Date(page.draftUpdatedAt))
    : null;
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
    ) : saveStatus === "conflict" ? (
      <button
        type="button"
        onClick={() => setConflictOpen(true)}
        className="flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-100"
      >
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {te.conflictTitle}
      </button>
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
              setInlineEditId(null); // لغة المسودة تغيرت — الجلسة النصية تنتهي
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

          {/* شريط معلومات الجلسة: آخر حفظ + آخر محرر + لغة التحرير + تعديلات غير منشورة */}
          <div className="hidden items-center gap-2 text-[11px] text-muted-foreground xl:flex">
            {lastSavedLabel && (
              <span title={te.lastSaved}>
                {te.lastSaved}: {lastSavedLabel}
              </span>
            )}
            {page?.draftUpdatedByName && (
              <span title={te.lastEditor}>
                · {te.lastEditor}: {page.draftUpdatedByName}
              </span>
            )}
            {page?.hasUnpublishedChanges && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700" title={te.unpublishedHint}>
                {te.unpublishedChanges}
              </span>
            )}
            {page?.scheduledPublishAt && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700"
                title={te.scheduleBindHint.replace("{rev}", `#${page.scheduledRevision ?? page.draftRevision}`)}
              >
                <CalendarClock className="size-3" aria-hidden="true" />
                {te.scheduledShort}
              </span>
            )}
          </div>

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

              {/* وضع اختبار التفاعل — تفاعل حقيقي وإرسال محاكى */}
              <Button
                type="button"
                variant={testMode ? "secondary" : "ghost"}
                size="icon"
                className={cn("size-8", testMode && "bg-white text-navy shadow-sm")}
                onClick={() => setTestMode((v) => !v)}
                aria-pressed={testMode}
                aria-label={te.testMode}
                title={`${te.testMode} (Esc)`}
              >
                <FlaskConical className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {/* معاينة iframe بعرض جهاز حقيقي */}
            <Button
              type="button"
              variant={iframeMode ? "secondary" : "ghost"}
              size="icon"
              className="size-9"
              onClick={() => setIframeMode((v) => !v)}
              aria-pressed={iframeMode}
              aria-label={te.iframePreview}
              title={te.iframePreview}
            >
              <AppWindow className="size-4" aria-hidden="true" />
            </Button>
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

              {/* قوالب الصفحات */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                onClick={() => setTemplatesOpen(true)}
                aria-label={t.admin.templates.title}
                title={t.admin.templates.title}
              >
                <LayoutTemplate className="size-4" aria-hidden="true" />
              </Button>

            {/* جدولة النشر — بصلاحية النشر ولبغير المؤرشفة */}
            {canPublish && page?.status !== "archived" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-9", page?.scheduledPublishAt && "text-violet-700")}
                    onClick={() => setScheduleOpen(true)}
                    aria-label={te.schedule}
                    title={te.schedule}
                  >
                    <CalendarClock className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{te.schedule}</TooltipContent>
              </Tooltip>
            )}

            {/* دليل المحرر */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setGuideOpen(true)}
                  aria-label={te.editorGuide.title}
                  title={`${te.editorGuide.title} — ${te.editorGuide.openHint}`}
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{te.editorGuide.title}</TooltipContent>
            </Tooltip>

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

            {/* استبعاد التعديلات غير المنشورة — صفحة منشورة فيها تعديلات مسودة */}
            {page?.status === "published" && page?.hasUnpublishedChanges && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                onClick={() => setDiscardOpen(true)}
                disabled={discarding}
                aria-label={te.discard}
                title={te.discard}
              >
                {discarding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Eraser className="size-4" aria-hidden="true" />}
                <span className="hidden sm:inline">{te.discard}</span>
              </Button>
            )}

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
            <Tabs defaultValue="library" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-3 grid h-9 grid-cols-2">
                <TabsTrigger value="library" className="text-xs">
                  {te.library}
                </TabsTrigger>
                <TabsTrigger value="layers" className="text-xs">
                  {te.layers}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="min-h-0 flex-1">
                <BlockLibrary locale={locale} onAdd={addNode} />
              </TabsContent>
              <TabsContent value="layers" className="min-h-0 flex-1">
                <LayerTree
                  nodes={nodes}
                  uiLocale={locale}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onDuplicate={duplicateNode}
                  onDelete={requestDelete}
                  onVisibilityChange={updateVisibility}
                />
              </TabsContent>
            </Tabs>
          </aside>

          {/* الرسم */}
          <section className="flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-border px-3 py-2">
              <h2 className="text-sm font-bold text-navy">{te.canvas}</h2>
              <p className="text-[11px] text-muted-foreground">
                {draftLocale === "ar" ? te.ar : te.en} · {countNodes(nodes)} {te.blocks}
              </p>
            </header>
            {/* شريط تنبيه وضع الاختبار — الإرسال محاكى */}
            {testMode && !iframeMode && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800" dir={locale === "ar" ? "rtl" : "ltr"}>
                <FlaskConical className="size-3.5 shrink-0" aria-hidden="true" />
                {te.testModeBanner}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {iframeMode ? (
                <IframePreview
                  pageId={pageId}
                  uiLocale={locale}
                  draftLocale={draftLocale}
                  device={device}
                  fullWidth={!lgLayout}
                />
              ) : (
                <EditorCanvas
                  nodes={nodes}
                  locale={draftLocale}
                  uiLocale={locale}
                  device={device}
                  mode={testMode ? "test" : "edit"}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={reorderNodes}
                  onMove={moveNode}
                  onDuplicate={duplicateNode}
                  onDelete={requestDelete}
                  onAddChild={addChildTo}
                  inlineEditId={inlineEditId}
                  onInlineEditBegin={beginInlineEdit}
                  onInlineEditEnd={endInlineEdit}
                  onInlineChange={inlineChange}
                />
              )}
            </div>
          </section>

          {/* الخصائص — ثابتة على xl+ */}
          <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm xl:flex">
            {selectedNode ? (
              <PropertiesPanel
                node={selectedNode}
                path={selectedPath ?? [selectedNode]}
                locale={locale}
                me={me}
                onPropsChange={updateProps}
                onStyleChange={updateNodeStyle}
                onVisibilityChange={updateVisibility}
                onAnchorChange={updateAnchor}
                onSelectNode={setSelectedId}
                onDuplicate={duplicateNode}
                onDelete={requestDelete}
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

      {/* ——— المكتبة/الطبقات على الشاشات الصغيرة ——— */}
      <Sheet open={mobileLibraryOpen && !lgLayout} onOpenChange={setMobileLibraryOpen}>
        <SheetContent side={locale === "ar" ? "right" : "left"} className="w-80 max-w-[92vw] p-0 sm:max-w-80">
          <SheetHeader className="border-b border-border p-3">
            <SheetTitle className="text-sm">{te.library}</SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="library" className="flex h-[calc(100dvh-4.5rem)] min-h-0 flex-col">
            <TabsList className="mx-3 grid h-9 grid-cols-2">
              <TabsTrigger value="library" className="text-xs">
                {te.library}
              </TabsTrigger>
              <TabsTrigger value="layers" className="text-xs">
                {te.layers}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="min-h-0 flex-1">
              <BlockLibrary locale={locale} onAdd={addNode} />
            </TabsContent>
            <TabsContent value="layers" className="min-h-0 flex-1">
              <LayerTree
                nodes={nodes}
                uiLocale={locale}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDuplicate={duplicateNode}
                onDelete={requestDelete}
                onVisibilityChange={updateVisibility}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* ——— الخصائص على الشاشات الصغيرة ——— */}
      <Sheet
        open={mobilePropsOpen && !!selectedNode && !xlLayout}
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
            {selectedNode && (
              <PropertiesPanel
                node={selectedNode}
                path={selectedPath ?? [selectedNode]}
                locale={locale}
                me={me}
                onPropsChange={updateProps}
                onStyleChange={updateNodeStyle}
                onVisibilityChange={updateVisibility}
                onAnchorChange={updateAnchor}
                onSelectNode={setSelectedId}
                onDuplicate={duplicateNode}
                onDelete={requestDelete}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ——— تأكيد حذف عقدة — الحاويات تحذف أبناءها معها ——— */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{te.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>
              {te.confirmDeleteTree.replace("{count}", String(confirmDelete?.count ?? 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.admin.users.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteNode(confirmDelete.id);
              }}
            >
              {te.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ——— تأكيد استبعاد التعديلات غير المنشورة ——— */}
      <AlertDialog open={discardOpen} onOpenChange={(o) => !discarding && setDiscardOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-navy">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Eraser className="size-4" aria-hidden="true" />
              </span>
              {te.discard}
            </AlertDialogTitle>
            <AlertDialogDescription>{te.discardDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-full" disabled={discarding}>
              {t.admin.users.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 rounded-full bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => {
                e.preventDefault();
                void discardDraft();
              }}
              disabled={discarding}
            >
              {discarding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Eraser className="size-4" aria-hidden="true" />}
              {te.discardConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ——— حوار جدولة النشر ——— */}
      {page && (
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          locale={locale}
          page={page}
          onApplied={scheduleApplied}
        />
      )}

      {/* ——— دليل المحرر ——— */}
      <EditorGuide open={guideOpen} onOpenChange={setGuideOpen} locale={locale} />

      {/* ——— تعارض التحرير — مقارنة + خيارا الحفاظ على التعديلات أو تحميل الخادم ——— */}
      <Dialog
        open={conflictOpen}
        onOpenChange={(o) => {
          setConflictOpen(o);
          if (!o) setConflictInfo(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
              {te.conflictTitle}
            </DialogTitle>
            <DialogDescription>{te.conflictBody}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
            {conflictBusy && !conflictInfo ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {te.conflictComparing}
              </div>
            ) : conflictInfo ? (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-2.5">
                    <p className="mb-1 text-xs font-bold text-navy">{te.conflictLocal}</p>
                    <p className="text-xs text-muted-foreground">
                      AR: {conflictInfo.arSame ? te.conflictSame : te.conflictDiffers} · EN:{" "}
                      {conflictInfo.enSame ? te.conflictSame : te.conflictDiffers}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5">
                    <p className="mb-1 text-xs font-bold text-navy">{te.conflictServer}</p>
                    <p className="text-xs text-muted-foreground">
                      AR: {conflictInfo.serverArCount} · EN: {conflictInfo.serverEnCount}
                    </p>
                    {conflictInfo.serverUpdatedByName && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {te.lastEditor}: {conflictInfo.serverUpdatedByName}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{te.conflictChoice}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{te.conflictBody}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => keepMyChanges()} disabled={conflictBusy}>
              {te.conflictKeepMine}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConflictOpen(false);
                void loadPage();
              }}
            >
              <RotateCw className="size-4" aria-hidden="true" />
              {te.conflictLoadServer}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ——— حوار المغادرة بتغييرات معلقة (تنقلات التطبيق) ——— */}
      <Dialog open={navGuard !== null} onOpenChange={(o) => !o && setNavGuard(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" aria-hidden="true" />
              {te.leaveTitle}
            </DialogTitle>
            <DialogDescription>{te.leaveBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setNavGuard(null)}>
              {te.leaveStay}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const target = navGuardRef.current?.href;
                setNavGuard(null);
                saveStatusRef.current = "saved"; // المغادرة مقصودة — لا حارس إضافي
                window.location.href = target ?? `/${locale}/admin/pages`;
              }}
            >
              {te.leaveDiscard}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void (async () => {
                  const outcome = await performSave();
                  const target = navGuardRef.current?.href;
                  if (outcome === "saved" || outcome === "clean") {
                    saveStatusRef.current = "saved";
                    window.location.href = target ?? `/${locale}/admin/pages`;
                  } else {
                    setNavGuard(null);
                    toast.error(te.saveFailed);
                  }
                })();
              }}
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {te.leaveSaveAndGo}
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
          baseRevision={revisionRef.current}
          onSaved={(patch) => {
            setPage((prev) =>
              prev
                ? {
                    ...prev,
                    slug: patch.slug ?? prev.slug,
                    draftSettings: patch.draftSettings ?? prev.draftSettings,
                    draftSlug: patch.draftSettings?.slug ?? prev.draftSlug,
                    seoTitleAr: patch.draftSettings?.seoTitleAr ?? prev.seoTitleAr,
                    seoTitleEn: patch.draftSettings?.seoTitleEn ?? prev.seoTitleEn,
                    seoDescAr: patch.draftSettings?.seoDescAr ?? prev.seoDescAr,
                    seoDescEn: patch.draftSettings?.seoDescEn ?? prev.seoDescEn,
                    visibility: patch.draftSettings?.visibility ?? prev.visibility,
                    allowedRoles: patch.draftSettings?.allowedRoles ?? prev.allowedRoles,
                    order: patch.draftSettings?.order ?? prev.order,
                    hasUnpublishedChanges: true,
                  }
                : prev
            );
            revisionRef.current = patch.draftRevision;
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
        baseRevision={revisionRef.current}
        onRestored={() => void loadPage()}
      />

      {/* ——— قوالب الصفحات (§5) ——— */}
      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        pageId={pageId}
        locale={locale}
        draftLocale={draftLocale}
        baseRevision={revisionRef.current}
        currentEnvelope={state ? envelopeJson(draftLocale === "en" ? state.draft.en : state.draft.ar) : null}
        canEdit={can(me, "pages.edit")}
        onApplied={() => void loadPage()}
      />

      {/* ——— لوحة الإضافة السريعة (Ctrl+/) ——— */}
      <BlockPalette locale={locale} open={paletteOpen} onOpenChange={setPaletteOpen} onAdd={addNode} />
    </TooltipProvider>
  );
}

// ——— معاينة iframe بعرض جهاز حقيقي — تُظهر آخر مسودة محفوظة ———

interface IframePreviewProps {
  pageId: string;
  uiLocale: Locale;
  draftLocale: DraftLocale;
  device: PreviewDevice;
  /** الشاشات الضيقة: عرض كامل بلا تكبير/عرض مخصص */
  fullWidth: boolean;
}

function IframePreview({ pageId, uiLocale, draftLocale, device, fullWidth }: IframePreviewProps) {
  const te = getPortalContent(uiLocale).admin.editor;
  const [width, setWidth] = useState(DEVICE_PX[device]);
  const [zoom, setZoom] = useState(100);
  const [frameKey, setFrameKey] = useState(0);

  // تغيير الجهاز يعيد العرض الافتراضي له
  useEffect(() => {
    setWidth(DEVICE_PX[device]);
  }, [device]);

  const src = `/${uiLocale}/admin/pages/${pageId}/preview?locale=${draftLocale}&device=${device}`;
  const clampedWidth = Math.min(1920, Math.max(320, Math.trunc(width) || DEVICE_PX[device]));
  const scale = zoom / 100;

  return (
    <div className="flex h-full flex-col" dir={uiLocale === "ar" ? "rtl" : "ltr"}>
      {/* شريط التحكم: عرض مخصص + تكبير + تحديث (شاشات واسعة) */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        {!fullWidth && (
          <>
            <div className="flex items-center gap-1.5">
              <label htmlFor="iframe-width" className="whitespace-nowrap text-[11px] font-semibold text-navy">
                {te.previewWidth}
              </label>
              <Input
                id="iframe-width"
                type="number"
                min={320}
                max={1920}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                onBlur={() => setWidth(clampedWidth)}
                className="h-8 w-20 text-xs"
                dir="ltr"
              />
              <span className="text-[11px] text-muted-foreground">px</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="whitespace-nowrap text-[11px] font-semibold text-navy">{te.previewZoom}</span>
              <Slider
                value={[zoom]}
                min={25}
                max={100}
                step={5}
                onValueChange={(v) => setZoom(v[0] ?? 100)}
                className="w-28"
                aria-label={te.previewZoom}
              />
              <span className="w-9 text-end text-[11px] tabular-nums text-muted-foreground">{zoom}%</span>
            </div>
          </>
        )}
        <Button type="button" variant="outline" size="sm" className="min-h-8 gap-1.5 text-xs" onClick={() => setFrameKey((k) => k + 1)}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {te.refreshPreview}
        </Button>
        <span className="ms-auto flex items-center gap-1 text-[11px] text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          {te.previewSavedNote}
        </span>
      </div>

      {/* إطار بعرض حقيقي — استعلامات الوسوم تستجيب لعرض iframe الفعلي */}
      <div className="min-h-0 flex-1 overflow-auto bg-muted/50 p-3">
        {fullWidth ? (
          <div dir={draftLocale === "ar" ? "rtl" : "ltr"} className="h-full w-full overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <iframe
              key={frameKey}
              src={src}
              title={te.iframePreview}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="h-full w-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="mx-auto h-full" style={{ width: clampedWidth * scale, maxWidth: "100%" }}>
            <div
              dir={draftLocale === "ar" ? "rtl" : "ltr"}
              style={{
                width: clampedWidth,
                height: `${100 / scale}%`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
            >
              <iframe
                key={frameKey}
                src={src}
                title={te.iframePreview}
                sandbox="allow-scripts allow-same-origin allow-forms"
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
