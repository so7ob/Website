/**
 * POST /api/track/exchange — تبديل الرمز الخام بجلسة رابط موقّعة (HttpOnly).
 * - يزيل الرمز من شريط العنوان (الواجهة تعيد التوجيه إلى /track?card=scope:id بعده).
 * - الرمز يُفحص ببصمته ويزن حدًا للمعدل ضد التخمين والإغراق.
 * - لا تسجيل للرمز الخام في أي سجل.
 */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import {
  TRACK_COOKIE_NAME,
  createTrackSessionValue,
  hashTrackToken,
  trackCookieOptions,
} from "@/lib/track/session";
import { TRACK_SCOPES } from "@/lib/track/policy";

export const dynamic = "force-dynamic";

const exchangeStore = memoryStore();

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function POST(req: NextRequest) {
  const now = Date.now();

  // حد معدل: 10 محاولات تبادل / 10 دقائق / IP (ضد التخمين)
  const ipHash = (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local").slice(0, 64);
  const limit = checkRateLimit(exchangeStore, `track-ex:${ipHash}`, now, {
    shortMax: 10,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 60,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return noStore(
      NextResponse.json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, { status: 429 })
    );
  }

  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }
  if (!token || token.length > 128) {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }

  const link = await db.trackLink.findUnique({ where: { tokenHash: hashTrackToken(token) } });
  if (!link) {
    // رسالة موحدة — لا كشف لوجود/عدم وجود الرمز
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 403 }));
  }
  if (link.revokedAt) {
    return noStore(NextResponse.json({ ok: false, code: "revoked" }, { status: 403 }));
  }
  if (link.expiresAt.getTime() <= now) {
    return noStore(NextResponse.json({ ok: false, code: "expired" }, { status: 403 }));
  }

  const cardId = (link.requestId ?? link.inquiryId) as string;
  const scope = TRACK_SCOPES.includes(link.scope as never) ? (link.scope as (typeof TRACK_SCOPES)[number]) : null;
  if (!scope || !cardId) {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 403 }));
  }

  // جلسة رابط موقّعة مرتبطة بسجل الرابط — تُعاد تقييم سياستها في كل طلب لاحق
  const res = NextResponse.json({
    ok: true,
    url: `?card=${scope}:${cardId}`,
  });
  res.cookies.set(TRACK_COOKIE_NAME, createTrackSessionValue(link.id), trackCookieOptions());
  return noStore(res);
}
