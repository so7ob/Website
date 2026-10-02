/**
 * GET  /api/admin/saved-replies — قوالب الردود المحفوظة (يتشاركها الطاقم).
 * POST /api/admin/saved-replies — إنشاء قالب جديد.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "requests.view.all");
  if (!guard.ok) return guard.response;

  const rows = await db.savedReply.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      content: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      creator: { select: { id: true, name: true } },
    },
  });

  return json({
    ok: true,
    replies: rows.map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      createdBy: r.createdBy,
      creatorName: r.creator?.name ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, "requests.reply");
  if (!guard.ok) return guard.response;

  let body: { name?: unknown; content?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const name = String(body.name ?? "").trim().slice(0, 80);
  const content = String(body.content ?? "").trim().slice(0, 2000);
  if (name.length < 1 || content.length < 1) return json({ ok: false, code: "invalid" }, 400);

  const created = await db.savedReply.create({
    data: { name, content, createdBy: guard.user.id },
    select: { id: true, name: true, content: true, createdAt: true, updatedAt: true },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.savedReplyCreated,
    entityType: "saved_reply",
    entityId: created.id,
    details: { name },
    ip,
  });

  return json({ ok: true, reply: created }, 201);
}
