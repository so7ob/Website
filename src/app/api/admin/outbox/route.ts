/**
 * GET /api/admin/outbox — صندوق صادر البريد (سجل فعلي للحالة).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "email.outbox");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const [total, rows] = await Promise.all([
    db.emailLog.count(),
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return json({ ok: true, total, page, pageSize, emails: rows });
}
