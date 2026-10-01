import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { validateProjectRequest, isBotLike, type ProjectRequestInput } from "@/lib/validation";
import { checkRateLimit, fingerprint, isDuplicate, memoryStore } from "@/lib/ratelimit";
import { buildNotifyPayload, sendNotify } from "@/lib/notify";
import { getAuthUser } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notifyNewRequest } from "@/lib/requests-service";

/**
 * POST /api/requests — استقبال طلب مشروع.
 * ترتيب الحماية: تحقق شامل ← كشف البوتات ← حد المعدل ← كشف التكرار ← حفظ دائم ← إشعار اختياري.
 * لا نجاح يُعاد للواجهة إلا بعد تأكيد الحفظ فعليًا.
 */

// مخزن داخل المثيل — القيد: عند التوسع الأفقي استبدله بمخزن مشترك
const rateStore = memoryStore();

function refCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `S7-${stamp}${rand}`;
}

function clientIpHash(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
  return ip ? fingerprint(`ip:${ip}`) : null; // بصمة مجهولة — لا يُخزن العنوان
}

export async function POST(request: NextRequest) {
  // المستخدم المسجل: يُربط الطلب بحسابه من الجلسة — لا من حقول المتصفح
  const authUser = await getAuthUser();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  // 1) تحقق شامل (مصدر الحقيقة المشترك مع الواجهة)
  const result = validateProjectRequest(raw);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: "invalid", errors: result.errors }, { status: 400 });
  }
  const data: ProjectRequestInput = result.data;

  // 2) كشف البوتات (حقل العسل/زمن التعبئة)
  if (isBotLike(data)) {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  // 3) حد المعدل لكل بصمة شبكة
  const ipHash = clientIpHash(request) ?? "unknown";
  const now = Date.now();
  const limit = checkRateLimit(rateStore, `rate:${ipHash}`, now);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } }
    );
  }

  const descHash = fingerprint(data.description);
  const email = data.email.trim().toLowerCase();

  // 4) كشف التكرار: نفس البريد + نفس الوصف خلال 30 دقيقة
  try {
    const recent = await db.projectRequest.findMany({
      where: { email, createdAt: { gte: new Date(now - 30 * 60 * 1000) } },
      select: { email: true, descriptionHash: true, createdAt: true },
    });
    if (
      isDuplicate(
        recent.map((r) => ({ email: r.email, descriptionHash: r.descriptionHash, createdAt: r.createdAt.getTime() })),
        email,
        descHash,
        now
      )
    ) {
      return NextResponse.json({ ok: false, code: "duplicate" }, { status: 409 });
    }
  } catch (error) {
    console.error("[requests] duplicate-check failed", error);
    return NextResponse.json({ ok: false, code: "storage" }, { status: 500 });
  }

  // 5) الحفظ الدائم — المسجل يُربط بهويته من الجلسة ويُوثق البريد منها
  const code = refCode();
  try {
    await db.projectRequest.create({
      data: {
        refCode: code,
        ...(authUser ? { clientId: authUser.id, name: authUser.name, email: authUser.email } : {}),
        requestType: data.requestType,
        serviceType: data.serviceType,
        description: data.description,
        budget: data.budget,
        currency: data.currency || null,
        timeline: data.timeline,
        name: data.name,
        company: data.company || null,
        email,
        phone: data.phone || null,
        preferredContact: data.preferredContact,
        referenceUrl: data.referenceUrl || null,
        locale: data.locale,
        clientIpHash: ipHash === "unknown" ? null : ipHash,
        userAgent: (request.headers.get("user-agent") ?? "").slice(0, 200) || null,
        descriptionHash: descHash,
      },
    });
  } catch (error) {
    console.error("[requests] save failed", error);
    return NextResponse.json({ ok: false, code: "storage" }, { status: 500 });
  }

  // 5.5) تدقيق + إشعارات المنصة (الطاقم) — فشلها لا يمس نجاح الحفظ
  const ipForAudit = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await audit({
    actorId: authUser?.id ?? null,
    actorEmail: email,
    action: AUDIT_ACTIONS.requestSubmitted,
    entityType: "request",
    entityId: code,
    details: { ref: code, authenticated: Boolean(authUser) },
    ip: ipForAudit,
  });
  try {
    const created = await db.projectRequest.findUnique({ where: { refCode: code }, select: { id: true } });
    if (created) await notifyNewRequest(code, authUser?.name ?? data.name, created.id);
  } catch (e) {
    console.error("[requests] platform notify failed", e);
  }

  // 6) إشعار المسؤول — اختياري وفشله لا يؤثر على نجاح الحفظ
  const webhook = process.env.NOTIFY_WEBHOOK_URL;
  if (webhook) {
    const notifiedAt = await sendNotify(buildNotifyPayload(data, code), webhook);
    if (notifiedAt) {
      try {
        await db.projectRequest.update({ where: { refCode: code }, data: { notifiedAt } });
      } catch (error) {
        console.error("[requests] notify-stamp failed", error);
      }
    }
  }

  return NextResponse.json({ ok: true, ref: code }, { status: 201 });
}
