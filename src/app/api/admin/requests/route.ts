/**
 * GET /api/admin/requests — قائمة الطلبات: بحث وتصفية (حالة/خدمة/أولوية/مسؤول) وصفحات.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { REQUEST_STATUSES } from "@/lib/requests-service";

/** الحالات المفتوحة — الردود المتأخرة تخص الطلبات غير المغلبة/الملغاة فقط */
const OVERDUE_OPEN_STATUSES = ["new", "in_review", "awaiting_info", "in_progress", "responded"];

/** إجراء Prisma لا يقارن عمودين في المرشِّح (lastClientReplyAt > lastStaffReplyAt)،
 *  فنحدّد المرشّحين المحتملين (مفتوحة، غير مؤرشفة، آخر كلام للعميل قبل 24 ساعة+
 *  أو لا ردود إطلاقًا) ثم نطابق المنطق الدقيق في الذاكرة — نفس دلالات مؤشر اللوحة. */
async function findOverdueRequestIds(): Promise<string[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidates = await db.projectRequest.findMany({
    where: {
      status: { in: OVERDUE_OPEN_STATUSES },
      archivedAt: null,
      OR: [
        { lastClientReplyAt: { not: null, lt: cutoff } },
        { lastClientReplyAt: null, lastStaffReplyAt: null, createdAt: { lt: cutoff } },
      ],
    },
    select: { id: true, lastClientReplyAt: true, lastStaffReplyAt: true },
  });
  const ids: string[] = [];
  for (const c of candidates) {
    const isOverdue =
      c.lastClientReplyAt === null
        ? c.lastStaffReplyAt === null
        : c.lastStaffReplyAt === null || c.lastClientReplyAt > c.lastStaffReplyAt;
    if (isOverdue) ids.push(c.id);
  }
  return ids;
}

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
  const overdue = url.searchParams.get("overdue") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  // تصفية الردود المتأخرة — تجمع مع بقية المرشّحات (حالة/خدمة/أولوية/مسؤول)
  // ومجموعة فارغة تعني صفر نتائج طبيعيًا.
  const overdueIds = overdue ? await findOverdueRequestIds() : [];

  const where = {
    archivedAt: archived ? { not: null } : null,
    ...(overdue ? { id: { in: overdueIds } } : {}),
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

  // ——— بانتظار رد الفريق ———
  // آخر رسالة ظاهرة (kind=message) لكل طلب في الصفحة الحالية، بترتيب تصاعدي
  // فيفوز آخر سجل لكل طلب داخل الخريطة — استعلام واحد للصفحة كاملة.
  const ids = rows.map((r) => r.id);
  const lastMessages = ids.length
    ? await db.requestMessage.findMany({
        where: { requestId: { in: ids }, kind: "message" },
        orderBy: { createdAt: "asc" },
        select: { requestId: true, authorType: true, createdAt: true },
      })
    : [];
  const lastByRequest = new Map<string, { authorType: string; createdAt: Date }>();
  for (const message of lastMessages) lastByRequest.set(message.requestId, message);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    staff,
    requests: rows.map((r) => {
      // بانتظار الطاقم: آخر رسالة ظاهرة من العميل، أو طلب جديد بلا أي رد بعد
      // (الوصف الافتتاحي نفسه تواصل من العميل) — والطلب غير مغلق/ملغى
      const last = lastByRequest.get(r.id) ?? null;
      const awaitingSince =
        r.status !== "closed" && r.status !== "cancelled"
          ? last
            ? last.authorType === "client"
              ? last.createdAt.toISOString()
              : null
            : r.lastStaffReplyAt === null
              ? r.createdAt.toISOString()
              : null
          : null;
      return {
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
        awaitingSince,
        // يحتاج ردًا من الطاقم؟ (آخر رد من العميل أو لا ردود بعد)
        needsStaffReply:
          r.lastStaffReplyAt === null || (r.lastClientReplyAt !== null && r.lastClientReplyAt > r.lastStaffReplyAt),
      };
    }),
  });
}
