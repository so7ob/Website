/**
 * POST /api/admin/inquiries/bulk — إجراءات جماعية مضبوطة بالصلاحيات
 * (أرشفة/استعادة) للاستفسارات.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user: actor } = guard;

  let body: { ids?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
  const action = String(body.action ?? "");
  if (!ids.length) return json({ ok: false, code: "invalid" }, 400);

  if (action === "archive") {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.archive"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const result = await db.inquiry.updateMany({
      where: { id: { in: ids }, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    await audit({
      actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.inquiryArchived,
      entityType: "inquiry", details: { bulk: true, count: result.count },
    });
    return json({ ok: true, count: result.count });
  }

  if (action === "restore") {
    if (!(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.archive"))) {
      return json({ ok: false, code: "forbidden" }, 403);
    }
    const result = await db.inquiry.updateMany({
      where: { id: { in: ids }, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    await audit({
      actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.inquiryRestored,
      entityType: "inquiry", details: { bulk: true, count: result.count },
    });
    return json({ ok: true, count: result.count });
  }

  return json({ ok: false, code: "invalid" }, 400);
}
