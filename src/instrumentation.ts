/**
 * instrumentation — خطاف بدء تشغيل خادم Next.js.
 *
 * يُشغّل منفّذ جدولة النشر كل دقيقة (بعد تشغيلة أولى بعد 15 ثانية).
 * الحمايات:
 * - يعمل في runtime المنطقة (nodejs) فقط — لا مؤقتات في edge.
 * - قفل عام على globalThis يمنع تكرار المؤقت عند إعادة التحميل الساخن في التطوير.
 * - كل دورة تُبتلع أخطاؤها وتُسجل — عطل الجدولة لا يسقط الخادم.
 */
export async function register(): Promise<void> {
  console.log("[instrumentation] register called — runtime:", process.env.NEXT_RUNTIME);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as typeof globalThis & {
    __so7obSchedulerTimer?: ReturnType<typeof setInterval>;
    __so7obSchedulerBooted?: boolean;
  };
  if (g.__so7obSchedulerBooted) return;
  g.__so7obSchedulerBooted = true;

  const { runScheduledPublishes } = await import("@/lib/pages/schedule");

  const tick = async () => {
    try {
      const result = await runScheduledPublishes();
      if (result.published > 0 || result.skipped > 0) {
        console.log(`[scheduler] published=${result.published} skipped=${result.skipped}`);
      }
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    }
  };

  // تشغيلة أولى بعد 15 ثانية من الإقلاع (اترك الخادم يستقر)، ثم كل دقيقة
  setTimeout(() => void tick(), 15_000);
  g.__so7obSchedulerTimer = setInterval(() => void tick(), 60_000);
}
