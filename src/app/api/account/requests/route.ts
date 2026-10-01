/**
 * GET /api/account/requests — طلبات المستخدم الحالي (العميل: طلباته؛ الطاقم: المسندة إليه كمشاركة).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const where =
    user.roleKey === "client"
      ? { clientId: user.id, ...(status ? { status } : {}) }
      : { assigneeId: user.id, ...(status ? { status } : {}) };

  const [total, rows] = await Promise.all([
    db.projectRequest.count({ where }),
    db.projectRequest.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        refCode: true,
        serviceType: true,
        requestType: true,
        status: true,
        priority: true,
        createdAt: true,
        lastActivityAt: true,
        lastClientReplyAt: true,
        lastStaffReplyAt: true,
        archivedAt: true,
        assignee: { select: { name: true } },
        _count: { select: { messages: { where: { kind: "message" } } } },
      },
    }),
  ]);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    requests: rows.map((r) => ({
      ...r,
      messageCount: r._count.messages,
      awaitingClientReply: r.lastStaffReplyAt !== null && (r.lastClientReplyAt === null || r.lastStaffReplyAt > r.lastClientReplyAt),
      _count: undefined,
    })),
  });
}
