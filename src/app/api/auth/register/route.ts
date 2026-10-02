/**
 * POST /api/auth/register — إنشاء حساب عميل جديد.
 * - الدور ثابت (client) — لا يمكن للمستخدم اختيار دور إداري عند التسجيل.
 * - ينشئ الحساب بحالة pending_verification ويرسل رابط التحقق.
 * - في وضع تطوير البريد يُعاد رابط التحقق في الاستجابة (للاختبار المحلي فقط).
 */
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { issueToken } from "@/lib/auth/tokens";
import { sendMail, absoluteUrl, emailDevMode } from "@/lib/auth/email";
import { verifyEmailMail } from "@/lib/auth/email-templates";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { assertSameOrigin } from "@/lib/auth/session";

const rateStore = memoryStore();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validatePassword(password: string): string | null {
  if (password.length < 8) return "password_short";
  if (password.length > 100) return "password_long";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "password_weak";
  return null;
}

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin" }, { status: 403 });
  }

  // حد معدل التسجيل لكل بصمة شبكة
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const limit = checkRateLimit(rateStore, `register:${ip}`, now, {
    shortMax: 3,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 10,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? "");
  const locale = body.locale === "en" ? "en" : "ar";

  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100) errors.name = "name_invalid";
  if (!email || !EMAIL_RE.test(email) || email.length > 200) errors.email = "email_invalid";
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, code: "invalid", errors }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { email: "email_taken" } }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: { email, name, passwordHash, locale, roleKey: "client", status: "pending_verification" },
  });

  // رمز تحقق بريد أحادي الاستخدام
  const token = await issueToken(user.id, "email_verify");
  const verifyUrl = absoluteUrl(`/api/auth/verify-email?token=${token.raw}&locale=${locale}`);
  const mail = verifyEmailMail(locale, { url: verifyUrl });
  const mailResult = await sendMail({ to: email, subject: mail.subject, text: mail.text });

  await audit({
    actorId: user.id,
    actorEmail: email,
    action: AUDIT_ACTIONS.userRegister,
    entityType: "user",
    entityId: user.id,
    ip,
  });

  return NextResponse.json(
    {
      ok: true,
      emailStatus: mailResult.status,
      // رابط التطوير فقط عند تفعيل EMAIL_DEV_MODE — لا يظهر في الإنتاج
      ...(emailDevMode() ? { devVerifyUrl: verifyUrl } : {}),
    },
    { status: 201 }
  );
}
