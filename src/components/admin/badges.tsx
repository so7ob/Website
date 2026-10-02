/**
 * شارات الحالة والأولوية والدور — ألوان دلالية ثابتة من لوحة الهوية.
 * النصوص تمرر من الترجمات، هنا الألوان والشكل فقط.
 * كل شارة: خلفية ملوّنة خفيفة + حد بنفس العائلة + نقطة مؤشر — بنفس دلالات الألوان الأصلية.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SYSTEM_ROLES } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";

interface Tone {
  chip: string;
  dot: string;
}

const FALLBACK_TONE: Tone = {
  chip: "border-slate-200 bg-secondary/70 text-secondary-foreground",
  dot: "bg-slate-400",
};

function ToneBadge({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <Badge className={cn("gap-1.5 rounded-full", tone.chip, className)}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      {label}
    </Badge>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  new: { chip: "border-sky-200 bg-accent/70 text-brand-strong", dot: "bg-brand" },
  in_review: { chip: "border-slate-200 bg-secondary/70 text-secondary-foreground", dot: "bg-slate-400" },
  awaiting_info: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  in_progress: { chip: "border-sky-200 bg-brand-soft/70 text-brand-strong", dot: "bg-brand" },
  responded: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  closed: { chip: "border-slate-300 bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  cancelled: { chip: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

/** شارة حالة الطلب/الاستفسار */
export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return <ToneBadge tone={STATUS_TONES[status] ?? FALLBACK_TONE} label={label} className={className} />;
}

const PRIORITY_TONES: Record<string, Tone> = {
  low: { chip: "border-slate-200 bg-muted/70 text-muted-foreground", dot: "bg-slate-400" },
  normal: { chip: "border-sky-200 bg-accent/70 text-brand-strong", dot: "bg-brand" },
  high: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  urgent: { chip: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
};

/** شارة الأولوية */
export function PriorityBadge({ priority, label, className }: { priority: string; label: string; className?: string }) {
  return <ToneBadge tone={PRIORITY_TONES[priority] ?? FALLBACK_TONE} label={label} className={className} />;
}

const USER_STATUS_TONES: Record<string, Tone> = {
  active: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  pending_verification: { chip: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-400" },
  suspended: { chip: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

/** شارة حالة حساب المستخدم */
export function UserStatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return <ToneBadge tone={USER_STATUS_TONES[status] ?? FALLBACK_TONE} label={label} className={className} />;
}

const ROLE_TONES: Record<string, Tone> = {
  super_admin: { chip: "border-navy bg-navy text-white", dot: "bg-skydrop" },
  ops_manager: { chip: "border-sky-200 bg-brand-soft/70 text-brand-strong", dot: "bg-brand" },
  support: { chip: "border-sky-200 bg-accent/70 text-brand-strong", dot: "bg-brand" },
  content_editor: { chip: "border-purple-200 bg-purple-50 text-purple-800", dot: "bg-purple-500" },
  client: { chip: "border-slate-200 bg-secondary/70 text-secondary-foreground", dot: "bg-slate-400" },
};

/** شارة الدور — الاسم من SYSTEM_ROLES بلغة الواجهة */
export function RoleBadge({ roleKey, locale, className }: { roleKey: string; locale: Locale; className?: string }) {
  const role = SYSTEM_ROLES.find((r) => r.key === roleKey);
  const label = locale === "en" ? role?.nameEn ?? roleKey : role?.nameAr ?? roleKey;
  return <ToneBadge tone={ROLE_TONES[roleKey] ?? FALLBACK_TONE} label={label} className={className} />;
}

/** اسم الدور المترجم (بدون شارة) */
export function roleLabel(roleKey: string, locale: Locale): string {
  const role = SYSTEM_ROLES.find((r) => r.key === roleKey);
  return locale === "en" ? role?.nameEn ?? roleKey : role?.nameAr ?? roleKey;
}

const OUTBOX_TONES: Record<string, Tone> = {
  sent: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  dev_logged: { chip: "border-sky-200 bg-accent/70 text-brand-strong", dot: "bg-brand" },
  failed: { chip: "border-destructive/60 bg-destructive text-white", dot: "bg-white/80" },
};

/** شارة حالة البريد */
export function OutboxStatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return <ToneBadge tone={OUTBOX_TONES[status] ?? FALLBACK_TONE} label={label} className={className} />;
}

/** شارة رمز فعل التدقيق — تقنية بحتة (رمز لا نصًا مترجمًا) */
export function ActionBadge({ action }: { action: string }) {
  return (
    <Badge variant="outline" className="rounded-full bg-muted/50 font-mono text-[11px] tracking-tight">
      {action}
    </Badge>
  );
}
