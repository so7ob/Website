/**
 * POST /api/inquiries — استقبال استفسار عام (زائر أو مسجل).
 * تحقق + حد معدل + رقم مرجعي + إشعار الطاقم.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { getAuthUser } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notifyMany, staffToNotifyForRequests } from "@/lib/auth/notifications";

const rateStore = memoryStore();

const CATEGORIES = ["general", "services", "pricing", "support", "other"];

function refCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `IQ-${stamp}${rand}`;
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const subject = String(body.subject ?? "").trim().slice(0, 200);
  const message = String(body.message ?? "").trim().slice(0, 5000);
  const name = String(body.name ?? (authUser?.name ?? "")).trim().slice(0, 100);
  const email = String(body.email ?? (authUser?.email ?? "")).trim().toLowerCase().slice(0, 200);
  const category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "general";
  const locale = body.locale === "en" ? "en" : "ar";

  const errors: Record<string, string> = {};
  if (subject.length < 3) errors.subject = "required";
  if (message.length < 10) errors.message = "required";
  if (name.length < 2) errors.name = "required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "invalidEmail";
  if (Object.keys(errors).length) return json({ ok: false, code: "invalid", errors }, 400);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(rateStore, `inquiry:${ip}`, Date.now(), {
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
      name,
      email,
      clientId: authUser?.id ?? null,
      messages: {
        create: { authorId: authUser?.id ?? null, authorType: authUser ? "client" : "client", kind: "message", body: message },
      },
    },
  });

  await audit({
    actorId: authUser?.id ?? null,
    actorEmail: email,
    action: AUDIT_ACTIONS.inquirySubmitted,
    entityType: "inquiry",
    entityId: inquiry.id,
    details: { ref: code },
    ip,
  });

  const staff = await staffToNotifyForRequests();
  await notifyMany(staff.map((s) => ({ userId: s.id, type: "new_inquiry" as const, payload: { ref: code, subject }, link: `/${locale}/admin/inquiries` })));

  return json({ ok: true, ref: code }, 201);
}
