/**
 * GET /api/account/claim-verify?token=...&ref=... — تأكيد ربط طلب قديم بالحساب.
 * يتطلب: (1) رمزًا صالحًا لنفس المستخدم المسجل حاليًا، (2) طلب ربط معلقًا من قبل.
 * إرسال الرابط للبريد المسجل في الطلب يثبت ملكيته؛ والجلسة تثبت هوية الحساب.
 */
import { NextResponse, type NextRequest } from "next/server";
import { completeClaim } from "@/lib/auth/claims";
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

  const request = await completeClaim(user.id, token, ref.toUpperCase());
  if (!request) {
    return NextResponse.redirect(new URL(`${base}?claim=invalid`, req.url));
  }

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
