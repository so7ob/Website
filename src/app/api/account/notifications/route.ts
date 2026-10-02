/**
 * GET  /api/account/notifications — إشعارات المستخدم.
 * POST /api/account/notifications — تعليم مقروء {id} أو {all:true}.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const where = { userId: guard.user.id, ...(unreadOnly ? { readAt: null } : {}) };
  const [total, unread, rows] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId: guard.user.id, readAt: null } }),
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return json({
    ok: true,
    total,
    unread,
    page,
    pageSize,
    notifications: rows.map((n) => {
      let payload: Record<string, string> = {};
      try {
        payload = JSON.parse(n.payload);
      } catch {
        payload = {};
      }
      return { id: n.id, type: n.type, payload, link: n.link, readAt: n.readAt, createdAt: n.createdAt };
    }),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;

  let body: { id?: unknown; all?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  if (body.all === true) {
    await db.notification.updateMany({
      where: { userId: guard.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return json({ ok: true });
  }

  const id = String(body.id ?? "");
  if (!id) return json({ ok: false, code: "invalid" }, 400);
  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== guard.user.id) return json({ ok: false, code: "not_found" }, 404);
  await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return json({ ok: true });
}
