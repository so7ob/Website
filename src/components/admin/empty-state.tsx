/**
 * حالة فراغ موحدة لقوائم لوحة الإدارة — أيقونة + عنوان + شرح.
 * إحساس بطاقة بحد متقطع + دائرة أيقونة ملوّنة.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, body, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-brand-strong ring-8 ring-accent/50">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-navy">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}
