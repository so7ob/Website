"use client";

/**
 * لوحة رابط المتابعة (طاقم) — قسم مشترك يُركّب في تفاصيل الطلب والاستفسار:
 * تعرض السياسة الفعلية للبطاقة ومصدرها وحالة الرابط الحالي (فعّال/منتهي/ملغى)،
 * وتتيح التجديد (الرمز الجديد يُعرض مرة واحدة فقط) والإلغاء بتأكيد.
 * البيانات من /api/admin/track — الأذونات تُفرض خادميًا (العرض view.all،
 * والإجراءات reply)، لذا يُركَّب المكوّن دائمًا دون بوابات محلية.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, Check, Copy, Link2, MailCheck, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPortalContent } from "@/content/portal";
import type { PortalContent } from "@/content/portal/types";
import { apiGet, apiSend, apiErrorMessage } from "@/components/admin/helpers";

type TrackScope = "request" | "inquiry";

interface TrackLinkState {
  id: string;
  state: "valid" | "expired" | "revoked" | "missing";
  expiresAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
}

interface TrackGetResponse {
  ok: boolean;
  link: TrackLinkState | null;
  policy: { mode: string; source: string; canReplyViaLink: boolean };
  settings: { forceLogin: boolean };
}

interface TrackPanelProps {
  scope: TrackScope;
  cardId: string;
  locale: "ar" | "en";
  t: PortalContent["admin"]["track"];
}

/** شارات حالة الرابط — لغة النقاط الناعمة نفسها في لوحة الإدارة */
const STATE_CHIPS: Record<"valid" | "expired" | "revoked", string> = {
  valid: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  expired: "border border-amber-300 bg-amber-100 text-amber-900",
  revoked: "border border-rose-200 bg-rose-50 text-rose-800",
};

/** تاريخ ووقت بصيغة Intl للغتين — نمط نسخة المحرر */
function fmtTrackDate(value: string, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TrackPanel({ scope, cardId, locale, t }: TrackPanelProps) {
  const authErrors = getPortalContent(locale).auth.errors;
  const trackT = getPortalContent(locale).track;

  const [data, setData] = useState<TrackGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<"renew" | "revoke" | null>(null);
  const [renewedPath, setRenewedPath] = useState<string | null>(null);
  const [renewedEmailedTo, setRenewedEmailedTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await apiGet<TrackGetResponse>(
          `/api/admin/track?scope=${scope}&id=${encodeURIComponent(cardId)}`
        );
        if (!signal.aborted) {
          setData(res);
          setFailed(false);
        }
      } catch (err) {
        if (signal.aborted) return;
        setFailed(true);
        toast.error(apiErrorMessage(err, authErrors));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [scope, cardId, authErrors]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  const refresh = () => setReloadToken((v) => v + 1);

  /** نسخ الرابط الكامل — احتياطي textarea ثم فشل صامت (نمط بطاقات النجاح) */
  const copyPath = async (path: string) => {
    const absolute = path.startsWith("/")
      ? typeof window !== "undefined"
        ? `${window.location.origin}${path}`
        : path
      : path;
    const legacyCopy = () => {
      try {
        const area = document.createElement("textarea");
        area.value = absolute;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
        return true;
      } catch {
        return false;
      }
    };
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      if (legacyCopy()) setCopied(true);
      else console.warn("clipboard copy unavailable");
    }
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const renew = async () => {
    setPending("renew");
    try {
      const res = await apiSend<{ ok: boolean; token?: string; emailedTo?: string | null }>("/api/admin/track", "POST", {
        action: "renew",
        scope,
        id: cardId,
      });
      if (res.ok && typeof res.token === "string") {
        // الرمز يُعرض مرة واحدة — نبني المسار بلغة اللوحة الحالية
        setRenewedPath(`/${locale}/track?t=${encodeURIComponent(res.token)}`);
        setRenewedEmailedTo(typeof res.emailedTo === "string" && res.emailedTo ? res.emailedTo : null);
        refresh(); // تحديث صامت لحالة الرابط وتاريخ الانتهاء
      } else {
        toast.error(authErrors.generic);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, authErrors));
    } finally {
      setPending(null);
    }
  };

  const revoke = async () => {
    if (!window.confirm(t.revokeConfirm)) return;
    setPending("revoke");
    try {
      const res = await apiSend<{ ok: boolean; code?: string }>("/api/admin/track", "POST", {
        action: "revoke",
        scope,
        id: cardId,
      });
      if (res.ok) toast.success(t.revoked);
      // already_revoked / not_found → إعادة جلب صامتة بلا إزعاج
      refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err, authErrors));
    } finally {
      setPending(null);
    }
  };

  if (failed && !data) return null;

  // الرابط المعروض فقط إن وُجد بحالة معروفة (missing يعادل لا رابط)
  const activeLink = data?.link && data.link.state !== "missing" ? data.link : null;
  const modeLabel = t.mode[(data?.policy.mode ?? "") as keyof typeof t.mode] ?? data?.policy.mode ?? "";
  const sourceLabel = t.policySource[(data?.policy.source ?? "") as keyof typeof t.policySource] ?? "";

  return (
    <section aria-label={t.section} className="rounded-2xl border border-border bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
        <Link2 className="size-4 text-brand" aria-hidden="true" />
        {t.section}
      </h2>

      {loading ? (
        <div className="mt-3 h-20 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
      ) : data ? (
        <div className="mt-3 space-y-3">
          {/* السياسة الفعلية — الرقاقة + مصدرها الصغير */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.effectivePolicy}</span>
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-brand-strong">
              {modeLabel}
            </span>
            <span className="text-xs text-muted-foreground">{sourceLabel}</span>
          </div>

          {/* فرض تسجيل الدخول يتغلب على أي استثناء — تحذير كهرماني مستقل */}
          {data.settings.forceLogin ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t.forceLoginActive}
            </p>
          ) : null}

          {/* صف الرابط الحالي — أو سطر «لا رابط» */}
          {activeLink ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_CHIPS[activeLink.state]}`}>
                {activeLink.state === "valid" ? t.stateValid : activeLink.state === "expired" ? t.stateExpired : t.stateRevoked}
              </span>
              <span className="text-muted-foreground">{t.expiresAt}</span>
              <span className="tabular-nums text-navy ltr-isolate">{fmtTrackDate(activeLink.expiresAt, locale)}</span>
              {activeLink.state === "revoked" && activeLink.revokedAt ? (
                <>
                  <span className="text-muted-foreground">· {t.revokedAt}</span>
                  <span className="tabular-nums text-navy ltr-isolate">{fmtTrackDate(activeLink.revokedAt, locale)}</span>
                </>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noLink}</p>
          )}

          {/* صندوق كشف الرمز مرة واحدة بعد التجديد — يحل محل الأزرار */}
          {renewedPath ? (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-700">{t.renewed}</p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={renewedPath}
                  dir="ltr"
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={t.section}
                  className="min-h-11 flex-1 bg-white font-mono text-xs ltr-isolate"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void copyPath(renewedPath)}
                  aria-label={copied ? trackT.copied : trackT.copyTracking}
                  className="size-11 shrink-0"
                >
                  {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t.renewHint}</p>
              {renewedEmailedTo ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <MailCheck className="size-3.5" aria-hidden="true" />
                  {t.renewEmailedTo} <span dir="ltr" className="ltr-isolate">{renewedEmailedTo}</span>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={renew}
                disabled={pending !== null}
                className="min-h-11 rounded-full px-5 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <RefreshCw className={`size-4${pending === "renew" ? " animate-spin" : ""}`} aria-hidden="true" />
                {t.renew}
              </Button>
              {activeLink ? (
                <Button
                  variant="outline"
                  onClick={revoke}
                  disabled={pending !== null}
                  className="min-h-11 rounded-full border-destructive/40 px-5 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Ban className="size-4" aria-hidden="true" />
                  {t.revoke}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
