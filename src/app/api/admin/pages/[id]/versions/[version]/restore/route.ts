/**
 * POST /api/admin/pages/[id]/versions/[version]/restore — استعادة إصدار سابق إلى المسودة.
 * لا ينشر تلقائيًا: الاستعادة تجلب الإصدار مسودةً ثم القرار للمحرر (النشر بصلاحية مستقلة).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { validateBlocks } from "@/lib/blocks/types";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const guard = await guardApi(req, "pages.restore");
  if (!guard.ok) return guard.response;
  const { id, version: versionParam } = await params;
  const version = Number(versionParam);
  if (!Number.isInteger(version) || version < 1) return json({ ok: false, code: "invalid" }, 400);

  const page = await db.page.findUnique({ where: { id } });
  if (!page) return json({ ok: false, code: "not_found" }, 404);

  // استعادة كلتا اللغتين من الإصدارين المتطابقين رقميًا
  const [versionAr, versionEn] = await Promise.all([
    db.pageVersion.findFirst({ where: { pageId: id, locale: "ar", version }, orderBy: { createdAt: "desc" } }),
    db.pageVersion.findFirst({ where: { pageId: id, locale: "en", version }, orderBy: { createdAt: "desc" } }),
  ]);

  const blocksAr = versionAr?.blocks ?? page.draftBlocksAr;
  const blocksEn = versionEn?.blocks ?? page.draftBlocksEn;

  for (const blocks of [blocksAr, blocksEn]) {
    const check = validateBlocks(blocks);
    if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);
  }

  await db.page.update({
    where: { id },
    data: {
      draftBlocksAr: blocksAr,
      draftBlocksEn: blocksEn,
      draftUpdatedAt: new Date(),
      draftUpdatedById: guard.user.id,
      editorTouchedAt: new Date(),
    },
  });

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageRestored,
    entityType: "page", entityId: id, details: { version, slug: page.slug },
  });

  return json({ ok: true, restoredVersion: version });
}
