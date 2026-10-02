/**
 * POST /api/auth/forgot-password — طلب استعادة كلمة المرور.
 * الرد موحد دائمًا (لا يكشف وجود الحساب)؛ عند وجود الحساب يُرسل رابط إعادة التعيين.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { issueToken } from "@/lib/auth/tokens";
import { sendMail, absoluteUrl, emailDevMode } from "@/lib/auth/email";
import { resetPasswordMail } from "@/lib/auth/email-templates";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { assertSameOrigin } from "@/lib/auth/session";

const rateStore = memoryStore();

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin" }, { status: 403 });
  }

  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const limit = checkRateLimit(rateStore, `forgot:${ip}`, now, {
    shortMax: 3,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 10,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, { status: 429 });
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  // الرد موحد مهما كانت النتيجة — منع كشف وجود الحساب
  const generic = { ok: true, message: "if_account_exists" };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json(generic);
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status === "suspended") {
    await audit({ action: AUDIT_ACTIONS.userLoginFailed, entityType: "user", details: { flow: "forgot_password", emailHint: "not_found" }, ip });
    return NextResponse.json(generic);
  }

  const token = await issueToken(user.id, "password_reset");
  const resetUrl = absoluteUrl(`/${user.locale}/auth/reset-password?token=${token.raw}`);
  const mail = resetPasswordMail(user.locale, { url: resetUrl });
  const mailResult = await sendMail({ to: user.email, subject: mail.subject, text: mail.text });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userPasswordReset,
    entityType: "user",
    entityId: user.id,
    details: { stage: "requested", emailStatus: mailResult.status },
    ip,
  });

  // في وضع التطوير فقط نُعيد الرابط للاختبار
  return NextResponse.json({ ...generic, ...(emailDevMode() ? { devResetUrl: resetUrl } : {}) });
}
