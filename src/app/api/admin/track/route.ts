/**
 * /api/admin/track — إدارة روابط المتابعة للبطاقات (للطاقم المخوّل).
 * GET   ?scope=&id=        → حالة الرابط والسياسة الفعلية ومصدرها (بلا رمز خام)
 * POST  {action, scope, id, ...} → renew | revoke | policy
 */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, guardApi, assertSameOrigin } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import {
  getTrackPolicySettings,
  isTrackMode,
  resolveTrackPolicy,
  type TrackMode,
  type TrackScope,
} from "@/lib/track/policy";
import { renewTrackLink, revokeTrackLink } from "@/lib/track/service";
import { cardContact, emailTrackLink } from "@/lib/track/notify";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

function scopePermission(scope: TrackScope): { view: "requests.view.all" | "inquiries.view.all"; reply: "requests.reply" | "inquiries.reply" } {
  return scope === "request"
    ? { view: "requests.view.all", reply: "requests.reply" }
    : { view: "inquiries.view.all", reply: "inquiries.reply" };
}

async function resolveCard(scope: TrackScope, id: string) {
  if (scope === "request") {
    return db.projectRequest.findUnique({ where: { id }, select: { id: true, refCode: true } });
  }
  return db.inquiry.findUnique({ where: { id }, select: { id: true, refCode: true } });
}

export async function GET(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const user = await getAuthUser();
  if (!user) return noStore(NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 }));

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if ((scope !== "request" && scope !== "inquiry") || !id) {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }
  const perms = scopePermission(scope as TrackScope);
  if (!user.permissions.includes(perms.view)) {
    return noStore(NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 }));
  }

  const card = await resolveCard(scope as TrackScope, id);
  if (!card) return noStore(NextResponse.json({ ok: false, code: "not_found" }, { status: 404 }));

  // استثناء البطاقة يُقرأ هنا حتى تعرض اللوحة السياسة الفعلية الصحيحة
  // (كان يُحسب بـ null دائمًا فتختفي أثر الاستثناء من العرض) — G6
  const exceptionKey = `track.exception.${scope}.${id}`;
  const [settings, links, exceptionRows] = await Promise.all([
    getTrackPolicySettings(),
    db.trackLink.findMany({
      where: { scope, ...(scope === "request" ? { requestId: id } : { inquiryId: id }) },
      orderBy: { createdAt: "desc" },
      take: 1,
    }),
    db.siteSetting.findMany({ where: { key: exceptionKey }, select: { key: true, value: true } }),
  ]);
  const link = links[0] ?? null;
  const exception = isTrackMode(exceptionRows[0]?.value) ? (exceptionRows[0]!.value as TrackMode) : null;
  const policy = resolveTrackPolicy(scope as TrackScope, settings, exception);
  const state = !link ? "missing" : link.revokedAt ? "revoked" : link.expiresAt.getTime() <= Date.now() ? "expired" : "valid";

  return noStore(
    NextResponse.json({
      ok: true,
      link: link
        ? {
            id: link.id,
            state,
            expiresAt: link.expiresAt.toISOString(),
            revokedAt: link.revokedAt?.toISOString() ?? null,
            revokedReason: link.revokedReason,
            createdAt: link.createdAt.toISOString(),
          }
        : null,
      policy: { mode: policy.mode, source: policy.source, canReplyViaLink: policy.canReplyViaLink },
      exception,
      settings: { forceLogin: settings.forceLogin },
    })
  );
}

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return noStore(NextResponse.json({ ok: false, code: "bad_origin" }, { status: 403 }));
  }
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const user = await getAuthUser();
  if (!user) return noStore(NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 }));

  let payload: { action?: string; scope?: string; id?: string; reason?: string; mode?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }
  const { action, scope, id } = payload;
  if ((scope !== "request" && scope !== "inquiry") || !id) {
    return noStore(NextResponse.json({ ok: false, code: "invalid" }, { status: 400 }));
  }
  const perms = scopePermission(scope as TrackScope);
  if (!user.permissions.includes(perms.reply)) {
    return noStore(NextResponse.json({ ok: false, code: "forbidden" }, { status: 403 }));
  }
  const card = await resolveCard(scope as TrackScope, id);
  if (!card) return noStore(NextResponse.json({ ok: false, code: "not_found" }, { status: 404 }));

  if (action === "renew" || action === "revoke") {
    const links = await db.trackLink.findMany({
      where: { scope, ...(scope === "request" ? { requestId: id } : { inquiryId: id }) },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    const link = links[0];
    if (!link) return noStore(NextResponse.json({ ok: false, code: "not_found" }, { status: 404 }));

    if (action === "renew") {
      const token = await renewTrackLink(link.id, user.id, user.email);
      if (!token) return noStore(NextResponse.json({ ok: false, code: "renew_failed" }, { status: 500 }));
      // الرمز يُعاد مرة واحدة هنا — الواجهة تبني الرابط بلغتها: /{locale}/track?t=...
      // وتُسلَّم نسخة بالبريد لصاحب البطاقة — best-effort لا يمس نجاح التجديد
      const contact = await cardContact(scope as TrackScope, id);
      const settings = await getTrackPolicySettings();
      if (contact) {
        await emailTrackLink({
          scope: scope as TrackScope,
          to: contact.email,
          locale: contact.locale,
          token,
          refCode: card.refCode,
          expiresInDays: settings.linkTtlDays,
        });
      }
      return noStore(NextResponse.json({ ok: true, token, emailedTo: contact?.email ?? null }));
    }

    const revoked = await revokeTrackLink(link.id, payload.reason ?? null, user.id, user.email);
    return noStore(
      NextResponse.json({ ok: revoked.ok, code: revoked.ok ? undefined : revoked.alreadyRevoked ? "already_revoked" : "not_found" })
    );
  }

  if (action === "policy") {
    // استثناء البطاقة — يُخزن في SiteSetting باسم بطاقة محدد (استثناء لكل بطاقة)
    const mode = payload.mode ?? "";
    if (mode !== "inherit" && !isTrackMode(mode)) {
      return noStore(NextResponse.json({ ok: false, code: "invalid_mode" }, { status: 400 }));
    }
    const key = `track.exception.${scope}.${id}`;
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value: mode, updatedById: user.id },
      update: { value: mode, updatedById: user.id },
    });
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.trackPolicyChanged,
      entityType: scope,
      entityId: id,
      details: { exception: mode },
    });
    return noStore(NextResponse.json({ ok: true }));
  }

  return noStore(NextResponse.json({ ok: false, code: "invalid_action" }, { status: 400 }));
}
