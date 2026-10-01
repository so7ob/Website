/**
 * POST /api/auth/reset-password — ضبط كلمة مرور جديدة برمز الاستعادة.
 * يبطل كل جلسات المستخدم بعد النجاح (أمنًا للأجهزة الأخرى).
 */
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { assertSameOrigin } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin" }, { status: 403 });
  }

  let body: { token?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (!token || !password) {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 100 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { password: "password_weak" } }, { status: 400 });
  }

  const userId = await consumeToken(token, "password_reset");
  if (!userId) {
    return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      sessionsRevokedAt: new Date(), // إبطال كل الجلسات القائمة
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await db.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "password_reset" },
  });

  await audit({
    actorId: userId,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userPasswordReset,
    entityType: "user",
    entityId: userId,
    details: { stage: "completed" },
  });

  return NextResponse.json({ ok: true });
}
