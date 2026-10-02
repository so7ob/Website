/**
 * GET /api/auth/verify-email?token=... — تأكيد البريد من رابط الرسالة.
 * رمز أحادي الاستخدام محدود المدة؛ عند النجاح يُفعَّل الحساب ويوجَّه لصفحة النتيجة.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar";

  const result = await db.$transaction(async tx => {
    const userId = await consumeToken(token, "email_verify", { tx });
    if (!userId) return null;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const alreadyVerified = Boolean(user.emailVerifiedAt);
    if (!alreadyVerified) await tx.user.update({ where: { id: userId }, data: {
      emailVerifiedAt: new Date(), status: user.status === "pending_verification" ? "active" : user.status,
    } });
    return { user, alreadyVerified };
  });
  if (!result) return NextResponse.redirect(new URL(`/${locale}/auth/verified?status=invalid`, req.url));
  const { user, alreadyVerified } = result;
  const userId = user.id;

  await audit({
    actorId: userId,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.userEmailVerified,
    entityType: "user",
    entityId: userId,
  });

  return NextResponse.redirect(
    new URL(`/${locale}/auth/verified?status=${alreadyVerified ? "already" : "ok"}`, req.url)
  );
}
