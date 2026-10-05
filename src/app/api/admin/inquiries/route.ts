/**
 * GET /api/admin/inquiries — قائمة الاستفسارات بتصفية + عدادات محورية (facets).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import {
  buildInquiryWhere,
  archivedCountWhere,
  mineCountWhere,
  groupCountsToMap,
  type InquiryListFilters,
} from "@/lib/admin/inquiries-query";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "inquiries.view.all");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const status = url.searchParams.get("status") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const archived = url.searchParams.get("archived") === "1";
  // «مُعيَّن لي» — يقيّد القائمة بالمسؤول الحالي (العداد يظل متاحًا حتى بلا تفعيل)
  const mine = url.searchParams.get("mine") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const filters: InquiryListFilters = {
    q: query,
    status,
    category,
    archived,
    mineAssigneeId: mine ? guard.user.id : null,
  };

  const [total, rows, statusGroups, categoryGroups, archivedCount, mineCount, allAssignmentsCount] = await Promise.all([
    db.inquiry.count({ where: buildInquiryWhere(filters) }),
    db.inquiry.findMany({
      where: buildInquiryWhere(filters),
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        assignee: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
    // ——— العدادات المحورية ———
    // عدّاد كل حبة حالة = ما ستراه عند نقرها تحت بقية الأبعاد (البحث/التصنيف/الأرشيف/التعيين)
    db.inquiry.groupBy({ by: ["status"], where: buildInquiryWhere(filters, { exclude: "status" }), _count: { _all: true } }),
    db.inquiry.groupBy({ by: ["category"], where: buildInquiryWhere(filters, { exclude: "category" }), _count: { _all: true } }),
    db.inquiry.count({ where: archivedCountWhere(filters) }),
    db.inquiry.count({ where: mineCountWhere(filters, guard.user.id) }),
    db.inquiry.count({ where: buildInquiryWhere(filters, { exclude: "mine" }) }),
  ]);

  const statusCounts = groupCountsToMap(
    statusGroups.map((g) => ({ key: g.status, count: g._count._all }))
  );
  const openCount = Object.entries(statusCounts)
    .filter(([key]) => key !== "closed")
    .reduce((sum, [, n]) => sum + n, 0);

  // ——— بانتظار رد الفريق ———
  // آخر رسالة ظاهرة (kind=message) لكل استفسار في الصفحة الحالية، بترتيب
  // تصاعدي فيفوز آخر سجل لكل استفسار داخل الخريطة — استعلام واحد للصفحة
  // كاملة (نفس دلالات قائمة الطلبات، دون عمود lastStaffReplyAt هنا).
  const ids = rows.map((i) => i.id);
  const lastMessages = ids.length
    ? await db.inquiryMessage.findMany({
        where: { inquiryId: { in: ids }, kind: "message" },
        orderBy: { createdAt: "asc" },
        select: { inquiryId: true, authorType: true, createdAt: true },
      })
    : [];
  const lastByInquiry = new Map<string, { authorType: string; createdAt: Date }>();
  for (const message of lastMessages) lastByInquiry.set(message.inquiryId, message);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    counts: {
      statuses: statusCounts,
      open: openCount,
      categories: groupCountsToMap(categoryGroups.map((g) => ({ key: g.category, count: g._count._all }))),
      archived: archivedCount,
      assignedToMe: mineCount,
      allAssignments: allAssignmentsCount,
    },
    inquiries: rows.map((i) => {
      // بانتظار الطاقم: آخر رسالة ظاهرة من العميل، أو استفسار بلا أي رسائل
      // بعد (الافتتاحية نفسها تواصل من العميل) — والمغلق/المؤرشف بلا شارة.
      // لا عمود lastStaffReplyAt هنا: آخر رسالة من الطاقم تعني «لا انتظار».
      const last = lastByInquiry.get(i.id) ?? null;
      const awaitingSince =
        i.status !== "closed" && i.archivedAt === null
          ? last
            ? last.authorType === "client"
              ? last.createdAt.toISOString()
              : null
            : i.createdAt.toISOString()
          : null;
      return {
        id: i.id,
        refCode: i.refCode,
        subject: i.subject,
        category: i.category,
        status: i.status,
        name: i.name,
        email: i.email,
        clientId: i.clientId,
        assigneeId: i.assigneeId,
        assigneeName: i.assignee?.name ?? null,
        messageCount: i._count.messages,
        createdAt: i.createdAt,
        lastActivityAt: i.lastActivityAt,
        awaitingSince,
      };
    }),
  });
}
