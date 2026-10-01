/**
 * شارات الحالة والأولوية والدور — ألوان دلالية ثابتة من لوحة الهوية.
 * النصوص تمرر من الترجمات، هنا الألوان والشكل فقط.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SYSTEM_ROLES } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n";

const STATUS_TONES: Record<string, string> = {
  new: "border-transparent bg-accent text-brand-strong",
  in_review: "border-transparent bg-secondary text-secondary-foreground",
  awaiting_info: "border-transparent bg-amber-100 text-amber-800",
  in_progress: "border-transparent bg-brand-soft text-brand-strong",
  responded: "border-transparent bg-emerald-100 text-emerald-800",
  closed: "border-transparent bg-slate-200 text-slate-600",
  cancelled: "border-transparent bg-rose-100 text-rose-700",
};

/** شارة حالة الطلب/الاستفسار */
export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge className={cn(STATUS_TONES[status] ?? "border-transparent bg-secondary text-secondary-foreground", className)}>
      {label}
    </Badge>
  );
}

const PRIORITY_TONES: Record<string, string> = {
  low: "border-transparent bg-muted text-muted-foreground",
  normal: "border-transparent bg-accent text-brand-strong",
  high: "border-transparent bg-amber-100 text-amber-800",
  urgent: "border-transparent bg-red-100 text-red-700",
};

/** شارة الأولوية */
export function PriorityBadge({ priority, label, className }: { priority: string; label: string; className?: string }) {
  return (
    <Badge className={cn(PRIORITY_TONES[priority] ?? "border-transparent bg-muted text-muted-foreground", className)}>
      {label}
    </Badge>
  );
}

const USER_STATUS_TONES: Record<string, string> = {
  active: "border-transparent bg-emerald-100 text-emerald-800",
  pending_verification: "border-transparent bg-amber-100 text-amber-800",
  suspended: "border-transparent bg-rose-100 text-rose-700",
};

/** شارة حالة حساب المستخدم */
export function UserStatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge className={cn(USER_STATUS_TONES[status] ?? "border-transparent bg-secondary text-secondary-foreground", className)}>
      {label}
    </Badge>
  );
}

const ROLE_TONES: Record<string, string> = {
  super_admin: "border-transparent bg-navy text-white",
  ops_manager: "border-transparent bg-brand-soft text-brand-strong",
  support: "border-transparent bg-accent text-brand-strong",
  content_editor: "border-transparent bg-purple-100 text-purple-800",
  client: "border-transparent bg-secondary text-secondary-foreground",
};

/** شارة الدور — الاسم من SYSTEM_ROLES بلغة الواجهة */
export function RoleBadge({ roleKey, locale, className }: { roleKey: string; locale: Locale; className?: string }) {
  const role = SYSTEM_ROLES.find((r) => r.key === roleKey);
  const label = locale === "en" ? role?.nameEn ?? roleKey : role?.nameAr ?? roleKey;
  return <Badge className={cn(ROLE_TONES[roleKey] ?? "border-transparent bg-secondary text-secondary-foreground", className)}>{label}</Badge>;
}

/** اسم الدور المترجم (بدون شارة) */
export function roleLabel(roleKey: string, locale: Locale): string {
  const role = SYSTEM_ROLES.find((r) => r.key === roleKey);
  return locale === "en" ? role?.nameEn ?? roleKey : role?.nameAr ?? roleKey;
}

const OUTBOX_TONES: Record<string, string> = {
  sent: "border-transparent bg-emerald-100 text-emerald-800",
  dev_logged: "border-transparent bg-accent text-brand-strong",
  failed: "border-transparent bg-destructive text-white",
};

/** شارة حالة البريد */
export function OutboxStatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <Badge className={cn(OUTBOX_TONES[status] ?? "border-transparent bg-secondary text-secondary-foreground", className)}>
      {label}
    </Badge>
  );
}

/** شارة رمز فعل التدقيق — تقنية بحتة (رمز لا نصًا مترجمًا) */
export function ActionBadge({ action }: { action: string }) {
  return (
    <Badge variant="outline" className="font-mono text-[11px] tracking-tight">
      {action}
    </Badge>
  );
}
