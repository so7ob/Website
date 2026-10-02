/**
 * GET /api/account/requests — طلبات المستخدم الحالي (العميل: طلباته؛ الطاقم: المسندة إليه كمشاركة).
 * بحث اختياري `q` (حرفان فأكثر): الرقم المرجعي يحتوي، أو الخدمة/الحالة إن طابقتا قيمة معتمدة.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { REQUEST_STATUSES } from "@/lib/requests-service";

const SERVICE_TYPES = ["web", "mobile", "systems", "ux", "automation", "maintenance", "unsure"];

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const searchActive = q.length >= 2;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  // البحث يطبق فوق ملكية المستخدم دائمًا — لا يمكن أن يوسع النطاق
  const search =
    searchActive
      ? {
          OR: [
            { refCode: { contains: q.toUpperCase() } },
            ...(SERVICE_TYPES.includes(q) ? [{ serviceType: q }] : []),
            ...(REQUEST_STATUSES.includes(q as never) ? [{ status: q }] : []),
          ],
        }
      : {};

  const where =
    user.roleKey === "client"
      ? { clientId: user.id, ...(status ? { status } : {}), ...search }
      : { assigneeId: user.id, ...(status ? { status } : {}), ...search };

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
