/**
 * جدولة النشر — قرار خالص قابل للاختبار + منفّذ دوري.
 *
 * القواعد (توافقًا مع §2 سلامة النشر):
 * - الجدولة ترتبط بمراجعة مسودة محددة (scheduledRevision) لا بمحتوى «مستقبلي».
 * - عند الموعد: إذا بقيت المسودة على المراجعة المجدولة نفسها نُشرت؛ وإلا يُلغى
 *   النشر تلقائيًا (schedule_skipped) ويُشعر صاحب الجدولة — لا يُنشر أبدًا شيء
 *   لم يوافق عليه صاحب القرار.
 * - الصفحات المؤرشفة لا تُنشر؛ جدولتها تُسقط بصمت موثق.
 * - كل عملية (نجاح/إسقاط) تُدوَّن في سجل التدقيق ولا تتضمن أي أسرار.
 */
import { db } from "@/lib/db";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify, notifyMany } from "@/lib/auth/notifications";
import { publishPageCore, type PublishLocale, type PublishLocales } from "@/lib/pages/publish-core";

/** أدنى مهلة بين الجدولة والموعد — يمنع «الجدولة في الماضي» ومنع سباق خاطف */
export const MIN_SCHEDULE_LEAD_MS = 30_000;
/** أقصى أفق زمني للجدولة (سنتان) — حاجز ضد قيم شاذة */
export const MAX_SCHEDULE_HORIZON_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export type ScheduleParseResult =
  | { ok: true; date: Date }
  | { ok: false; code: "invalid_time" | "past_time" | "far_future" };

/**
 * تحقق خالص من مدخل الجدولة: سلسلة ISO صالحة ضمن المهلة والأفق.
 * `now` يمرر صراحة ليبقى الاختبار حتميًا.
 */
export function parseScheduleInput(input: unknown, now: Date): ScheduleParseResult {
  if (typeof input !== "string" || input.trim() === "") return { ok: false, code: "invalid_time" };
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return { ok: false, code: "invalid_time" };
  if (d.getTime() < now.getTime() + MIN_SCHEDULE_LEAD_MS) return { ok: false, code: "past_time" };
  if (d.getTime() > now.getTime() + MAX_SCHEDULE_HORIZON_MS) return { ok: false, code: "far_future" };
  return { ok: true, date: d };
}

export type ScheduleDecision =
  | { action: "publish" }
  | { action: "skip"; reason: "revision_conflict" | "archived" | "invalid_state" };

/**
 * قرار خالص لصفحة وصل موعدها: هل نُشر أم نُسقط؟
 * (لا تلمس قاعدة البيانات — حتمية وقابلة للاختبار بمعزول)
 */
export function decideScheduledPublish(
  page: {
    status: string;
    draftRevision: number;
    scheduledRevision: number | null;
  },
  now: Date,
  dueAt: Date
): ScheduleDecision {
  if (page.status === "archived") return { action: "skip", reason: "archived" };
  if (page.scheduledRevision === null) return { action: "skip", reason: "invalid_state" };
  if (page.scheduledRevision !== page.draftRevision) return { action: "skip", reason: "revision_conflict" };
  if (dueAt.getTime() > now.getTime()) return { action: "skip", reason: "invalid_state" };
  return { action: "publish" };
}

/** صفحة وصل موعدها وفق الحقول الثلاثة — قيد الاستعلام الدوري */
function isDue(where: { scheduledPublishAt: Date | null }, now: Date): boolean {
  return where.scheduledPublishAt !== null && where.scheduledPublishAt.getTime() <= now.getTime();
}

/**
 * الدورة الدورية: تجد الصفحات المستحقة وتنفذ قرار كل واحدة.
 * تُستدعى من instrumentation كل دقيقة — آمنة للاستدعاء المتزامن (قفل في الذاكرة).
 */
let running = false;
export async function runScheduledPublishes(now: Date = new Date()): Promise<{
  published: number;
  skipped: number;
}> {
  if (running) return { published: 0, skipped: 0 };
  running = true;
  try {
    const due = await db.page.findMany({
      where: { scheduledPublishAt: { lte: now } },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        status: true,
        draftRevision: true,
        scheduledRevision: true,
        scheduledPublishAt: true,
        scheduledPublishById: true,
      },
    });

    let published = 0;
    let skipped = 0;

    /** أسقط حقول الجدولة — حماية من إعادة التنفيذ المزدوجة في الدورة التالية */
    const clearSchedule = (pageId: string) =>
      db.page.update({
        where: { id: pageId },
        data: { scheduledPublishAt: null, scheduledRevision: null, scheduledPublishById: null },
      });

    for (const page of due) {
      if (!isDue(page, now)) continue;
      try {
        const decision = decideScheduledPublish(page, now, page.scheduledPublishAt as Date);

        if (decision.action === "publish") {
          // الفاعل الحقيقي: صاحب الجدولة — جلسته قد تكون انتهت لكن قراره محفوظ ومُنسب إليه
          const scheduler = page.scheduledPublishById
            ? await db.user.findUnique({ where: { id: page.scheduledPublishById }, select: { id: true, email: true, status: true } })
            : null;
          if (!scheduler || scheduler.status !== "active") {
            await clearSchedule(page.id);
            skipped += 1;
            continue;
          }

          const locales: PublishLocales = ["ar", "en"];
          const result = await publishPageCore({ pageId: page.id, locales, actor: { id: scheduler.id, email: scheduler.email }, via: "scheduled" });
          if (result.ok) {
            published += 1;
            // تأكيد صاحب الجدولة — النشر حدث آليًا بعد موعده لا بتفاعل مباشر منه
            const recipient = await db.user.findUnique({
              where: { id: scheduler.id },
              select: { id: true, locale: true },
            });
            if (recipient) {
              await notify({
                userId: recipient.id,
                type: "content_schedule",
                payload: {
                  ref: page.slug || "home",
                  name: recipient.locale === "en" ? "Scheduled publish executed" : "نُفّذ النشر المجدول",
                  event: "schedule_published",
                },
                link: `/${recipient.locale === "en" ? "en" : "ar"}/admin/pages`,
              });
            }
          } else {
            skipped += 1;
            // فشل النشر نفسه (تحقق/تعارض داخلي) — يُدوّن كإسقاط ليبقى مسار الجدولة شفافًا
            await audit({
              actorId: scheduler.id, actorEmail: scheduler.email, action: AUDIT_ACTIONS.pageScheduleSkipped,
              entityType: "page", entityId: page.id,
              details: { slug: page.slug, reason: "publish_failed", code: result.code },
            });
          }
        } else {
          skipped += 1;
          // الإسقاط يُدوّن ويُشعر صاحب الجدولة — شفافية كاملة لا صمت
          const reason = decision.reason;
          await audit({
            actorId: page.scheduledPublishById ?? null,
            actorEmail: null,
            action: AUDIT_ACTIONS.pageScheduleSkipped,
            entityType: "page",
            entityId: page.id,
            details: { slug: page.slug, reason, scheduledRevision: page.scheduledRevision, draftRevision: page.draftRevision },
          });
          if (page.scheduledPublishById && reason === "revision_conflict") {
            const recipient = await db.user.findUnique({
              where: { id: page.scheduledPublishById },
              select: { id: true, locale: true },
            });
            if (recipient) {
              await notify({
                userId: recipient.id,
                type: "content_schedule",
                payload: {
                  ref: page.slug || "home",
                  name: recipient.locale === "en" ? "Scheduled publish skipped — draft changed" : "أُسقط النشر المجدول — تغيّرت المسودة",
                  event: "schedule_skipped",
                  reason,
                },
                link: `/${recipient.locale === "en" ? "en" : "ar"}/admin/pages`,
              });
            }
          }
        }

        // تُسقَط الجدولة في كل الحالات (نُشرت أو أُسقطت) — لا إعادة تنفيذ مزدوجة.
        // نقرأ الحالة الأخيرة حتى لا نمسح جدولة أعيد ضبطها في سباق ضيق جدًا.
        const finalState = await db.page.findUnique({
          where: { id: page.id },
          select: { scheduledPublishAt: true, scheduledRevision: true, scheduledPublishById: true },
        });
        if (
          finalState?.scheduledPublishAt !== null &&
          finalState?.scheduledRevision === page.scheduledRevision
        ) {
          await clearSchedule(page.id);
        }
      } catch (err) {
        // عطل غير متوقع في صفحة واحدة لا يوقف بقية الدورة — ونُسقط جدولتها
        // لتجنب إعادة تنفيذ مزدوجة، والتدقيق يوثق الحادثة.
        skipped += 1;
        console.error(`[scheduler] page ${page.id} (${page.slug}) failed:`, err);
        try {
          await clearSchedule(page.id);
          await audit({
            actorId: page.scheduledPublishById ?? null, actorEmail: null,
            action: AUDIT_ACTIONS.pageScheduleSkipped,
            entityType: "page", entityId: page.id,
            details: { slug: page.slug, reason: "scheduler_error" },
          });
        } catch (cleanupErr) {
          console.error(`[scheduler] cleanup failed for ${page.id}:`, cleanupErr);
        }
      }
    }

    return { published, skipped };
  } finally {
    running = false;
  }
}

/** تحقق صلاحية الناشر وقت الجدولة — مساعد للـAPI */
export async function activePublisher(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  return u?.status === "active";
}

export type { PublishLocale };
