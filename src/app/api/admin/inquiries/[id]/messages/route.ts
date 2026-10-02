/**
 * POST /api/admin/inquiries/[id]/messages — رد على استفسار أو ملاحظة داخلية.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify } from "@/lib/auth/notifications";
import { fingerprint } from "@/lib/ratelimit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user: actor } = guard;
  const { id } = await params;

  let body: { body?: unknown; kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const text = String(body.body ?? "").trim().slice(0, 8000);
  const kind = body.kind === "internal_note" ? "internal_note" : "message";
  if (!text) return json({ ok: false, code: "empty" }, 400);

  if (kind === "message" && !(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.reply"))) {
    return json({ ok: false, code: "forbidden" }, 403);
  }
  if (kind === "internal_note" && !(actor.roleKey === "super_admin" || actor.permissions.includes("inquiries.reply"))) {
    return json({ ok: false, code: "forbidden" }, 403);
  }

  const inquiry = await db.inquiry.findUnique({ where: { id } });
  if (!inquiry) return json({ ok: false, code: "not_found" }, 404);

  // منع التكرار
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await db.inquiryMessage.findFirst({
    where: { inquiryId: id, authorId: actor.id, createdAt: { gte: fiveMinAgo } },
    orderBy: { createdAt: "desc" },
  });
  if (recent && fingerprint(recent.body) === fingerprint(text)) {
    return json({ ok: true, message: recent });
  }

  const message = await db.inquiryMessage.create({
    data: { inquiryId: id, authorId: actor.id, authorType: "staff", kind, body: text },
  });
  await db.inquiry.update({
    where: { id },
    data: { lastActivityAt: new Date(), ...(kind === "message" ? { status: "responded" } : {}) },
  });

  await audit({
    actorId: actor.id, actorEmail: actor.email, action: AUDIT_ACTIONS.inquiryReplied,
    entityType: "inquiry", entityId: id, details: { kind, ref: inquiry.refCode },
  });

  if (kind === "message" && inquiry.clientId) {
    await notify({ userId: inquiry.clientId, type: "reply_received", payload: { ref: inquiry.refCode }, link: `/${inquiry.locale}/account/inquiries/${id}` });
  }

  return json({ ok: true, message }, 201);
}
