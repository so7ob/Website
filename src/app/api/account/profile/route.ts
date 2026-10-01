/**
 * GET   /api/account/profile — بيانات الملف الشخصي الحالية.
 * PATCH /api/account/profile — تحديث الاسم/الهاتف/الشركة/اللغة المفضلة.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const user = await db.user.findUnique({
    where: { id: guard.user.id },
    select: {
      id: true, email: true, name: true, phone: true, company: true, locale: true,
      roleKey: true, status: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true,
    },
  });
  if (!user) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, user: { ...user, emailVerified: Boolean(user.emailVerifiedAt) } });
}

export async function PATCH(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 100);
    if (name.length < 2) return NextResponse.json({ ok: false, code: "invalid", errors: { name: "name_invalid" } }, { status: 400 });
    data.name = name;
  }
  if (typeof body.phone === "string") {
    const phone = body.phone.trim().slice(0, 20);
    if (phone && !/^[+]?[\d\s\-()]{7,20}$/.test(phone)) {
      return NextResponse.json({ ok: false, code: "invalid", errors: { phone: "phone_invalid" } }, { status: 400 });
    }
    data.phone = phone || "";
  }
  if (typeof body.company === "string") {
    data.company = body.company.trim().slice(0, 120);
  }
  if (body.locale === "ar" || body.locale === "en") {
    data.locale = body.locale;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: guard.user.id },
    data,
    select: { name: true, phone: true, company: true, locale: true },
  });

  await audit({
    actorId: guard.user.id,
    actorEmail: guard.user.email,
    action: AUDIT_ACTIONS.userProfileUpdated,
    entityType: "user",
    entityId: guard.user.id,
    details: { fields: Object.keys(data) },
  });

  return NextResponse.json({ ok: true, user: updated });
}
