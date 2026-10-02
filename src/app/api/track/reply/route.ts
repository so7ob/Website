/**
 * POST /api/track/reply — إضافة رد عبر قناة المتابعة (زائر بحلقة رابط صالحة أو مالك الحساب).
 * - نفس بوابات العرض + سياسة الرد لحظيًا.
 * - منع التكرار المتطابق + حد معدل + نص محدود.
 * - الزائر يُسجل كـ authorType=client بلا حساب صوري وبلا انتحال هوية.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { TRACK_SCOPES } from "@/lib/track/policy";
import { replyViaTrack } from "@/lib/track/service";
import { TRACK_COOKIE_NAME, verifyTrackSessionValue } from "@/lib/track/session";

export const dynamic = "force-dynamic";

const replyStore = memoryStore();

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  const ipHash = (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local").slice(0, 64);

  // حد معدل: 5 ردود / 10 دقائق / IP
  const limit = checkRateLimit(replyStore, `track-rp:${ipHash}`, now, {
    shortMax: 5,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 30,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return noStore(
      NextResponse.json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, { status: 429 })
    );
  }

  let scope = "";
  let id = "";
  let body = "";
  try {
    const payload = (await req.json()) as { scope?: unknown; id?: unknown; body?: unknown };
    scope = typeof payload.scope === "string" ? payload.scope : "";
    id = typeof payload.id === "string" ? payload.id : "";
    body = typeof payload.body === "string" ? payload.body : "";
  } catch {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }
  if (!TRACK_SCOPES.includes(scope as never) || !id || id.length > 64) {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }

  const [authUser, sessionLinkId] = await Promise.all([
    getAuthUser().catch(() => null),
    Promise.resolve(verifyTrackSessionValue(req.cookies.get(TRACK_COOKIE_NAME)?.value)),
  ]);

  const result = await replyViaTrack(scope as (typeof TRACK_SCOPES)[number], id, {
    authUser: authUser ? { id: authUser.id, permissions: [...authUser.permissions], roleKey: authUser.roleKey } : null,
    sessionLinkId,
  }, body);

  if (!result.ok) {
    const status =
      result.reason === "not_found" ? 404
      : result.reason === "empty" || result.reason === "too_long" ? 400
      : result.reason === "duplicate" ? 409
      : 403;
    return noStore(NextResponse.json({ ok: false, code: result.reason ?? "denied" }, { status }));
  }

  return noStore(NextResponse.json({ ok: true, message: result.message }, { status: 201 }));
}
