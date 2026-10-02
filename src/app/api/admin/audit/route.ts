/**
 * GET /api/admin/audit — سجل التدقيق بتصفية وصفحات.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "audit.view");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const entityType = url.searchParams.get("entity") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 30;

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(query ? { OR: [{ action: { contains: query } }, { actorEmail: { contains: query } }, { entityId: { contains: query } }] } : {}),
  };

  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    logs: rows.map((l) => ({
      id: l.id,
      actor: l.actor?.name ?? l.actorEmail ?? "—",
      actorEmail: l.actor?.email ?? l.actorEmail,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: safeParse(l.details),
      createdAt: l.createdAt,
    })),
  });
}

function safeParse(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
