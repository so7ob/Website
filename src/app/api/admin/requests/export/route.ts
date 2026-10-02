/**
 * GET /api/admin/requests/export — تصدير الطلبات الحالية (بالتصفية نفسها كالقائمة) إلى CSV.
 * حد أقصى 5000 صف؛ ترميز UTF-8 مع BOM ليتعرب Excel مع الحروف العربية.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApi } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { REQUEST_STATUSES } from "@/lib/requests-service";

const MAX_ROWS = 5000;

/** الحالات المفتوحة — الردود المتأخرة تخص الطلبات غير المغلبة/الملغاة فقط */
const OVERDUE_OPEN_STATUSES = ["new", "in_review", "awaiting_info", "in_progress", "responded"];

/** نفس منطق /api/admin/requests: مرشّحون مفتوحون غير مؤرشفون ثم مطابقة في الذاكرة
 *  (Prisma لا يقارن عمودين في المرشّح) — دلالات مؤشر اللوحة نفسها. */
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

/** تهريب قيمة CSV: تُقتبس الحقول التي تحتوي فاصلة/اقتباس/سطرًا جديدًا */
function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

const COLUMNS = [
  "refCode",
  "status",
  "priority",
  "service",
  "clientName",
  "clientEmail",
  "assigneeEmail",
  "budget",
  "currency",
  "timeline",
  "contactPref",
  "createdAt",
  "lastMessageAt",
  "closedReason",
  "archived",
] as const;

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "requests.export");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const status = url.searchParams.get("status") ?? "";
  const service = url.searchParams.get("service") ?? "";
  const priority = url.searchParams.get("priority") ?? "";
  const assignee = url.searchParams.get("assignee") ?? "";
  const archived = url.searchParams.get("archived") === "1";
  const overdue = url.searchParams.get("overdue") === "1";

  // تصفية الردود المتأخرة — تجمع مع بقية مرشّحات القائمة نفسها
  const overdueIds = overdue ? await findOverdueRequestIds() : [];

  // نفس بناء شروط القائمة /api/admin/requests — بلا ترقيم صفحات
  const where = {
    archivedAt: archived ? { not: null } : null,
    ...(overdue ? { id: { in: overdueIds } } : {}),
    ...(status && REQUEST_STATUSES.includes(status as never) ? { status } : {}),
    ...(service ? { serviceType: service } : {}),
    ...(priority ? { priority } : {}),
    ...(assignee === "none" ? { assigneeId: null } : assignee ? { assigneeId: assignee } : {}),
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

  const rows = await db.projectRequest.findMany({
    where,
    orderBy: { lastActivityAt: "desc" },
    take: MAX_ROWS,
    select: {
      refCode: true,
      status: true,
      priority: true,
      serviceType: true,
      name: true,
      email: true,
      budget: true,
      currency: true,
      timeline: true,
      preferredContact: true,
      createdAt: true,
      lastActivityAt: true,
      resolutionNote: true,
      archivedAt: true,
      assignee: { select: { email: true } },
    },
  });

  const lines: string[] = [COLUMNS.join(",")];
  for (const r of rows) {
    const record = [
      csvValue(r.refCode),
      csvValue(r.status),
      csvValue(r.priority),
      csvValue(r.serviceType),
      csvValue(r.name),
      csvValue(r.email),
      csvValue(r.assignee?.email),
      csvValue(r.budget),
      csvValue(r.currency),
      csvValue(r.timeline),
      csvValue(r.preferredContact),
      csvValue(r.createdAt),
      csvValue(r.lastActivityAt),
      csvValue(r.resolutionNote),
      r.archivedAt ? "1" : "0",
    ];
    lines.push(record.map(csvEscape).join(","));
  }

  const today = new Date().toISOString().slice(0, 10);
  const csv = `\uFEFF${lines.join("\r\n")}\r\n`;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.requestsExported,
    entityType: "project_request",
    entityId: null,
    details: {
      count: rows.length,
      filters: {
        ...(status ? { status } : {}),
        ...(service ? { service } : {}),
        ...(priority ? { priority } : {}),
        ...(assignee ? { assignee } : {}),
        archived,
        overdue,
        ...(query ? { query } : {}),
      },
    },
    ip,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="so7ob-requests-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
