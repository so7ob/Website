"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";

/**
 * تسجيل الخروج: يبطل الجلسة ويصفر مسودة النموذج المحلية —
 * يمنع انتقال مسودة حساب إلى آخر على المتصفحات المشتركة.
 */
export function LogoutAction({ locale, label }: { locale: Locale; label: string }) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    try {
      localStorage.removeItem("so7ob-request-draft");
    } catch {
      /* التخزين غير متاح */
    }
    void signOut({ callbackUrl: `/${locale}` });
  }, [locale]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-white p-10 text-center shadow-sm" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
