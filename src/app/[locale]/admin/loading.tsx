/** هيكل تحميل موحد لمقاطع لوحة الإدارة */
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="animate-shimmer h-7 w-48" />
        <Skeleton className="animate-shimmer h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="animate-shimmer h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="animate-shimmer h-72 rounded-2xl" />
        <Skeleton className="animate-shimmer h-72 rounded-2xl" />
      </div>
    </div>
  );
}
