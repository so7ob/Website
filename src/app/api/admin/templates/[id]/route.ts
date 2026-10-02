/**
 * /api/admin/templates/[id] — إدارة قالب مخصص (§D جولة 34).
 *
 * PATCH — إعادة تسمية/تعديل وصف قالب **مخصص** فقط:
 *   المدمجة (builtin) للقراءة (400 builtin_readonly)؛
 *   التحقق عبر parseUpdateTemplateInput (أسماء ≤120، أوصاف ≤400، فارغ الاسمين مرفوض)؛
 *   لا تغيير فعلي → 400 nothing_to_update.
 *
 * DELETE — المدمجة (builtin) غير قابلة للحذف (400 builtin_readonly)؛
 * المخصصة تُحذف نهائيًا مع تدقيق.
 *
 * الصلاحية للحالتين: pages.edit. كل كتابة تُدوَّن في AuditLog (بلا محتوى القوالب).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { parseUpdateTemplateInput, templateListItem } from "@/lib/templates/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: "invalid_json" }, 400);
  }
  if (typeof body !== "object" || body === null) return json({ ok: false, code: "invalid_json" }, 400);

  const template = await db.pageTemplate.findUnique({ where: { id } });
  if (!template) return json({ ok: false, code: "not_found" }, 404);
  if (template.kind === "builtin") return json({ ok: false, code: "builtin_readonly" }, 400);

  const parsed = parseUpdateTemplateInput(
    body as Record<string, unknown>,
    { nameAr: template.nameAr, nameEn: template.nameEn, descAr: template.descAr, descEn: template.descEn }
  );
  if (!parsed.ok) return json({ ok: false, code: parsed.error }, 400);

  const updated = await db.pageTemplate.update({
    where: { id },
    data: {
      nameAr: parsed.data.nameAr,
      nameEn: parsed.data.nameEn,
      descAr: parsed.data.descAr,
      descEn: parsed.data.descEn,
    },
  });

  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.templateUpdated,
    entityType: "page_template",
    entityId: id,
    details: {
      changed: parsed.data.changed,
      nameAr: updated.nameAr,
      nameEn: updated.nameEn,
    },
  });

  return json({ ok: true, template: templateListItem(updated) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const template = await db.pageTemplate.findUnique({ where: { id } });
  if (!template) return json({ ok: false, code: "not_found" }, 404);
  if (template.kind === "builtin") return json({ ok: false, code: "builtin_readonly" }, 400);

  await db.pageTemplate.delete({ where: { id } });
  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.templateDeleted,
    entityType: "page_template",
    entityId: id,
    details: { nameAr: template.nameAr, nameEn: template.nameEn },
  });

  return json({ ok: true });
}
