/**
 * POST /api/auth/change-password — تغيير كلمة المرور من داخل الحساب (يتطلب جلسة).
 * يتحقق من كلمة المرور الحالية، ثم يبطل كل الجلسات (بما فيها الحالية) —
 * الواجهة تعيد الدخول تلقائيًا بعد النجاح.
 */
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { guardApi } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 8 || newPassword.length > 100 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { newPassword: "password_weak" } }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { currentPassword: "wrong_password" } }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { newPassword: "same_password" } }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionsRevokedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await db.authSession.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "password_changed" },
  });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userPasswordChanged,
    entityType: "user",
    entityId: user.id,
  });

  return NextResponse.json({ ok: true, signedOut: true });
}
