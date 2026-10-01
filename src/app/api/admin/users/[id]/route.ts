/**
 * PATCH /api/admin/users/[id] — تعديل المستخدم: بياناته/دوره/حالته (وفق الصلاحيات).
 * حماية صريحة: لا إيقاف أو تخفيض آخر مدير نظام نشط.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

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
