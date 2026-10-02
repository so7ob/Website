/**
 * GET   /api/admin/users/[id] — ملف موسّع للمستخدم: بيانات آمنة + إحصاءات + آخر الطلبات + الجلسات + التدقيق.
 * PATCH /api/admin/users/[id] — تعديل المستخدم: بياناته/دوره/حالته (وفق الصلاحيات).
 * حماية صريحة: لا إيقاف أو تخفيض آخر مدير نظام نشط.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "users.view");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      locale: true,
      roleKey: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      // لا يُعاد أبدًا: passwordHash أو أي بصمة/رمز جلسة
      authSessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
        select: { createdAt: true, lastSeenAt: true, userAgent: true, ipHash: true },
      },
    },
  });
  if (!user) return json({ ok: false, code: "not_found" }, 404);

  const openWhere = { clientId: id, status: { notIn: ["closed", "cancelled"] } };
  const [totalRequests, openRequests, requests, auditLogs, suspendedEvent] = await Promise.all([
    db.projectRequest.count({ where: { clientId: id } }),
    db.projectRequest.count({ where: openWhere }),
    db.projectRequest.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        refCode: true,
        status: true,
        serviceType: true,
        createdAt: true,
        lastActivityAt: true,
        assignee: { select: { name: true } },
      },
    }),
    db.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, entityType: true, entityId: true, createdAt: true },
    }),
    // تاريخ آخر إيقاف — من سجل التدقيق (لا يوجد حقل مخصص في المخطط)
    db.auditLog.findFirst({
      where: { action: AUDIT_ACTIONS.userSuspended, entityType: "user", entityId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const sessions = user.authSessions;
  const lastSeen =
    sessions.length > 0 ? sessions.reduce((acc, s) => (s.lastSeenAt > acc ? s.lastSeenAt : acc), sessions[0].lastSeenAt) : null;

  return json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      company: user.company,
      locale: user.locale,
      roleKey: user.roleKey,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      suspendedAt: suspendedEvent?.createdAt ?? null,
      lastSeen: lastSeen ?? user.lastLoginAt,
    },
    stats: { totalRequests, openRequests },
    requests: requests.map((r) => ({
      id: r.id,
      refCode: r.refCode,
      status: r.status,
      serviceType: r.serviceType,
      createdAt: r.createdAt,
      lastActivityAt: r.lastActivityAt,
      assigneeName: r.assignee?.name ?? null,
    })),
    sessions: {
      activeCount: sessions.length,
      last5: sessions.slice(0, 5),
    },
    auditLog: auditLogs,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "users.update");
  if (!guard.ok) return guard.response;
  const { user: actor } = guard;
  const { id } = await params;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return json({ ok: false, code: "not_found" }, 404);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const updates: Record<string, unknown> = {};
  const auditDetails: Record<string, unknown> = {};

  // تعديل البيانات الأساسية
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 100);
    if (name.length >= 2) updates.name = name;
  }
  if (typeof body.phone === "string") updates.phone = body.phone.trim().slice(0, 20) || null;
  if (typeof body.company === "string") updates.company = body.company.trim().slice(0, 120) || null;

  // تغيير الدور — صلاحية مستقلة
  if (typeof body.roleKey === "string" && body.roleKey !== target.roleKey) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("users.roles"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const role = await db.role.findUnique({ where: { key: body.roleKey } });
    if (!role) return json({ ok: false, code: "invalid" }, 400);

    // حماية آخر مدير نظام نشط: لا تخفيض دوره
    if (target.roleKey === "super_admin" && role.key !== "super_admin") {
      const activeAdmins = await db.user.count({ where: { roleKey: "super_admin", status: "active", id: { not: target.id } } });
      if (activeAdmins === 0) return json({ ok: false, code: "last_admin" }, 409);
    }
    updates.roleKey = role.key;
    auditDetails.fromRole = target.roleKey;
    auditDetails.toRole = role.key;
  }

  // الحالة: إيقاف/تفعيل
  if (typeof body.status === "string" && ["active", "suspended", "pending_verification"].includes(body.status)) {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("users.suspend"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    if (body.status === "suspended" && target.status !== "suspended") {
      // حماية آخر مدير نشط
      if (target.roleKey === "super_admin") {
        const activeAdmins = await db.user.count({ where: { roleKey: "super_admin", status: "active", id: { not: target.id } } });
        if (activeAdmins === 0) return json({ ok: false, code: "last_admin" }, 409);
      }
      // إبطال فوري لكل جلساته
      await db.authSession.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "suspended" },
      });
      await db.user.update({ where: { id: target.id }, data: { sessionsRevokedAt: new Date() } });
      auditDetails.suspended = true;
    }
    if (body.status === "active" && target.status !== "active") {
      auditDetails.reactivated = true;
    }
    updates.status = body.status;
  }

  if (!Object.keys(updates).length) return json({ ok: false, code: "invalid" }, 400);

  const updated = await db.user.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, email: true, roleKey: true, status: true, phone: true, company: true },
  });

  await audit({
    actorId: actor.id,
    actorEmail: actor.email,
    action:
      auditDetails.suspended ? AUDIT_ACTIONS.userSuspended
      : auditDetails.reactivated ? AUDIT_ACTIONS.userReactivated
      : auditDetails.toRole ? AUDIT_ACTIONS.userRoleChanged
      : AUDIT_ACTIONS.userUpdated,
    entityType: "user",
    entityId: id,
    details: { ...auditDetails, fields: Object.keys(updates) },
  });

  return json({ ok: true, user: updated });
}
