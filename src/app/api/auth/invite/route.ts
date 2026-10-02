/**
 * POST /api/auth/invite — قبول دعوة وإنشاء الحساب بكلمة مرور يختارها المدعو.
 * الرمز أحادي الاستخدام صالح 7 أيام؛ الدور ثابت من الدعوة.
 */
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { assertSameOrigin } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ ok: false, code: "bad_origin" }, { status: 403 });
  }

  let body: { token?: unknown; name?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const name = String(body.name ?? "").trim().slice(0, 100);
  const password = String(body.password ?? "");
  if (!token || name.length < 2) return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { password: "password_weak" } }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await db.userInvite.findUnique({ where: { tokenHash } });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email: invite.email } });
  if (existing) return NextResponse.json({ ok: false, code: "email_taken" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: {
      email: invite.email,
      name,
      passwordHash,
      locale: "ar",
      roleKey: invite.roleKey,
      status: "active",
      emailVerifiedAt: new Date(), // الدعوة موثقة من الإدارة
    },
  });
  await db.userInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date(), acceptedUserId: user.id } });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.invite_accepted",
    entityType: "user",
    entityId: user.id,
    details: { roleKey: invite.roleKey },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
