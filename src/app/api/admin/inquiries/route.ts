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
  const archived = url.searchParams.get("archived") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const where = {
    // عرض «المؤرشف» (archived=1): سجلات مؤرشفة فقط مع بقاء تصفية الحالة
    // فاعلة؛ والعرض الافتراضي: غير المؤرشف دائمًا — مثل قائمة الطلبات، فلا
    // تتسرب المؤرشفة إلى فرع الحالة النوعية أو فرع بلا حالة (كانت تتسرب)،
    // ومرشّح «open» المركّب غير المؤرشف ضمنًا عبر هذا المفتاح العلوي.
    archivedAt: archived ? { not: null } : null,
    // status=open → مرشّح مركّب يطابق مؤشر «الاستفسارات المفتوحة» في اللوحة
    ...(status === "open"
      ? { status: { in: OPEN_INQUIRY_STATUSES } }
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
