/**
 * GET  /api/auth/sessions — قائمة جلسات المستخدم النشطة (الأجهزة).
 * POST /api/auth/sessions — إبطال جلسة واحدة {id} أو الكل عدا الحالية {all:true}.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions, sessionFingerprint } from "@/lib/auth/options";
import { guardApi } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET() {
  const guard = await guardApiApi();
  if (guard.ok === false) return guard.response;
  const { user, iat } = guard;
  const currentFp = iat ? sessionFingerprint(user.id, iat) : null;

  const sessions = await db.authSession.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, fingerprint: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });

  return NextResponse.json({
    ok: true,
    sessions: sessions.map((s) => ({
      id: s.id,
      current: s.fingerprint === currentFp,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  let body: { id?: unknown; all?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const iat = (session?.user as { sessionIat?: number } | undefined)?.sessionIat;
  const currentFp = iat ? sessionFingerprint(user.id, iat) : null;

  if (body.all === true) {
    // إبطال كل الجلسات عدا الحالية
    const result = await db.authSession.updateMany({
      where: { userId: user.id, revokedAt: null, fingerprint: { not: currentFp ?? "__none__" } },
      data: { revokedAt: new Date(), revokedReason: "user_revoke_all" },
    });
    await db.user.update({ where: { id: user.id }, data: { sessionsRevokedAt: new Date() } }).catch(() => {});
    // إعادة تفعيل الجلسة الحالية: بصمة جديدة؟ الجلسة الحالية تسقط أيضًا مع sessionsRevokedAt
    // لذا نكتفي بإبطال الصفوف ونبطل الحالية فقط إن طلبت صراحة عبر id
    await audit({ actorId: user.id, actorEmail: user.email, action: AUDIT_ACTIONS.sessionsRevokedAll, entityType: "user", entityId: user.id, details: { count: result.count } });
    return NextResponse.json({ ok: true, revoked: result.count });
  }

  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });

  const target = await db.authSession.findUnique({ where: { id } });
  if (!target || target.userId !== user.id) {
    return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  }
  await db.authSession.update({ where: { id }, data: { revokedAt: new Date(), revokedReason: "user_revoke" } });
  await audit({ actorId: user.id, actorEmail: user.email, action: AUDIT_ACTIONS.sessionRevoked, entityType: "auth_session", entityId: id, details: { current: target.fingerprint === currentFp } });
  return NextResponse.json({ ok: true, currentRevoked: target.fingerprint === currentFp });
}

async function guardApiApi(): Promise<{ ok: true; user: { id: string; email: string }; iat?: number } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  const iat = (session?.user as { sessionIat?: number } | undefined)?.sessionIat;
  if (!uid) {
    return { ok: false, response: NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 }) };
  }
  const dbUser = await db.user.findUnique({ where: { id: uid }, select: { id: true, email: true, status: true } });
  if (!dbUser || dbUser.status === "suspended") {
    return { ok: false, response: NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 }) };
  }
  return { ok: true, user: dbUser, iat };
}
