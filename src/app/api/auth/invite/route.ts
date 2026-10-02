/**
 * POST /api/auth/invite — قبول دعوة وإنشاء الحساب بكلمة مرور يختارها المدعو.
 * الرمز أحادي الاستخدام صالح 7 أيام؛ الدور ثابت من الدعوة.
 */
import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { assertSameOrigin } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { Prisma } from "@prisma/client";
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

  const token = String(body?.token ?? "");
  const name = String(body?.name ?? "").trim().slice(0, 100);
  const password = String(body?.password ?? "");
  if (!token || name.length < 2) return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  if (password.length < 8 || password.length > 100 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ ok: false, code: "invalid", errors: { password: "password_weak" } }, { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (!/^[a-f0-9]{64}$/.test(token) || !await db.userInvite.findFirst({ where: {
    tokenHash, acceptedAt: null, expiresAt: { gt: new Date() },
  }, select: { id: true } })) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await db.$transaction(async tx => {
      const accepted = await tx.userInvite.updateMany({ where: { tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (accepted.count !== 1) return null;
      const invite = await tx.userInvite.findUniqueOrThrow({ where: { tokenHash } });
      const created = await tx.user.create({ data: {
        email: invite.email, name, passwordHash, locale: "ar", roleKey: invite.roleKey,
        status: "active", emailVerifiedAt: new Date(),
      } });
      await tx.userInvite.update({ where: { id: invite.id }, data: { acceptedUserId: created.id } });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ ok: false, code: "email_taken" }, { status: 409 });
    throw error;
  }
  if (!user) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 400 });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.invite_accepted",
    entityType: "user",
    entityId: user.id,
    details: { roleKey: user.roleKey },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
