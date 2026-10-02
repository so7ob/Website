/**
 * GET /api/admin/inquiries/export — تصدير الاستفسارات الحالية (بالتصفية نفسها
 * كالقائمة) إلى CSV. حد أقصى 5000 صف؛ ترميز UTF-8 مع BOM ليتعرب Excel
 * مع الحروف العربية.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guardApi } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

const MAX_ROWS = 5000;
const INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded", "closed"];
// «open» مرشّح مركّب يطابق مؤشر اللوحة (نفس مجموعة واجهة القائمة)
const OPEN_INQUIRY_STATUSES = ["new", "in_review", "awaiting_info", "responded"];

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
  "id",
  "subject",
  "category",
  "status",
  "name",
  "email",
  "assignedTo",
  "createdAt",
  "lastMessageAt",
  "archived",
] as const;

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "inquiries.export");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const status = url.searchParams.get("status") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const archived = url.searchParams.get("archived") === "1";

  // نفس بناء شروط القائمة /api/admin/inquiries — بلا ترقيم صفحات
  // (archived=1 → المؤرشف فقط؛ الافتراضي غير المؤرشف دائمًا — نفس دلالات القائمة)
  const where = {
    archivedAt: archived ? { not: null } : null,
    // (status=open → المرشّح المركّب: الحالات المفتوحة)
    ...(status === "open"
      ? { status: { in: OPEN_INQUIRY_STATUSES } }
      : status && INQUIRY_STATUSES.includes(status)
        ? { status }
        : {}),
    ...(category ? { category } : {}),
    ...(query
      ? {
          OR: [
            { subject: { contains: query } },
            { email: { contains: query } },
            { name: { contains: query } },
            { refCode: { contains: query.toUpperCase() } },
          ],
        }
      : {}),
  };

  const rows = await db.inquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: {
      id: true,
      refCode: true,
      subject: true,
      category: true,
      status: true,
      name: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      assignee: { select: { email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const lines: string[] = [COLUMNS.join(",")];
  for (const r of rows) {
    const record = [
      csvValue(r.refCode),
      csvValue(r.id),
      csvValue(r.subject),
      csvValue(r.category),
      csvValue(r.status),
      csvValue(r.name),
      csvValue(r.email),
      csvValue(r.assignee?.email),
      csvValue(r.createdAt),
      // آخر رسالة إن وجدت — وإلا آخر تحديث للاستفسار
      csvValue(r.messages[0]?.createdAt ?? r.updatedAt),
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
    action: AUDIT_ACTIONS.inquiriesExported,
    entityType: "inquiry",
    entityId: null,
    details: {
      count: rows.length,
      filters: {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(query ? { query } : {}),
      },
    },
    ip,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="so7ob-inquiries-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
