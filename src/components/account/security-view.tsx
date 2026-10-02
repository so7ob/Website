"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, Laptop, Loader2, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { apiFetch } from "./api";
import { describeUserAgent, formatDate, formatRelative } from "./format";
import type { AuthSessionRow } from "./types";

/** الأمان: تغيير كلمة المرور (يبطل كل الجلسات) + إدارة الأجهزة النشطة */
export function SecurityView({
  locale,
  t,
  authErrors,
  authLabels,
}: {
  locale: Locale;
  t: PortalContent["account"]["security"];
  authErrors: PortalContent["auth"]["errors"];
  authLabels: { currentPassword: string; newPassword: string; confirmPassword: string };
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ currentPassword?: string; newPassword?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState<AuthSessionRow[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    const result = await apiFetch<{ ok?: boolean; sessions?: AuthSessionRow[] }>("/api/auth/sessions");
    setSessions(result.data.ok ? (result.data.sessions ?? []) : []);
  }, []);

  useEffect(() => {
    void (async () => {
      await loadSessions();
    })();
  }, [loadSessions]);

  async function onChangePassword(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (saving) return;
    setFieldErrors({});
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!currentPassword) errors.currentPassword = authErrors.required;
    if (!newPassword) errors.newPassword = authErrors.required;
    if (!confirm) errors.confirm = authErrors.required;
    if (newPassword && confirm && newPassword !== confirm) errors.confirm = authErrors.passwordMismatch;
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    const result = await apiFetch<{ ok?: boolean; signedOut?: boolean; errors?: Record<string, string> }>(
      "/api/auth/change-password",
      { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }
    );
    setSaving(false);

    if (result.data.ok) {
      toast.success(t.passwordChanged, { description: t.passwordChangedBody });
      // كل الجلسات أُبطلت — عودة لصفحة الدخول
      void signOut({ callbackUrl: `/${locale}/auth/login` });
      return;
    }

    const serverErrors = result.data.errors ?? {};
    const mapped: typeof fieldErrors = {};
    if (serverErrors.currentPassword) mapped.currentPassword = authErrors.wrongPassword;
    if (serverErrors.newPassword === "password_weak") mapped.newPassword = authErrors.passwordWeak;
    if (serverErrors.newPassword === "same_password") mapped.newPassword = authErrors.invalid;
    setFieldErrors(mapped);
    if (Object.keys(mapped).length === 0) setFormError(authErrors.generic);
  }

  async function revoke(id: string) {
    if (revokingId) return;
    setRevokingId(id);
    const result = await apiFetch<{ ok?: boolean; currentRevoked?: boolean }>("/api/auth/sessions", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    setRevokingId(null);

    if (result.data.ok) {
      if (result.data.currentRevoked) {
        // أبطلنا جلسة هذا الجهاز — خروج كامل
        void signOut({ callbackUrl: `/${locale}/auth/login` });
        return;
      }
      toast.success(t.revoked);
      await loadSessions();
    } else {
      toast.error(authErrors.generic);
    }
  }

  async function revokeAll() {
    if (revokingAll) return;
    setRevokingAll(true);
    const result = await apiFetch<{ ok?: boolean }>("/api/auth/sessions", {
      method: "POST",
      body: JSON.stringify({ all: true }),
    });
    setRevokingAll(false);
    if (result.data.ok) {
      toast.success(t.revoked);
      await loadSessions();
    } else {
      toast.error(authErrors.generic);
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy">{t.title}</h1>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* تغيير كلمة المرور */}
        <section className="rounded-2xl border border-border bg-white p-6">
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-navy">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <KeyRound className="size-4" aria-hidden="true" />
            </span>
            {t.changePassword}
          </h2>
          {formError && (
            <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {formError}
            </div>
          )}
          <form onSubmit={onChangePassword} noValidate className="mt-5 space-y-5">
            <PasswordField
              id="security-current"
              label={authLabels.currentPassword}
              value={currentPassword}
              onChange={setCurrentPassword}
              error={fieldErrors.currentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              id="security-new"
              label={authLabels.newPassword}
              value={newPassword}
              onChange={setNewPassword}
              error={fieldErrors.newPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="security-confirm"
              label={authLabels.confirmPassword}
              value={confirm}
              onChange={setConfirm}
              error={fieldErrors.confirm}
              autoComplete="new-password"
            />
            <Button
              type="submit"
              disabled={saving}
              className="h-12 w-full rounded-full bg-primary text-base font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              {t.changePassword}
            </Button>
          </form>
        </section>

        {/* الجلسات النشطة */}
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-navy">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                <MonitorSmartphone className="size-4" aria-hidden="true" />
              </span>
              {t.sessions}
            </h2>
            {others.length > 0 && (
              <Button
                variant="outline"
                className="h-10 rounded-full px-4 text-sm font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={revokeAll}
                disabled={revokingAll}
              >
                {revokingAll ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldOff className="h-4 w-4" aria-hidden="true" />}
                {t.revokeAll}
              </Button>
            )}
          </div>

          {sessions === null ? (
            <ul className="mt-5 divide-y divide-border rounded-xl border border-border/70" aria-busy="true" aria-label={t.sessions}>
              {[...Array(3)].map((_, i) => (
                <li key={i} className="flex items-center gap-4 px-4 py-4">
                  <Skeleton className="animate-shimmer size-9 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="animate-shimmer h-4 w-36" />
                    <Skeleton className="animate-shimmer h-3 w-24" />
                  </div>
                </li>
              ))}
            </ul>
          ) : sessions.length === 0 ? (
            <p className="mt-5 rounded-xl border border-border/70 px-4 py-4 text-sm text-muted-foreground">{t.noSessions}</p>
          ) : (
            <ul className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border/70">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className={`flex flex-wrap items-center gap-4 py-4 pe-4 transition-colors ${
                    session.current
                      ? "border-s-2 border-s-brand bg-accent/40 ps-3.5"
                      : "hover:bg-muted/50 ps-4"
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      session.current ? "bg-brand-soft text-brand-strong" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Laptop className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy">
                      {describeUserAgent(session.userAgent, t.unknownDevice)}
                      {session.current && (
                        <>
                          <span className="inline-flex size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-strong">
                            {t.thisDevice}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">
                      {t.lastActive}: {formatRelative(session.lastSeenAt, locale)} · {t.created}: {formatDate(session.createdAt, locale)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full px-4 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800 focus-visible:ring-2 focus-visible:ring-ring/40"
                    onClick={() => void revoke(session.id)}
                    disabled={revokingId === session.id}
                  >
                    {revokingId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
                    {t.revoke}
                  </Button>
                </li>
              ))}
              {others.length === 0 && sessions.length > 0 && (
                <li className="px-4 py-4 text-sm text-muted-foreground">{t.noSessions}</li>
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-navy">
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40 ${error ? "border-rose-400" : ""}`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
