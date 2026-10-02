/**
 * PATCH  /api/admin/media/[id] — تعديل النص البديل/العنوان/المجلد.
 * DELETE /api/admin/media/[id] — حذف مع حاجز الاستخدام (§7):
 *   وسيلة مستخدمة في منشور أو مسودة أو قالب أو صورة مشاركة لا تُحذف (409)
 *   مع قائمة المواضع حتى يزيلها الأدمن أولًا — لا روابط ميتة ولا صفحات معطلة.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { deleteStoredFile } from "@/lib/file-storage";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { findMediaUsage, normalizeMediaFolder } from "@/lib/media-usage";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "media.manage");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: { altText?: unknown; title?: unknown; folder?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const updates: Record<string, string | null> = {};
  if (typeof body.altText === "string") updates.altText = body.altText.slice(0, 300) || null;
  if (typeof body.title === "string") updates.title = body.title.slice(0, 200) || null;
  if (body.folder !== undefined) {
    const folder = normalizeMediaFolder(body.folder);
    if (folder === null) return json({ ok: false, code: "invalid_folder" }, 400);
    updates.folder = folder;
  }
  if (!Object.keys(updates).length) return json({ ok: false, code: "invalid" }, 400);

  const updated = await db.mediaItem.update({
    where: { id },
    data: updates,
    select: { id: true, altText: true, title: true, folder: true },
  });

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.mediaUpdated,
    entityType: "media", entityId: id, details: updates,
  });

  return json({ ok: true, media: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "media.manage");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item) return json({ ok: false, code: "not_found" }, 404);

  // حاجز الاستخدام — منشور/مسودة/قالب/صورة مشاركة كلها تعيق الحذف
  const usage = await findMediaUsage(id);
  if (usage.length > 0) {
    await audit({
      actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.mediaDeleteBlocked,
      entityType: "media", entityId: id, details: { filename: item.filename, usageCount: usage.length },
    });
    return json({ ok: false, code: "media_in_use", usage }, 409);
  }

  await db.mediaItem.delete({ where: { id } });
  deleteStoredFile(item.storedName);

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.mediaDeleted,
    entityType: "media", entityId: id, details: { filename: item.filename },
  });
  return json({ ok: true });
}
