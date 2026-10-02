/**
 * GET /api/admin/dashboard — مؤشرات تشغيلية من بيانات حقيقية.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { dashboardAccess } from "@/lib/auth/resource-access";
import { REQUEST_STATUSES } from "@/lib/requests-service";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "admin.dashboard");
  if (!guard.ok) return guard.response;

  const access = dashboardAccess(guard.user);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const openStatuses = ["new", "in_review", "awaiting_info", "in_progress", "responded"];

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    suspendedUsers,
    openRequests,
    newRequests,
    awaitingInfo,
    openInquiries,
    publishedPages,
    draftPages,
    requestsByStatus,
    recentRequests,
    recentAudit,
    last7days,
  ] = await Promise.all([
    (access.users ? db.user.count() : Promise.resolve(0)),
    (access.users ? db.user.count({ where: { status: "active" } }) : Promise.resolve(0)),
    (access.users ? db.user.count({ where: { status: "pending_verification" } }) : Promise.resolve(0)),
    (access.users ? db.user.count({ where: { status: "suspended" } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.count({ where: { status: { in: openStatuses }, archivedAt: null } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.count({ where: { status: "new", archivedAt: null } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.count({ where: { status: "awaiting_info", archivedAt: null } }) : Promise.resolve(0)),
    (access.inquiries ? db.inquiry.count({ where: { status: { in: ["new", "in_review", "awaiting_info", "responded"] }, archivedAt: null } }) : Promise.resolve(0)),
    (access.pages ? db.page.count({ where: { status: "published" } }) : Promise.resolve(0)),
    (access.pages ? db.page.count({ where: { status: { in: ["draft", "in_review"] } } }) : Promise.resolve(0)),
    (access.requests ? db.projectRequest.groupBy({ by: ["status"], where: { archivedAt: null }, _count: true }) : Promise.resolve([])),
    (access.requests ? db.projectRequest.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, refCode: true, name: true, status: true, serviceType: true, createdAt: true, assignee: { select: { name: true } } },
    }) : Promise.resolve([])),
    (access.audit ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }) : Promise.resolve([])),
    (access.requests ? db.projectRequest.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    }) : Promise.resolve([])),
  ]);

  // سلسلة آخر 7 أيام للرسم
  const dayCounts: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    dayCounts.push({
      date: day.toISOString().slice(0, 10),
      count: last7days.filter((r) => r.createdAt >= day && r.createdAt < next).length,
    });
  }

  return json({
    ok: true,
    metrics: {
      totalUsers: access.users ? totalUsers : null,
      activeUsers: access.users ? activeUsers : null,
      pendingUsers: access.users ? pendingUsers : null,
      suspendedUsers: access.users ? suspendedUsers : null,
      openRequests: access.requests ? openRequests : null,
      newRequests: access.requests ? newRequests : null,
      awaitingInfo: access.requests ? awaitingInfo : null,
      openInquiries: access.inquiries ? openInquiries : null,
      publishedPages: access.pages ? publishedPages : null,
      draftPages: access.pages ? draftPages : null,
    },
    requestsByStatus: !access.requests ? [] : REQUEST_STATUSES.map((s) => ({
      status: s,
      count: requestsByStatus.find((r) => r.status === s)?._count ?? 0,
    })),
    recentRequests,
    recentActivity: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      actor: a.actor?.name ?? a.actorEmail ?? "—",
      createdAt: a.createdAt,
    })),
    last7days: access.requests ? dayCounts : [],
  });
}
