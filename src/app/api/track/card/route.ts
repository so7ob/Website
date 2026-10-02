/**
 * GET /api/track/card?scope=&id= — عرض البطاقة عبر قناة المتابعة.
 * الهوية: جلسة رابط موقّعة (كوكي HttpOnly) أو حساب المالك/الطاقم.
 * السياسة تُقيّم لحظيًا في كل طلب — تحوّلها يوقف الوصول فورًا.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { TRACK_SCOPES } from "@/lib/track/policy";
import { getTrackView } from "@/lib/track/service";
import { TRACK_COOKIE_NAME, verifyTrackSessionValue } from "@/lib/track/session";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "";
  const id = url.searchParams.get("id") ?? "";

  if (!TRACK_SCOPES.includes(scope as never) || !id || id.length > 64) {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }

  const [authUser, sessionLinkId] = await Promise.all([
    getAuthUser().catch(() => null),
    Promise.resolve(verifyTrackSessionValue(req.cookies.get(TRACK_COOKIE_NAME)?.value)),
  ]);

  const view = await getTrackView(scope as (typeof TRACK_SCOPES)[number], id, {
    authUser: authUser ? { id: authUser.id, permissions: [...authUser.permissions], roleKey: authUser.roleKey } : null,
    sessionLinkId,
  });

  if (!view.ok) {
    // رموز الحالة موحدة وآمنة: not_found / expired / revoked / policy_denied / owner_required
    return noStore(
      NextResponse.json(
        {
          ok: false,
          code: view.reason ?? "denied",
          policy: view.policy
            ? { mode: view.policy.mode, source: view.policy.source }
            : undefined,
        },
        { status: view.reason === "not_found" ? 404 : 403 }
      )
    );
  }

  return noStore(
    NextResponse.json({
      ok: true,
      card: view.card,
      policy: view.policy,
      link: view.link
        ? { expiresAt: view.link.expiresAt.toISOString(), state: view.link.state }
        : null,
      // لا جلسة رابط للمالك عبر الحساب — الواجهة تعرف كيف تعرض
      access: { via: authUser ? "account" : "link" },
    })
  );
}
