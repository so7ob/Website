/**
 * POST /api/admin/pages/[id]/schedule — جدولة نشر المسودة في موعد لاحق.
 *
 * قواعد السلامة (توافقًا مع §2):
 * - الصلاحية pages.publish (الجدولة قرار نشر لا تعديل).
 * - baseRevision إلزامي ومطابق — الجدولة ترتبط بمراجعة مسودة محفوظة محددة؛
 *   إذا تغيرت المسودة بين الجدولة وطلب الجدولة نفسه يُرفض (409).
 * - الموعد مستقبلًا (مهلة 30 ثانية على الأقل) وبأفق أقصى سنتان.
 * - publishAt=null يُلغي جدولة قائمة — لا يؤثر على أي شيء آخر.
 * - الصفحات المؤرشفة لا تُجدول (409).
 * - كل فعل يُدوَّن في سجل التدقيق: schedule_set / schedule_cancelled.
 *
 * التنفيذ الفعلي في موعده عبر runScheduledPublishes (instrumentation) —
 * يستخدم نواة النشر نفسها فلا مسار نشر ثانٍ.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { parseScheduleInput } from "@/lib/pages/schedule";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.publish");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }

  const page = await db.page.findUnique({
    where: { id },
    select: { id: true, slug: true, status: true, draftRevision: true, scheduledPublishAt: true, scheduledRevision: true },
  });
  if (!page) return json({ ok: false, code: "not_found" }, 404);
  if (page.status === "archived") return json({ ok: false, code: "archived" }, 409);

  // ——— الإلغاء — الإلغاء آمن دائمًا فلا يُربط بمراجعة ———
  if (body.publishAt === null) {
    if (page.scheduledPublishAt === null) return json({ ok: false, code: "nothing_scheduled" }, 409);
    await db.page.update({
      where: { id },
      data: { scheduledPublishAt: null, scheduledRevision: null, scheduledPublishById: null },
    });
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageScheduleCancelled,
      entityType: "page", entityId: id,
      details: { slug: page.slug, cancelledAtRevision: page.draftRevision },
    });
    revalidatePath("/ar/admin/pages");
    return json({ ok: true, scheduledPublishAt: null });
  }

  // ربط الجدولة بمراجعة محفوظة — مثل النشر تمامًا (للجدولة فقط، لا للإلغاء)
  if (typeof body.baseRevision !== "number" || !Number.isInteger(body.baseRevision)) {
    return json({ ok: false, code: "revision_required" }, 409);
  }
  if (body.baseRevision !== page.draftRevision) {
    return json({ ok: false, code: "conflict", serverRevision: page.draftRevision }, 409);
  }

  // ——— الجدولة ———
  const parsed = parseScheduleInput(body.publishAt, new Date());
  if (!parsed.ok) return json({ ok: false, code: parsed.code }, 400);

  await db.page.update({
    where: { id },
    data: {
      scheduledPublishAt: parsed.date,
      scheduledRevision: page.draftRevision,
      scheduledPublishById: guard.user.id,
    },
  });
  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageScheduleSet,
    entityType: "page", entityId: id,
    details: { slug: page.slug, publishAt: parsed.date.toISOString(), revision: page.draftRevision },
  });
  revalidatePath("/ar/admin/pages");

  return json({ ok: true, scheduledPublishAt: parsed.date.toISOString(), scheduledRevision: page.draftRevision });
}
