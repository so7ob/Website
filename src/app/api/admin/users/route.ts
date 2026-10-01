/**
 * GET  /api/admin/users — قائمة المستخدمين: بحث وتصفية وترتيب وصفحات.
 * POST /api/admin/users — دعوة مستخدم (بريد + دور) برابط أحادي الاستخدام.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { ROLE_KEYS } from "@/lib/auth/permissions";
import { sendMail, absoluteUrl, emailDevMode } from "@/lib/auth/email";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

const rateStore = memoryStore();

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "users.view");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const role = url.searchParams.get("role") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 20;

  const where = {
    ...(query ? { OR: [{ name: { contains: query } }, { email: { contains: query } }] } : {}),
    ...(role && ROLE_KEYS.includes(role) ? { roleKey: role } : {}),
    ...(status ? { status } : {}),
  };

  const validSorts = ["createdAt", "lastLoginAt", "name", "email", "roleKey"];
  const orderBy = validSorts.includes(sort) ? { [sort]: dir } : { createdAt: "desc" };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: orderBy as never,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        roleKey: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { clientRequests: true, assignedRequests: true } },
      },
    }),
  ]);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      company: u.company,
      roleKey: u.roleKey,
      status: u.status,
      emailVerified: Boolean(u.emailVerifiedAt),
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      requestsCount: u._count.clientRequests,
      assignedCount: u._count.assignedRequests,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, "users.create");
  if (!guard.ok) return guard.response;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(rateStore, `invite:${guard.user.id}`, Date.now(), {
    shortMax: 5,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 20,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) return json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429);

  let body: { email?: unknown; roleKey?: unknown; name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const roleKey = String(body.roleKey ?? "client");
  const name = String(body.name ?? "").trim().slice(0, 100) || email.split("@")[0];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, code: "invalid" }, 400);
  if (!ROLE_KEYS.includes(roleKey)) return json({ ok: false, code: "invalid" }, 400);
  // دعوة الأدوار الإدارية الحساسة تتطلب صلاحية الأدوار
  if (roleKey !== "client" && !(guard.user.roleKey === "super_admin" || guard.user.permissions.includes("users.roles"))) {
    return json({ ok: false, code: "forbidden" }, 403);
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return json({ ok: false, code: "email_taken" }, 409);

  const pendingInvite = await db.userInvite.findFirst({
    where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pendingInvite) return json({ ok: false, code: "invite_pending" }, 409);

  // رمز دعوة أحادي الاستخدام صالح 7 أيام
  const { randomBytes, createHash } = await import("crypto");
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.userInvite.create({
    data: { email, roleKey, tokenHash, invitedById: guard.user.id, expiresAt },
  });

  const locale = guard.user.locale === "en" ? "en" : "ar";
  const acceptUrl = absoluteUrl(`/${locale}/auth/invite?token=${rawToken}`);
  const subject =
    locale === "en" ? `You are invited to so7ob — ${roleKey} account` : `دعوة إلى سُحُب التقنية — حساب ${roleKey}`;
  const text =
    locale === "en"
      ? `You were invited to join so7ob with the role "${roleKey}".\n\nAccept and set your password via this link (valid 7 days, single use):\n${acceptUrl}\n\nIf you were not expecting this, ignore this email.`
      : `دُعيت للانضمام إلى سُحُب التقنية بدور «${roleKey}».\n\nاقبل الدعوة واضبط كلمة المرور عبر الرابط (صالح 7 أيام، يعمل مرة واحدة):\n${acceptUrl}\n\nإن لم تكن تتوقعها فتجاهل الرسالة.`;
  const mailResult = await sendMail({ to: email, subject, text });

  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.userInvited,
    entityType: "user_invite",
    entityId: email,
    details: { roleKey, emailStatus: mailResult.status },
    ip,
  });

  return json({ ok: true, emailStatus: mailResult.status, ...(emailDevMode() ? { devInviteUrl: acceptUrl } : {}) }, 201);
}
