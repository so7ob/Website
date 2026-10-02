/**
 * GET /api/account/requests — طلبات المستخدم الحالي (العميل: طلباته؛ الطاقم: المسندة إليه كمشاركة).
 * بحث اختياري `q` (حرفان فأكثر): الرقم المرجعي يحتوي، أو الخدمة/الحالة إن طابقتا قيمة معتمدة.
 * عرض «بانتظار ردك» الحصري عبر `awaiting=you`: الطلبات التي ردّ الطاقم على آخر رسالة فيها
 * (العميل: بانتظار ردّه؛ الطاقم: طلباته المسندة بانتظار ردّ العميل) — يلغي تصفية الحالة.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { REQUEST_STATUSES } from "@/lib/requests-service";

const SERVICE_TYPES = ["web", "mobile", "systems", "ux", "automation", "maintenance", "unsure"];

/** Prisma لا يقارن عمودين في المرشِّح (lastStaffReplyAt > lastClientReplyAt)، فنجلب
 *  طلبات المستخدم غير المؤرشفة بعمودَي آخر ردٍّ فقط ثم نطابق المنطق الدقيق في
 *  الذاكرة — نفس دلالات مؤشر «بانتظار ردك» في لوحة الحساب، وبنمط findOverdueRequestIds
 *  في مسار الإدارة (مجموعة المستخدم صغيرة فالتكلفة مهملة). مجموعة فارغة تعني
 *  صفر نتائج طبيعيًا. */
async function findAwaitingClientReplyIds(
  scope: { clientId: string } | { assigneeId: string }
): Promise<string[]> {
  const candidates = await db.projectRequest.findMany({
    where: { ...scope, archivedAt: null },
    select: { id: true, lastClientReplyAt: true, lastStaffReplyAt: true },
  });
  const ids: string[] = [];
  for (const c of candidates) {
    if (
      c.lastStaffReplyAt !== null &&
      (c.lastClientReplyAt === null || c.lastStaffReplyAt > c.lastClientReplyAt)
    ) {
      ids.push(c.id);
    }
  }
  return ids;
}

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const searchActive = q.length >= 2;
  const awaiting = url.searchParams.get("awaiting") === "you";
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

  // نطاق الملكية — العميل: طلباته؛ الطاقم: المسندة إليه (العرض الخاص متماثل للطرفين)
  const ownership = user.roleKey === "client" ? { clientId: user.id } : { assigneeId: user.id };

  // تصفية «بانتظار ردك» الدقيقة — تجمع مع البحث فوق ملكية المستخدم دائمًا
  const awaitingIds = awaiting ? await findAwaitingClientReplyIds(ownership) : [];

  // awaiting=you عرضٌ حصري: إن وُجد مع status فالأولى تفوز — «ردّ الطاقم أخيرًا»
  // شرطٌ زمني وليس حالة طلب، فلا معنى لتقاطعهما
  const where = {
    ...ownership,
    ...(awaiting || !status ? {} : { status }),
    ...(awaiting ? { id: { in: awaitingIds } } : {}),
    ...search,
  };

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
