"use client";

/**
 * قائمة الطلبات: بحث وتصفية (حالة/أولوية/خدمة/مسؤول/مؤرشف) + تحديد جماعي
 * للأرشفة + إجراءات سريعة (تعيين لي/تعيين لغيري/أرشفة/استعادة).
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  MoreHorizontal,
  Eye,
  UserPlus,
  Archive,
  ArchiveRestore,
  MessageSquare,
  FileText,
  Inbox,
  Loader2,
  RotateCcw,
  BookMarked,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Download,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import type { PortalContent } from "@/content/portal/types";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { StatusBadge, PriorityBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import {
  apiGet,
  apiSend,
  ApiError,
  apiErrorMessage,
  buildQuery,
  fmtRelative,
} from "@/components/admin/helpers";
import type { Me, RequestRow, RequestsResponse, StaffOption } from "../types";
import { SavedRepliesDialog } from "./saved-replies-dialog";
import { cn } from "@/lib/utils";

interface RequestsClientProps {
  me: Me;
  locale: Locale;
  /** حالة مبدئية من رابط الصفحة (مثل ?status=awaiting_info من اللوحة) */
  initialStatus?: string;
  /** تفعيل مبدئي لمرشّح الردود المتأخرة (?overdue=1 من اللوحة) */
  initialOverdue?: boolean;
}

/** شارة عمر الانتظار — منذ آخر رسالة عميل: محايدة تحت 24 ساعة، تحذير كهرماني بعدها */
function AgingBadge({ since, tr }: { since: string; tr: PortalContent["admin"]["requests"] }) {
  const ageMs = Date.now() - new Date(since).getTime();
  const hours = Math.max(0, Math.floor(ageMs / 3_600_000));
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days >= 1) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
        {tr.overdueReply} · {tr.agingDays.replace("{n}", String(days))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {tr.awaitingTeam} · {tr.agingHours.replace("{n}", String(hours))}
    </span>
  );
}

// ——— التصفيات المحفوظة (محلية لكل مستخدم — لا مساس بالواجهة البرمجية) ———

/** لقطة قيم التصفية التي يلتقطها الإعداد المحفوظ — الصفحة لا تُحفظ أبدًا */
interface PresetFilters {
  status: string;
  priority: string;
  service: string;
  assignee: string;
  q: string;
  overdue: boolean;
  archived: boolean;
}

/** إعداد محفوظ: معرّف فريد (الأسماء المتطابقة جائزة) + اسم + لقطة تصفية */
interface RequestPreset {
  id: string;
  name: string;
  filters: PresetFilters;
}

/** سقف الإعدادات المحفوظة — الأقدم يُسقط عند تجاوزه */
const PRESET_LIMIT = 8;
const EMPTY_PRESETS: RequestPreset[] = [];

/** فحص دفاعي لشكل الإعداد المقروء من التخزين — التالف يُتجاهل بصمت */
function isValidPreset(value: unknown): value is RequestPreset {
  if (typeof value !== "object" || value === null) return false;
  const preset = value as { id?: unknown; name?: unknown; filters?: unknown };
  if (typeof preset.id !== "string" || typeof preset.name !== "string" || !preset.name) return false;
  const f = preset.filters as Record<string, unknown> | null | undefined;
  return (
    typeof f === "object" &&
    f !== null &&
    typeof f.status === "string" &&
    typeof f.priority === "string" &&
    typeof f.service === "string" &&
    typeof f.assignee === "string" &&
    typeof f.q === "string" &&
    typeof f.overdue === "boolean" &&
    typeof f.archived === "boolean"
  );
}

/** قراءة دفاعية من localStorage — النمط المعتمد في المشروع */
function readStoredPresets(key: string): RequestPreset[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_PRESETS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_PRESETS;
    const list = parsed.filter(isValidPreset);
    return list.length > 0 ? list : EMPTY_PRESETS;
  } catch {
    return EMPTY_PRESETS; /* التخزين محجوب أو البيانات تالفة */
  }
}

/**
 * مخزن على مستوى الوحدة لكل مفتاح مستخدم: قراءة واحدة عند أول استخدام،
 * ومرجع قيمة ثابت بين القراءات (شرط useSyncExternalStore)، ومستمعون
 * يُنبَّهون بعد كل حفظ/حذف. لقطة الخادم فارغة دائمًا فلا تعارض إماهة
 * (نمط شريط الإعلان) — مهيئ useState قارئٌ لـ localStorage كان سيسبب
 * تعارض إماهة عند وجود إعدادات محفوظة (الخادم يرسم بلا حبكات).
 */
const presetStores = new Map<string, { value: RequestPreset[]; listeners: Set<() => void> }>();

function getPresetStore(key: string) {
  let store = presetStores.get(key);
  if (!store) {
    store = { value: readStoredPresets(key), listeners: new Set() };
    presetStores.set(key, store);
  }
  return store;
}

function makePresetId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RequestsClient({ me, locale, initialStatus, initialOverdue }: RequestsClientProps) {
  const t = getPortalContent(locale);
  const tr = t.admin.requests;
  const tp = t.admin.requests; // تصفيات محفوظة — مفاتيح admin.requests

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = useState(initialStatus ?? "all");
  const [priority, setPriority] = useState("all");
  const [service, setService] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [archived, setArchived] = useState(false);
  const [overdue, setOverdue] = useState(Boolean(initialOverdue));
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<RequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const mayAssign = can(me, "requests.assign");
  const mayArchive = can(me, "requests.archive");
  const mayExport = can(me, "requests.export");
  const maySavedReplies = can(me, "requests.reply");

  const [repliesOpen, setRepliesOpen] = useState(false);

  // ——— التصفيات المحفوظة: localStorage بمفتاح خاص بالمستخدم الحالي ———
  const presetKey = `so7ob-req-presets:${me.id}`;
  const [presetSaveOpen, setPresetSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const subscribePresets = useCallback(
    (notify: () => void) => {
      const store = getPresetStore(presetKey);
      store.listeners.add(notify);
      return () => {
        store.listeners.delete(notify);
      };
    },
    [presetKey],
  );
  const presets = useSyncExternalStore(
    subscribePresets,
    useCallback(() => getPresetStore(presetKey).value, [presetKey]),
    () => EMPTY_PRESETS,
  );

  /** كتابة جديدة (حفظ/حذف) — تحدّث التخزين ثم تنبّه المشتركين فورًا */
  const writePresets = (updater: (prev: RequestPreset[]) => RequestPreset[]) => {
    const store = getPresetStore(presetKey);
    const next = updater(store.value);
    try {
      window.localStorage.setItem(presetKey, JSON.stringify(next));
    } catch {
      /* التخزين ممتلئ أو محجوب — نسخة الجلسة تستمر */
    }
    store.value = next;
    store.listeners.forEach((notify) => notify());
  };

  /** تطبيق إعداد — نفس مسار نقرات التصفية العادية (حالة/بحث مؤجل) + عودة للصفحة 1 */
  const applyPreset = (filters: PresetFilters) => {
    setQ(filters.q);
    setStatus(filters.status);
    setPriority(filters.priority);
    setService(filters.service);
    setAssignee(filters.assignee);
    setOverdue(filters.overdue);
    setArchived(filters.archived);
    setPage(1);
  };

  const savePreset = () => {
    const name = presetName.trim().slice(0, 30);
    if (!name) return;
    const snapshot: PresetFilters = { status, priority, service, assignee, q, overdue, archived };
    writePresets((prev) => {
      const next = [...prev, { id: makePresetId(), name, filters: snapshot }];
      return next.length > PRESET_LIMIT ? next.slice(next.length - PRESET_LIMIT) : next;
    });
    setPresetSaveOpen(false);
    setPresetName("");
    toast.success(tp.presetSaved);
  };

  const removePreset = (id: string) => {
    writePresets((prev) => prev.filter((preset) => preset.id !== id));
    toast.success(tp.presetRemoved);
  };

  const onPresetDialogChange = (open: boolean) => {
    setPresetSaveOpen(open);
    if (!open) setPresetName("");
  };

  /** هل مزيج التصفية الحالي يطابق الإعداد حرفيًا؟ (للحالة المضغوطة aria-pressed) */
  const isPresetActive = (filters: PresetFilters) =>
    filters.status === status &&
    filters.priority === priority &&
    filters.service === service &&
    filters.assignee === assignee &&
    filters.q === q &&
    filters.overdue === overdue &&
    filters.archived === archived;

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          q: debouncedQ,
          status: status !== "all" ? status : "",
          priority: priority !== "all" ? priority : "",
          service: service !== "all" ? service : "",
          assignee: assignee !== "all" ? assignee : "",
          archived,
          overdue: overdue ? "1" : "",
          page,
        });
        const res = await apiGet<RequestsResponse>(`/api/admin/requests${query}`);
        if (!signal.aborted) {
          setData(res);
          setSelected(new Set());
        }
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedQ, status, priority, service, assignee, archived, overdue, page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);

  const staff: StaffOption[] = data?.staff ?? [];
  const requests: RequestRow[] = data?.requests ?? [];

  // ——— الإجراءات ———
  const patchRequest = async (id: string, body: Record<string, unknown>, successMsg?: string) => {
    setBusyId(id);
    try {
      await apiSend(`/api/admin/requests/${id}`, "PATCH", body);
      if (successMsg) toast.success(successMsg);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setBusyId(null);
    }
  };

  const bulk = async (action: "archive" | "restore") => {
    if (selected.size === 0) return;
    try {
      await apiSend<{ ok: boolean; count: number }>("/api/admin/requests/bulk", "POST", {
        ids: Array.from(selected),
        action,
      });
      toast.success(action === "archive" ? tr.archived : tr.restore);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    }
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(requests.map((r) => r.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allChecked = requests.length > 0 && requests.every((r) => selected.has(r.id));
  const someChecked = requests.some((r) => selected.has(r.id)) && !allChecked;

  const statusKeys = useMemo(() => Object.keys(tr.statuses), [tr.statuses]);
  const priorityKeys = useMemo(() => Object.keys(tr.priorities), [tr.priorities]);
  const serviceKeys = useMemo(() => Object.keys(tr.services), [tr.services]);

  // تصدير CSV بنفس تصفية العرض الحالية — رابط نسبي فيرسل الكوكيز تلقائيًا
  const exportCsv = () => {
    const query = buildQuery({
      q: debouncedQ,
      status: status !== "all" ? status : "",
      priority: priority !== "all" ? priority : "",
      service: service !== "all" ? service : "",
      assignee: assignee !== "all" ? assignee : "",
      archived,
      overdue: overdue ? "1" : "",
    });
    window.open(`/api/admin/requests/export${query}`, "_blank");
    toast.success(tr.exportOk);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">{tr.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {maySavedReplies ? (
            <Button variant="outline" onClick={() => setRepliesOpen(true)} className="min-h-11 rounded-full">
              <BookMarked className="size-4" aria-hidden="true" />
              {t.admin.savedReplies.manage}
            </Button>
          ) : null}
          {mayExport ? (
            <Button variant="outline" onClick={exportCsv} className="min-h-11 rounded-full">
              <Download className="size-4" aria-hidden="true" />
              {tr.export}
            </Button>
          ) : null}
        </div>
      </div>
      <SavedRepliesDialog locale={locale} open={repliesOpen} onOpenChange={setRepliesOpen} />

      {/* حوارية حفظ التصفية الحالية باسم */}
      <Dialog open={presetSaveOpen} onOpenChange={onPresetDialogChange}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">{tp.presetSave}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              savePreset();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="req-preset-name" className="text-xs">
                {tp.presetName}
              </Label>
              <Input
                id="req-preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                maxLength={30}
                autoFocus
                className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onPresetDialogChange(false)}
                className="min-h-11 rounded-full"
              >
                {t.admin.users.cancel}
              </Button>
              <Button type="submit" disabled={!presetName.trim()} className="min-h-11 rounded-full">
                <BookmarkPlus className="size-4" aria-hidden="true" />
                {tp.presetSave}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* أدوات التصفية */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={tr.searchPlaceholder}
            aria-label={tr.searchPlaceholder}
            className="min-h-11 ps-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterStatus} className="min-h-11 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterStatus}</SelectItem>
            {statusKeys.map((s) => (
              <SelectItem key={s} value={s}>{tr.statuses[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterPriority} className="min-h-11 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterPriority}</SelectItem>
            {priorityKeys.map((p) => (
              <SelectItem key={p} value={p}>{tr.priorities[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={service} onValueChange={(v) => { setService(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterService} className="min-h-11 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterService}</SelectItem>
            {serviceKeys.map((s) => (
              <SelectItem key={s} value={s}>{tr.services[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={(v) => { setAssignee(v); setPage(1); }}>
          <SelectTrigger aria-label={tr.filterAssignee} className="min-h-11 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr.filterAll} — {tr.filterAssignee}</SelectItem>
            <SelectItem value="none">{tr.unassigned}</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="archived-toggle" checked={archived} onCheckedChange={(v) => { setArchived(v); setPage(1); }} />
          <Label htmlFor="archived-toggle" className="cursor-pointer text-sm text-muted-foreground">
            {tr.archived}
          </Label>
        </div>
        {/* مرشّح الردود المتأخرة — زر حبة بنبرة وردية عند التفعيل (لغة مؤشر اللوحة) */}
        <button
          type="button"
          aria-pressed={overdue}
          onClick={() => {
            setOverdue((v) => !v);
            setPage(1);
          }}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
            overdue
              ? "border-rose-300 bg-rose-100 text-rose-800"
              : "border-border bg-white text-muted-foreground hover:bg-muted/50"
          )}
        >
          <Timer className="size-4" aria-hidden="true" />
          {tr.filterOverdue}
        </button>
        {/* حفظ مزيج التصفية الحالي كإعداد محلي — التركيبة الفارغة صالحة أيضًا */}
        <Button variant="outline" onClick={() => setPresetSaveOpen(true)} className="min-h-11 rounded-full">
          <BookmarkPlus className="size-4" aria-hidden="true" />
          {tp.presetSave}
        </Button>
      </div>

      {/* تصفيات محفوظة: تطبيق بنقرة الحبة، وحذف مباشر من زر الإنهاء داخلها */}
      {presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => {
            const active = isPresetActive(preset.filters);
            return (
              <div
                key={preset.id}
                className={cn(
                  "inline-flex min-h-9 items-stretch rounded-full border transition-colors",
                  active ? "border-brand bg-accent text-brand-strong" : "border-border bg-white text-muted-foreground",
                )}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${tp.presetApply} — ${preset.name}`}
                  onClick={() => applyPreset(preset.filters)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-s-full ps-3 pe-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    active ? "" : "hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {active ? (
                    <BookmarkCheck className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Bookmark className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="max-w-48 truncate">{preset.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${tp.presetDelete} — ${preset.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePreset(preset.id);
                  }}
                  className="inline-flex min-h-9 w-9 items-center justify-center rounded-e-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* شريط التحديد الجماعي */}
      {mayArchive && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-accent/60 px-4 py-3">
          <p className="text-sm font-semibold text-brand-strong">
            {selected.size} {tr.selected}
          </p>
          <div className="ms-auto flex items-center gap-2">
            <Button
              variant={archived ? "outline" : "default"}
              onClick={() => bulk(archived ? "restore" : "archive")}
              className="min-h-10 rounded-full"
            >
              {archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
              {archived ? tr.restore : tr.bulkArchive}
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())} className="min-h-10 rounded-full">
              {t.admin.users.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {/* الجدول */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                {mayArchive ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      aria-label={tr.bulkArchive}
                    />
                  </TableHead>
                ) : null}
                <TableHead className="min-w-24">{t.account.requests.refCode}</TableHead>
                <TableHead className="min-w-44">{tr.client}</TableHead>
                <TableHead className="min-w-24">{tr.filterService}</TableHead>
                <TableHead className="min-w-24">{tr.priority}</TableHead>
                <TableHead className="min-w-28">{tr.filterStatus}</TableHead>
                <TableHead className="min-w-36">{tr.filterAssignee}</TableHead>
                <TableHead className="w-16"><span className="sr-only">{tr.messages}</span></TableHead>
                <TableHead className="min-w-32">{tr.lastActivity}</TableHead>
                <TableHead className="w-14"><span className="sr-only">{tr.viewDetails}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: mayArchive ? 10 : 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={mayArchive ? 10 : 9} className="p-0">
                    <EmptyState icon={Inbox} title={tr.empty} body={tr.emptyBody} />
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={selected.has(row.id) ? "selected" : undefined}
                    className={cn("transition-colors hover:bg-muted/50", busyId === row.id && "opacity-60")}
                  >
                    {mayArchive ? (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                          aria-label={row.refCode}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/requests/${row.id}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-navy transition-colors hover:text-brand ltr-isolate"
                      >
                        {row.requestType === "quote" ? (
                          <FileText className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                        ) : (
                          <MessageSquare className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                        )}
                        {row.refCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="truncate text-sm font-medium text-navy">{row.name}</p>
                      <p className="truncate text-xs text-muted-foreground ltr-isolate">{row.email}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tr.services[row.serviceType] ?? row.serviceType}</TableCell>
                    <TableCell><PriorityBadge priority={row.priority} label={tr.priorities[row.priority] ?? row.priority} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={row.status} label={tr.statuses[row.status] ?? row.status} />
                        {row.awaitingSince ? <AgingBadge since={row.awaitingSince} tr={tr} /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.assigneeName ?? <span className="text-muted-foreground/60">{tr.unassigned}</span>}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <MessageSquare className="size-3.5" aria-hidden="true" />
                        {row.messageCount}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      <span
                        className={cn("me-1.5 inline-block size-2 rounded-full", row.needsStaffReply ? "bg-amber-500" : "bg-transparent")}
                        title={row.needsStaffReply ? t.admin.dashboard.unansweredRequests : undefined}
                      >
                        {row.needsStaffReply ? (
                          <span className="sr-only">{t.admin.dashboard.unansweredRequests}</span>
                        ) : null}
                      </span>
                      {fmtRelative(row.lastActivityAt, locale)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-10" aria-label={tr.viewDetails}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/admin/requests/${row.id}`}>
                              <Eye className="size-4" aria-hidden="true" />
                              {tr.viewDetails}
                            </Link>
                          </DropdownMenuItem>
                          {mayAssign ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={row.assigneeId === me.id}
                                onClick={() => patchRequest(row.id, { assigneeId: me.id })}
                              >
                                <UserPlus className="size-4" aria-hidden="true" />
                                {tr.assignToMe}
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <UserPlus className="size-4" aria-hidden="true" />
                                  {tr.assignTo}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                  <DropdownMenuItem onClick={() => patchRequest(row.id, { assigneeId: null })}>
                                    {tr.unassigned}
                                  </DropdownMenuItem>
                                  {staff.map((s) => (
                                    <DropdownMenuItem key={s.id} onClick={() => patchRequest(row.id, { assigneeId: s.id })}>
                                      {s.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </>
                          ) : null}
                          {mayArchive ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  patchRequest(row.id, { action: archived ? "restore" : "archive" }, archived ? tr.restore : tr.archived)
                                }
                              >
                                {archived ? (
                                  <ArchiveRestore className="size-4" aria-hidden="true" />
                                ) : (
                                  <Archive className="size-4" aria-hidden="true" />
                                )}
                                {archived ? tr.restore : tr.archive}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={tr.viewDetails}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {data ? (
        <AdminPagination page={page} total={data.total} pageSize={data.pageSize} locale={locale} onPage={setPage} />
      ) : null}

      {loading && data ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
    </div>
  );
}
