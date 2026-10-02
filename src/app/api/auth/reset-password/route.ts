/**
 * POST /api/auth/reset-password — ضبط كلمة مرور جديدة برمز الاستعادة.
 * يبطل كل جلسات المستخدم بعد النجاح (أمنًا للأجهزة الأخرى).
 */
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { consumeToken, sha256 } from "@/lib/auth/tokens";
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

  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");
  if (!token || !password) {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 100 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { password: "password_weak" } }, { status: 400 });
  }

  // Reject invalid tokens before the expensive password hash; the transaction rechecks atomically.
  if (!/^[a-f0-9]{64}$/.test(token) || !await db.authToken.findFirst({ where: {
    tokenHash: sha256(token), type: "password_reset", usedAt: null, expiresAt: { gt: new Date() }, user: { status: { not: "suspended" } },
  }, select: { id: true } })) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.$transaction(async tx => {
    const userId = await consumeToken(token, "password_reset", { tx });
    if (!userId) return null;
    const updated = await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionsRevokedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "password_reset" } });
    return updated;
  });
  if (!user) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  const userId = user.id;

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
