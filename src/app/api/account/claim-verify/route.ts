/**
 * GET /api/account/claim-verify?token=...&ref=... — تأكيد ربط طلب قديم بالحساب.
 * يتطلب: (1) رمزًا صالحًا لنفس المستخدم المسجل حاليًا، (2) طلب ربط معلقًا من قبل.
 * إرسال الرابط للبريد المسجل في الطلب يثبت ملكيته؛ والجلسة تثبت هوية الحساب.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { getAuthUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  const user = await getAuthUser();
  const uiLocale = user?.locale ?? (req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar");
  const base = `/${uiLocale}/account/requests`;

  if (!user) {
    return NextResponse.redirect(new URL(`${base}?claim=login_required`, req.url));
  }

  const userId = await consumeToken(token, "request_claim");
  if (!userId || userId !== user.id) {
    return NextResponse.redirect(new URL(`${base}?claim=invalid`, req.url));
  }

  const request = ref ? await db.projectRequest.findUnique({ where: { refCode: ref.toUpperCase() } }) : null;
  if (!request) {
    return NextResponse.redirect(new URL(`${base}?claim=invalid`, req.url));
  }

  const claim = await db.requestClaim.findUnique({ where: { requestId: request.id } });
  if (!claim || claim.userId !== user.id || claim.status !== "pending") {
    return NextResponse.redirect(new URL(`${base}?claim=invalid`, req.url));
  }

  // الربط الفعلي — مع تسجيل الحدث
  await db.$transaction([
    db.requestClaim.update({ where: { requestId: request.id }, data: { status: "verified", verifiedAt: new Date() } }),
    db.projectRequest.update({ where: { id: request.id }, data: { clientId: user.id } }),
    db.requestMessage.create({
      data: { requestId: request.id, authorType: "system", kind: "system", body: `claim_linked:${user.id}` },
    }),
  ]);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.requestClaimed,
    entityType: "request",
    entityId: request.id,
    details: { ref: request.refCode, stage: "verified" },
  });

  return NextResponse.redirect(new URL(`${base}?claim=ok&ref=${request.refCode}`, req.url));
}
