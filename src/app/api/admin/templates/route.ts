/**
 * /api/admin/templates — قوالب الصفحات (§5).
 *
 * GET  — قائمة القوالب (builtin + custom) مع زرع المدمجة آليًا عند أول طلب.
 * POST — إنشاء قالب مخصص من محتوى لغة واحدة (يُخزن ناتج التحقق المطبّع).
 *
 * الصلاحيات: GET يتطلب pages.view؛ POST يتطلب pages.edit. كل الكتابات تُدوَّن.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { ensureBuiltinTemplates, parseCreateTemplateInput, templateListItem } from "@/lib/templates/service";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "pages.view");
  if (!guard.ok) return guard.response;

  await ensureBuiltinTemplates();

  const templates = await db.pageTemplate.findMany({
    orderBy: [{ kind: "asc" }, { updatedAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });

  return json({ ok: true, templates: templates.map(templateListItem) });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const parsed = parseCreateTemplateInput(body);
  if (!parsed.ok) return json({ ok: false, code: parsed.error }, 400);

  const created = await db.pageTemplate.create({
    data: {
      nameAr: parsed.data.nameAr,
      nameEn: parsed.data.nameEn,
      descAr: parsed.data.descAr,
      descEn: parsed.data.descEn,
      kind: "custom",
      blocksAr: parsed.data.blocksAr,
      blocksEn: parsed.data.blocksEn,
      createdById: guard.user.id,
    },
  });

  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.templateCreated,
    entityType: "page_template",
    entityId: created.id,
    details: {
      nameAr: created.nameAr,
      nameEn: created.nameEn,
      locales: [created.blocksAr ? "ar" : null, created.blocksEn ? "en" : null].filter(Boolean),
    },
  });

  return json({ ok: true, template: templateListItem(created) }, 201);
}
