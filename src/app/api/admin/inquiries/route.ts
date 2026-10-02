/**
 * GET /api/admin/inquiries — قائمة الاستفسارات بتصفية.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

const INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded", "closed"];
// «open» مرشّح مركّب من مؤشر اللوحة: كل الحالات غير المغلقة وغير المؤرشفة
const OPEN_INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded"];

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "inquiries.view.all");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const status = url.searchParams.get("status") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const where = {
    // status=open → مرشّح مركّب يطابق مؤشر «الاستفسارات المفتوحة» في اللوحة
    ...(status === "open"
      ? { status: { in: OPEN_INQUIRY_STATUSES }, archivedAt: null }
      : status && INQUIRY_STATUSES.includes(status)
        ? { status }
        : {}),
    ...(category ? { category } : {}),
    ...(query ? { OR: [{ subject: { contains: query } }, { email: { contains: query } }, { name: { contains: query } }, { refCode: { contains: query.toUpperCase() } }] } : {}),
  };

  const [total, rows] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        assignee: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    inquiries: rows.map((i) => ({
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
    })),
  });
}
