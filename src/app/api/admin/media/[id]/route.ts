/**
 * PATCH  /api/admin/media/[id] — تعديل النص البديل.
 * DELETE /api/admin/media/[id] — حذف (مع حذف الملف).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { deleteStoredFile } from "@/lib/file-storage";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "media.manage");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: { altText?: unknown; title?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const updates: Record<string, string | null> = {};
  if (typeof body.altText === "string") updates.altText = body.altText.slice(0, 300) || null;
  if (typeof body.title === "string") updates.title = body.title.slice(0, 200) || null;
  if (!Object.keys(updates).length) return json({ ok: false, code: "invalid" }, 400);

  const updated = await db.mediaItem.update({ where: { id }, data: updates, select: { id: true, altText: true, title: true } });
  return json({ ok: true, media: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "media.manage");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item) return json({ ok: false, code: "not_found" }, 404);

  await db.mediaItem.delete({ where: { id } });
  deleteStoredFile(item.storedName);

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.mediaDeleted,
    entityType: "media", entityId: id, details: { filename: item.filename },
  });
  return json({ ok: true });
}
