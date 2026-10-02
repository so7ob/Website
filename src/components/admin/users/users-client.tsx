"use client";

/**
 * جدول إدارة المستخدمين: بحث مؤجل + تصفية (دور/حالة) + ترتيب + ترقيم صفحات،
 * وإجراءات محمية بالصلاحيات: تعديل بيانات، تغيير دور، إيقاف/تفعيل، دعوة،
 * إرسال استعادة كلمة المرور. العرض فقط إذنًا — القرار دائمًا في الخادم.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  Ban,
  CheckCircle2,
  CircleX,
  UserPlus,
  KeyRound,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Users,
  Loader2,
  RotateCcw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortalContent } from "@/content/portal";
import { can } from "@/lib/auth/permissions";
import { SYSTEM_ROLES } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";
import { RoleBadge, UserStatusBadge } from "@/components/admin/badges";
import { AdminPagination } from "@/components/admin/pagination";
import { EmptyState } from "@/components/admin/empty-state";
import { useDebounced } from "@/components/admin/use-debounced";
import { apiGet, apiSend, ApiError, apiErrorMessage, buildQuery, fmtDate, fmtRelative, totalPages } from "@/components/admin/helpers";
import type { AdminUser, Me, UsersResponse } from "../types";
import { cn } from "@/lib/utils";

type SortCol = "createdAt" | "lastLoginAt" | "name" | "email" | "roleKey";

interface UsersClientProps {
  me: Me;
  locale: Locale;
  initialQ: string;
  /** حالة مبدئية من رابط الصفحة (مثل ?status=pending_verification من اللوحة) */
  initialStatus?: string;
}

export function UsersClient({ me, locale, initialQ, initialStatus }: UsersClientProps) {
  const t = getPortalContent(locale);
  const tu = t.admin.users;

  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebounced(q);
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState(initialStatus ?? "all");
  const [sort, setSort] = useState<SortCol>("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ——— الجلب ———
  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          q: debouncedQ,
          role: role !== "all" ? role : "",
          status: status !== "all" ? status : "",
          sort,
          dir,
          page,
        });
        const res = await apiGet<UsersResponse>(`/api/admin/users${query}`);
        if (!signal.aborted) setData(res);
      } catch (err) {
        if (!signal.aborted && err instanceof ApiError) setError(apiErrorMessage(err, t.auth.errors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [debouncedQ, role, status, sort, dir, page, t.auth.errors]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = () => setReloadToken((v) => v + 1);

  // ——— الحواريات ———
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [roleValue, setRoleValue] = useState("client");
  const [roleSaving, setRoleSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null); // إيقاف/تفعيل

  const mayEdit = can(me, "users.update");
  const mayRoles = can(me, "users.roles");
  const maySuspend = can(me, "users.suspend");
  const mayInvite = can(me, "users.create");

  // ——— التعديلات ———
  const patchUser = async (id: string, body: Record<string, unknown>, successMsg: string) => {
    try {
      await apiSend(`/api/admin/users/${id}`, "PATCH", body);
      toast.success(successMsg);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "last_admin") {
        toast.error(tu.lastAdminError);
      } else {
        toast.error(apiErrorMessage(err, t.auth.errors));
      }
    }
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error(t.auth.errors.emailInvalid);
      return;
    }
    setInviteSending(true);
    try {
      const res = await apiSend<{ ok: boolean; emailStatus: string; devInviteUrl?: string }>("/api/admin/users", "POST", {
        email,
        roleKey: inviteRole,
      });
      toast.success(tu.inviteSent);
      setInviteUrl(res.devInviteUrl ?? null);
      setInviteEmail("");
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    } finally {
      setInviteSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await patchUser(editTarget.id, { name: editName, phone: editPhone, company: editCompany }, tu.saved);
    } finally {
      setEditSaving(false);
      setEditTarget(null);
    }
  };

  const saveRole = async () => {
    if (!roleTarget) return;
    setRoleSaving(true);
    try {
      await patchUser(roleTarget.id, { roleKey: roleValue }, tu.userUpdated);
    } finally {
      setRoleSaving(false);
      setRoleTarget(null);
    }
  };

  const applyStatus = async () => {
    if (!confirmTarget) return;
    const next = confirmTarget.status === "suspended" ? "active" : "suspended";
    await patchUser(confirmTarget.id, { status: next }, tu.userUpdated);
    setConfirmTarget(null);
  };

  const sendReset = async (user: AdminUser) => {
    try {
      await apiSend("/api/auth/forgot-password", "POST", { email: user.email });
      toast.success(tu.resetSent);
    } catch (err) {
      toast.error(apiErrorMessage(err, t.auth.errors));
    }
  };

  const onSort = (col: SortCol) => {
    if (sort === col) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(col);
      setDir(col === "name" || col === "email" ? "asc" : "desc");
    }
    setPage(1);
  };

  const users = data?.users ?? [];
  const statusLabel = (s: string) =>
    s === "active" ? tu.statusActive : s === "pending_verification" ? tu.statusPending : tu.statusSuspended;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-navy">{tu.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tu.subtitle}</p>
          </div>
        </header>
        {mayInvite ? (
          <Button
            onClick={() => {
              setInviteUrl(null);
              setInviteOpen(true);
            }}
            className="min-h-11 rounded-full shadow-md shadow-brand/20 hover:bg-brand-strong"
          >
            <UserPlus className="size-4" aria-hidden="true" />
            {tu.invite}
          </Button>
        ) : null}
      </div>

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
            placeholder={tu.searchPlaceholder}
            aria-label={tu.search}
            className="min-h-11 ps-9 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger aria-label={tu.role} className="min-h-11 w-40 focus-visible:ring-2 focus-visible:ring-ring/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tu.filterAll} — {tu.role}</SelectItem>
            {SYSTEM_ROLES.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {locale === "en" ? r.nameEn : r.nameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger aria-label={tu.status} className="min-h-11 w-44 focus-visible:ring-2 focus-visible:ring-ring/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tu.filterAll} — {tu.status}</SelectItem>
            <SelectItem value="active">{tu.statusActive}</SelectItem>
            <SelectItem value="pending_verification">{tu.statusPending}</SelectItem>
            <SelectItem value="suspended">{tu.statusSuspended}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* الجدول */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                <TableHead className="min-w-52">
                  <SortHeader label={t.account.profile.name} col="name" sort={sort} dir={dir} onSort={onSort} />
                </TableHead>
                <TableHead className="min-w-32">
                  <SortHeader label={tu.role} col="roleKey" sort={sort} dir={dir} onSort={onSort} />
                </TableHead>
                <TableHead className="min-w-28">{tu.status}</TableHead>
                <TableHead className="w-16"><span className="sr-only">{tu.emailVerified}</span></TableHead>
                <TableHead>
                  <SortHeader label={tu.createdAt} col="createdAt" sort={sort} dir={dir} onSort={onSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label={tu.lastLogin} col="lastLoginAt" sort={sort} dir={dir} onSort={onSort} />
                </TableHead>
                <TableHead className="text-center">{tu.requests}</TableHead>
                <TableHead className="w-14"><span className="sr-only">{tu.actions}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState icon={Users} title={t.admin.dashboard.noData} />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="min-w-0">
                        <Link
                          href={`/${locale}/admin/users/${user.id}`}
                          className="block truncate text-sm font-semibold text-navy transition-colors hover:text-brand"
                        >
                          {user.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground ltr-isolate">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><RoleBadge roleKey={user.roleKey} locale={locale} /></TableCell>
                    <TableCell><UserStatusBadge status={user.status} label={statusLabel(user.status)} /></TableCell>
                    <TableCell>
                      {user.emailVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span className="sr-only">{tu.emailVerified}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <CircleX className="size-3" aria-hidden="true" />
                          <span className="sr-only">{tu.notVerified}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{fmtDate(user.createdAt, locale)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {user.lastLoginAt ? fmtRelative(user.lastLoginAt, locale) : tu.never}
                    </TableCell>
                    <TableCell className="text-center text-sm font-medium tabular-nums text-navy">{user.requestsCount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-10" aria-label={tu.actions}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/${locale}/admin/users/${user.id}`}>
                              <Eye className="size-4" aria-hidden="true" />
                              {tu.viewProfile}
                            </Link>
                          </DropdownMenuItem>
                          {mayEdit ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditTarget(user);
                                setEditName(user.name);
                                setEditPhone(user.phone ?? "");
                                setEditCompany(user.company ?? "");
                              }}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                              {tu.edit}
                            </DropdownMenuItem>
                          ) : null}
                          {mayRoles ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setRoleTarget(user);
                                setRoleValue(user.roleKey);
                              }}
                            >
                              <ShieldCheck className="size-4" aria-hidden="true" />
                              {tu.changeRole}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => sendReset(user)}>
                            <KeyRound className="size-4" aria-hidden="true" />
                            {tu.sendReset}
                          </DropdownMenuItem>
                          {maySuspend ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={user.id === me.id}
                                onClick={() => setConfirmTarget(user)}
                                className={user.status === "suspended" ? "" : "text-destructive focus:text-destructive"}
                              >
                                {user.status === "suspended" ? (
                                  <CheckCircle2 className="size-4" aria-hidden="true" />
                                ) : (
                                  <Ban className="size-4" aria-hidden="true" />
                                )}
                                {user.status === "suspended" ? tu.activate : tu.suspend}
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
          <Button variant="outline" size="icon" onClick={reload} className="size-10 shrink-0" aria-label={tu.search}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {data ? (
        <AdminPagination
          page={page}
          total={data.total}
          pageSize={data.pageSize}
          locale={locale}
          onPage={setPage}
        />
      ) : null}

      {loading && data ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}

      {/* حوارية الدعوة */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setInviteUrl(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">{tu.inviteTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">{tu.inviteEmail}</Label>
              <Input
                id="invite-email"
                type="email"
                dir="ltr"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>{tu.inviteRole}</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {locale === "en" ? r.nameEn : r.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteUrl ? (
              <div className="rounded-xl border border-dashed border-brand bg-accent/50 p-3">
                <p className="text-xs font-medium text-brand-strong">{t.auth.devOutboxHint}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1.5 text-xs ltr-isolate" dir="ltr">
                    {inviteUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={() => {
                      void navigator.clipboard?.writeText(inviteUrl);
                    }}
                  >
                    {t.admin.media.copyUrl}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} className="min-h-11 rounded-full">
              {tu.cancel}
            </Button>
            <Button onClick={sendInvite} disabled={inviteSending} className="min-h-11 rounded-full">
              {inviteSending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tu.inviteSend}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوارية تعديل البيانات */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">{tu.edit} — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t.account.profile.name}</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t.account.profile.phone}</Label>
              <Input id="edit-phone" dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">{t.account.profile.company}</Label>
              <Input id="edit-company" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40" maxLength={120} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="min-h-11 rounded-full">
              {tu.cancel}
            </Button>
            <Button onClick={saveEdit} disabled={editSaving} className="min-h-11 rounded-full">
              {editSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tu.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوارية تغيير الدور */}
      <Dialog open={roleTarget !== null} onOpenChange={(open) => { if (!open) setRoleTarget(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy">{tu.changeRole} — {roleTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{tu.role}</Label>
            <Select value={roleValue} onValueChange={setRoleValue}>
              <SelectTrigger className="min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {locale === "en" ? r.nameEn : r.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{tu.confirmLastAdmin}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRoleTarget(null)} className="min-h-11 rounded-full">
              {tu.cancel}
            </Button>
            <Button onClick={saveRole} disabled={roleSaving || roleValue === roleTarget?.roleKey} className="min-h-11 rounded-full">
              {roleSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {tu.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الإيقاف/التفعيل */}
      <AlertDialog open={confirmTarget !== null} onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-navy">
              {confirmTarget?.status === "suspended" ? tu.activate : tu.suspend} — {confirmTarget?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.status === "suspended" ? tu.confirmActivate : tu.confirmSuspend}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 rounded-full">{tu.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={applyStatus} className="min-h-11 rounded-full">
              {confirmTarget?.status === "suspended" ? tu.activate : tu.suspend}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** رأس عمود قابل للترتيب */
function SortHeader({
  label,
  col,
  sort,
  dir,
  onSort,
}: {
  label: string;
  col: SortCol;
  sort: SortCol;
  dir: "asc" | "desc";
  onSort: (col: SortCol) => void;
}) {
  const active = sort === col;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md text-xs font-medium transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "text-navy" : "text-muted-foreground"
      )}
    >
      {label}
      <Icon className={cn("size-3.5 shrink-0", !active && "opacity-60")} aria-hidden="true" />
    </button>
  );
}
