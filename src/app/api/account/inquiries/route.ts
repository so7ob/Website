/**
 * GET  /api/account/inquiries — استفسارات المستخدم الحالي (العميل: استفساراته؛ الطاقم: المسندة إليه).
 * بحث اختياري `q` (حرفان فأكثر): الرقم المرجعي أو الموضوع، وتصفية حالة اختيارية
 * (حالة معتمدة أو `open` المركّبة = غير المغلق)، مع ترقيم صفحات 20 صفًا.
 * POST /api/account/inquiries — استفسار جديد من بوابة العميل: تحقق مطابق للاستقبال
 * العام، وحد معدل بمفتاح المستخدم، ورقم مرجعي، وإشعار الطاقم.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notifyMany, staffToNotifyForRequests } from "@/lib/auth/notifications";

const INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded", "closed"];
// «open» مرشّح مركّب: كل الحالات غير المغلقة (نفس دلالات لوحة الإدارة)
const OPEN_INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded"];

const CATEGORIES = ["general", "services", "pricing", "support", "other"];

const rateStore = memoryStore();

/** رقم مرجعي للاستفسار — نفس مولّد الاستقبال العام (طابع زمني + عشوائي) */
function refCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `IQ-${stamp}${rand}`;
}

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

  // نطاق الملكية — العميل: استفساراته؛ الطاقم: المسندة إليه (متماثل لمسار الطلبات)
  const ownership = user.roleKey === "client" ? { clientId: user.id } : { assigneeId: user.id };

  // البحث يطبق فوق ملكية المستخدم دائمًا — لا يمكن أن يوسع النطاق
  // (contains عادي كما في مسار الطلبات: الرقم المرجعي ب uppercase والموضوع كما هو)
  const search = searchActive
    ? { OR: [{ refCode: { contains: q.toUpperCase() } }, { subject: { contains: q } }] }
    : {};

  // status=open → مرشّح مركّب (غير المغلق)؛ وإلا حالة معتمدة واحدة؛ وما سواها بلا تصفية
  const where = {
    ...ownership,
    archivedAt: null,
    ...(status === "open"
      ? { status: { in: OPEN_INQUIRY_STATUSES } }
      : status && INQUIRY_STATUSES.includes(status)
        ? { status }
        : {}),
    ...search,
  };

  const [total, rows] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        refCode: true,
        subject: true,
        category: true,
        status: true,
        locale: true,
        createdAt: true,
        lastActivityAt: true,
        closedAt: true,
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
    inquiries: rows.map((r) => ({
      ...r,
      messageCount: r._count.messages,
      assigneeName: r.assignee?.name ?? null,
      _count: undefined,
      assignee: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  // نفس تحقق الاستقبال العام — الاسم والبريد من الجلسة حصرًا لا من الطلب
  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "general";
  const locale = body.locale === "en" ? "en" : "ar";

  const errors: Record<string, string> = {};
  if (subject.length < 3) errors.subject = "required";
  if (message.length < 10) errors.message = "required";
  if (Object.keys(errors).length) return json({ ok: false, code: "invalid", errors }, 400);

  // حد المعدل بمفتاح المستخدم — نفس نوافذ الاستقبال العام (3 خلال 10 دقائق، 8 يوميًا)
  const limit = checkRateLimit(rateStore, `account-inquiry:${user.id}`, Date.now(), {
    shortMax: 3,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 8,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) return json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429);

  const code = refCode();
  const inquiry = await db.inquiry.create({
    data: {
      refCode: code,
      subject,
      status: "new",
      category,
      locale,
      name: user.name,
      email: user.email,
      clientId: user.id,
      messages: {
        create: { authorId: user.id, authorType: "client", kind: "message", body: message },
      },
    },
  });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.inquirySubmitted,
    entityType: "inquiry",
    entityId: inquiry.id,
    details: { ref: code, via: "portal" },
  });

  // إشعار الطاقم — النوع new_inquiry والرابط بلغة الاستفسار
  const staff = await staffToNotifyForRequests();
  await notifyMany(staff.map((s) => ({ userId: s.id, type: "new_inquiry" as const, payload: { ref: code, subject }, link: `/${locale}/admin/inquiries` })));

  return json({ ok: true, ref: code, id: inquiry.id }, 201);
}
