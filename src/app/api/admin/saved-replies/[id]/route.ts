/**
 * PATCH  /api/admin/saved-replies/[id] — تعديل قالب (مشترك للفريق — لا يشترط الملكية).
 * DELETE /api/admin/saved-replies/[id] — حذف قالب.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "requests.reply");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const target = await db.savedReply.findUnique({ where: { id } });
  if (!target) return json({ ok: false, code: "not_found" }, 404);

  let body: { name?: unknown; content?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const updates: { name?: string; content?: string } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (name.length < 1) return json({ ok: false, code: "invalid" }, 400);
    updates.name = name;
  }
  if (typeof body.content === "string") {
    const content = body.content.trim().slice(0, 2000);
    if (content.length < 1) return json({ ok: false, code: "invalid" }, 400);
    updates.content = content;
  }
  if (!Object.keys(updates).length) return json({ ok: false, code: "invalid" }, 400);

  const updated = await db.savedReply.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, content: true, createdAt: true, updatedAt: true },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.savedReplyUpdated,
    entityType: "saved_reply",
    entityId: id,
    details: { fields: Object.keys(updates) },
    ip,
  });

  return json({ ok: true, reply: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "requests.reply");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const target = await db.savedReply.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!target) return json({ ok: false, code: "not_found" }, 404);

  await db.savedReply.delete({ where: { id } });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.savedReplyDeleted,
    entityType: "saved_reply",
    entityId: id,
    details: { name: target.name },
    ip,
  });

  return json({ ok: true });
}
