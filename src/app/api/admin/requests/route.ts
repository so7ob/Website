/**
 * GET /api/admin/requests — قائمة الطلبات: بحث وتصفية (حالة/خدمة/أولوية/مسؤول) وصفحات.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { REQUEST_STATUSES } from "@/lib/requests-service";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "requests.view.all");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const status = url.searchParams.get("status") ?? "";
  const service = url.searchParams.get("service") ?? "";
  const priority = url.searchParams.get("priority") ?? "";
  const assignee = url.searchParams.get("assignee") ?? "";
  const archived = url.searchParams.get("archived") === "1";
  const from = url.searchParams.get("from") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const where = {
    archivedAt: archived ? { not: null } : null,
    ...(status && REQUEST_STATUSES.includes(status as never) ? { status } : {}),
    ...(service ? { serviceType: service } : {}),
    ...(priority ? { priority } : {}),
    ...(assignee === "none" ? { assigneeId: null } : assignee ? { assigneeId: assignee } : {}),
    ...(from ? { createdAt: { gte: new Date(from) } } : {}),
    ...(query
      ? {
          OR: [
            { refCode: { contains: query.toUpperCase() } },
            { name: { contains: query } },
            { email: { contains: query } },
            { description: { contains: query } },
          ],
        }
      : {}),
  };

  const [total, rows, staff] = await Promise.all([
    db.projectRequest.count({ where }),
    db.projectRequest.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.user.findMany({
      where: { roleKey: { in: ["super_admin", "ops_manager", "support"] }, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    staff,
    requests: rows.map((r) => ({
      id: r.id,
      refCode: r.refCode,
      requestType: r.requestType,
      serviceType: r.serviceType,
      status: r.status,
      priority: r.priority,
      name: r.client?.name ?? r.name,
      email: r.client?.email ?? r.email,
      clientId: r.clientId,
      assigneeId: r.assigneeId,
      assigneeName: r.assignee?.name ?? null,
      messageCount: r._count.messages,
      createdAt: r.createdAt,
      lastActivityAt: r.lastActivityAt,
      lastClientReplyAt: r.lastClientReplyAt,
      lastStaffReplyAt: r.lastStaffReplyAt,
      archivedAt: r.archivedAt,
      // يحتاج ردًا من الطاقم؟ (آخر رد من العميل أو لا ردود بعد)
      needsStaffReply:
        r.lastStaffReplyAt === null || (r.lastClientReplyAt !== null && r.lastClientReplyAt > r.lastStaffReplyAt),
    })),
  });
}
