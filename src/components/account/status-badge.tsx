/**
 * شارة حالة الطلب — خريطة ألوان متناسقة مع هوية العلامة (بلا نيلي).
 * النص يُمرَّر من ترجمات البوابة — لا نصوص هنا.
 */
const STATUS_CLASSES: Record<string, string> = {
  new: "bg-brand-soft text-brand-strong",
  in_review: "bg-amber-100 text-amber-800",
  awaiting_info: "bg-violet-100 text-violet-800",
  in_progress: "bg-sky-100 text-sky-800",
  responded: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
};

const FALLBACK = "bg-muted text-muted-foreground";

export function StatusBadge({ status, label, className }: { status: string; label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status] ?? FALLBACK} ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
