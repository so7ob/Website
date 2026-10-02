/**
 * GET   /api/account/drafts — مسودة طلب المستخدم (خادمية، مرتبطة بالحساب).
 * PUT   /api/account/drafts — حفظ المسودة.
 * DELETE /api/account/drafts — مسح المسودة بعد الإرسال.
 * تحل محل LocalStorage للحسابات المسجلة — لا تنتقل بين حسابين.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateProjectRequest } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const draft = await db.requestDraft.findUnique({ where: { userId: guard.user.id } });
  if (!draft) return json({ ok: true, draft: null });
  try {
    return json({ ok: true, draft: JSON.parse(draft.data), updatedAt: draft.updatedAt });
  } catch {
    return json({ ok: true, draft: null });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }
  // نحفظ الحقول الخام للنموذج فقط — لا أي شيء آخر
  const allowed = [
    "requestType", "serviceType", "description", "budget", "currency", "timeline",
    "name", "company", "phone", "preferredContact", "referenceUrl", "locale",
  ];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) clean[key] = typeof body[key] === "string" ? String(body[key]).slice(0, 5000) : body[key];
  }
  // نتحقق من صحة تقريبية عبر مدقق النموذج المشترك (يفشل المسودات الناقصة؟ لا — مسودة)
  const payload = JSON.stringify(clean).slice(0, 20000);

  await db.requestDraft.upsert({
    where: { userId: guard.user.id },
    create: { userId: guard.user.id, data: payload },
    update: { data: payload },
  });
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  await db.requestDraft.deleteMany({ where: { userId: guard.user.id } });
  return json({ ok: true });
}
