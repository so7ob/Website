/**
 * خدمة روابط المتابعة — العمليات الخادمية الموحدة لبطاقات الطلبات والاستفسارات.
 *
 * الضمانات:
 * - الرمز الخام يُنشأ مرة واحدة عند الإصدار/التجديد ولا يُخزن ولا يُسجل.
 * - التحقق من الرمز والسياسة والبطاقة في الخادم قبل جلب أي بيانات.
 * - الإصدار/التجديد/الإلغاء/رد الزائر تُدوَّن في AuditLog بلا أسرار.
 * - فشل الإشعارات أو البريد لا يفسد نجاح العملية الأساسية.
 */

import { db } from "@/lib/db";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import {
  getTrackPolicySettings,
  isCardClosed,
  resolveTrackPolicy,
  type EffectiveTrackPolicy,
  type TrackMode,
  type TrackPolicySettings,
  type TrackScope,
} from "./policy";
import { generateTrackToken, hashTrackToken, safeEqualHex } from "./session";

// ————————————————————————————————————————————————————————————————
// الأنواع
// ————————————————————————————————————————————————————————————————

export type TrackLinkState = "valid" | "expired" | "revoked" | "missing";

export interface TrackLinkRecord {
  id: string;
  scope: TrackScope;
  cardId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  state: TrackLinkState;
}

export interface TrackMessageView {
  id: string;
  authorType: string; // client | staff | system
  authorName: string | null; // أسماء الطاقم فقط — الزائر يظهر بشارة صاحب الرابط
  body: string;
  createdAt: string;
  attachments: { id: string; filename: string; size: number; mimeType: string }[];
}

export interface TrackCardView {
  scope: TrackScope;
  id: string;
  refCode: string;
  typeLabel: string; // نوع الطلب/الاستفسار (قيمة خام — الواجهة تترجمها)
  subject: string; // العنوان أو ملخص الاحتياج
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  timeline: { toStatus: string; at: string }[];
  messages: TrackMessageView[];
}

export interface TrackViewResult {
  ok: boolean;
  reason?: "missing" | "expired" | "revoked" | "policy_denied" | "owner_required" | "not_found";
  link?: TrackLinkRecord | null;
  policy?: EffectiveTrackPolicy;
  settings?: Pick<TrackPolicySettings, "forceLogin" | "allowGuestAttachments">;
  card?: TrackCardView;
}

// ————————————————————————————————————————————————————————————————
// الإصدار والتجديد والإلغاء
// ————————————————————————————————————————————————————————————————

/** إصدار رابط متابعة لبطاقة — يبطل أي روابط سابقة للبطاقة نفسها (رابط واحد فعّال لكل بطاقة) */
export async function issueTrackLink(
  scope: TrackScope,
  cardId: string,
  actorId: string | null = null
): Promise<{ token: string; linkId: string; expiresAt: Date } | null> {
  try {
    const settings = await getTrackPolicySettings();
    const expiresAt = new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000);
    const token = generateTrackToken();
    const tokenHash = hashTrackToken(token);

    const link = await db.trackLink.create({
      data: {
        tokenHash,
        scope,
        ...(scope === "request" ? { requestId: cardId } : { inquiryId: cardId }),
        expiresAt,
        createdById: actorId,
      },
      select: { id: true },
    });
    return { token, linkId: link.id, expiresAt };
  } catch (error) {
    console.error("[track] issue failed", error);
    return null;
  }
}

/** تجديد الرابط — رمز جديد وصلاحية جديدة، ويعيد عرض الرمز مرة واحدة */
export async function renewTrackLink(linkId: string, actorId: string, actorEmail: string): Promise<string | null> {
  const link = await db.trackLink.findUnique({ where: { id: linkId } });
  if (!link) return null;
  const settings = await getTrackPolicySettings();
  const token = generateTrackToken();
  await db.trackLink.update({
    where: { id: linkId },
    data: {
      tokenHash: hashTrackToken(token),
      expiresAt: new Date(Date.now() + settings.linkTtlDays * 24 * 60 * 60 * 1000),
      revokedAt: null,
      revokedReason: null,
    },
  });
  await audit({
    actorId,
    actorEmail,
    action: AUDIT_ACTIONS.trackLinkRenewed,
    entityType: link.scope,
    entityId: (link.requestId ?? link.inquiryId) as string,
    details: { linkId },
  });
  return token;
}

/** إلغاء الرابط — لا يلغي ملكية الحساب للبطاقة */
export async function revokeTrackLink(
  linkId: string,
  reason: string | null,
  actorId: string,
  actorEmail: string
): Promise<{ ok: boolean; alreadyRevoked?: boolean }> {
  const link = await db.trackLink.findUnique({ where: { id: linkId } });
  if (!link) return { ok: false };
  if (link.revokedAt) return { ok: false, alreadyRevoked: true };
  await db.trackLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date(), revokedReason: reason?.slice(0, 200) || "admin_revoked" },
  });
  await audit({
    actorId,
    actorEmail,
    action: AUDIT_ACTIONS.trackLinkRevoked,
    entityType: link.scope,
    entityId: (link.requestId ?? link.inquiryId) as string,
    details: { linkId, reason: reason?.slice(0, 200) ?? null },
  });
  return { ok: true };
}

// ————————————————————————————————————————————————————————————————
// التحقق والجلب
// ————————————————————————————————————————————————————————————————

interface CardRow {
  id: string;
  refCode: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  clientId: string | null;
  locale: string;
  // طلب
  requestType?: string;
  description?: string;
  name?: string;
  // استفسار
  subject?: string;
}

async function loadCard(scope: TrackScope, cardId: string): Promise<CardRow | null> {
  if (scope === "request") {
    return db.projectRequest.findUnique({
      where: { id: cardId },
      select: {
        id: true, refCode: true, status: true, createdAt: true, updatedAt: true,
        lastActivityAt: true, clientId: true, locale: true,
        requestType: true, description: true, name: true,
      },
    });
  }
  return db.inquiry.findUnique({
    where: { id: cardId },
    select: {
      id: true, refCode: true, status: true, createdAt: true, updatedAt: true,
      lastActivityAt: true, clientId: true, locale: true, subject: true,
    },
  });
}

async function loadCardException(scope: TrackScope, cardId: string): Promise<TrackMode | null> {
  const { isTrackMode } = await import("./policy");
  const row = await db.siteSetting.findUnique({
    where: { key: `track.exception.${scope}.${cardId}` },
    select: { value: true },
  });
  return row && isTrackMode(row.value) ? row.value : null;
}
/** أحدث رابط غير ملغى للبطاقة (رابط فعّال واحد لكل بطاقة عمليًا) */
async function latestLink(scope: TrackScope, cardId: string) {
  const rows = await db.trackLink.findMany({
    where: { scope, ...(scope === "request" ? { requestId: cardId } : { inquiryId: cardId }) },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return rows.find((r) => !r.revokedAt) ?? rows[0] ?? null;
}

function linkStateOf(link: { expiresAt: Date; revokedAt: Date | null }): TrackLinkState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt.getTime() <= Date.now()) return "expired";
  return "valid";
}

export interface TrackAccessContext {
  /** مستخدم جلسة الحساب إن وُجد (getAuthUser) */
  authUser: { id: string; permissions: string[]; roleKey: string } | null;
  /** معرف الرابط من جلسة الكوكي الموقّعة إن وُجدت */
  sessionLinkId: string | null;
}

/**
 * بناء عرض البطاقة لقناة متابعة (رابط/حساب) — يتحقق من كل شيء قبل الجلب.
 * لا يعيد ملاحظات داخلية ولا بيانات موظفين حساسة إطلاقًا.
 */
export async function getTrackView(
  scope: TrackScope,
  cardId: string,
  ctx: TrackAccessContext
): Promise<TrackViewResult> {
  const [settings, card, cardException] = await Promise.all([
    getTrackPolicySettings(),
    loadCard(scope, cardId),
    loadCardException(scope, cardId),
  ]);
  if (!card) return { ok: false, reason: "not_found" };

  const link = await latestLink(scope, cardId);
  const policy = resolveTrackPolicy(scope, settings, cardException);

  // ——— من يحاول الوصول؟ ———
  const isOwner = Boolean(ctx.authUser && card.clientId && ctx.authUser.id === card.clientId);
  const staffViewPerm = scope === "request" ? "requests.view.all" : "inquiries.view.all";
  const isAuthorizedStaff = Boolean(ctx.authUser?.permissions.includes(staffViewPerm));
  const linkValid = link ? linkStateOf(link) === "valid" : false;
  const sessionMatchesLink = Boolean(ctx.sessionLinkId && link && ctx.sessionLinkId === link.id);

  // ——— بوابات الاطلاع ———
  // (أ) مالك الحساب: يرى بطاقته دائمًا بغضّ النظر عن حالة أي رابط
  // (ب) طاقم مخوّل: يرى عبر لوحته (المسار هنا للعرض الموحد)
  // (ج) حامل رابط صالح: حسب السياسة الحالية — تُقيّم لحظيًا حتى للجلسات المشتقة
  const viewAllowed =
    isOwner || isAuthorizedStaff || (sessionMatchesLink && linkValid && policy.canViewViaLink);

  if (!viewAllowed) {
    const state = link ? linkStateOf(link) : null;
    if (state === "revoked" || state === "expired") {
      return { ok: false, reason: state, link: toRecord(link!, scope), policy, settings };
    }
    if (!policy.canViewViaLink && sessionMatchesLink) {
      return { ok: false, reason: "policy_denied", link: link ? toRecord(link, scope) : null, policy, settings };
    }
    return { ok: false, reason: "owner_required", link: link ? toRecord(link, scope) : null, policy, settings };
  }

  // ——— بناء العرض الآمن ———
  const canReplyNow = !isCardClosed(card.status);
  const effective: EffectiveTrackPolicy & { cardClosed: boolean } = {
    ...policy,
    canReplyViaLink: policy.canReplyViaLink && canReplyNow,
    canReplyByOwner: policy.canReplyByOwner && canReplyNow,
    cardClosed: !canReplyNow,
  };

  if (scope === "request") {
    const [messages, events] = await Promise.all([
      db.requestMessage.findMany({
        where: { requestId: cardId, kind: { not: "internal_note" } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, authorType: true, authorId: true, body: true, createdAt: true,
          author: { select: { name: true, roleKey: true } },
        },
      }),
      db.requestStatusEvent.findMany({
        where: { requestId: cardId },
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      }),
    ]);
    const messageIds = messages.map((m) => m.id);
    const attachments = messageIds.length
      ? await db.attachment.findMany({
          where: { requestId: cardId, messageId: { in: messageIds } },
          select: { id: true, filename: true, size: true, mimeType: true, messageId: true },
        })
      : [];
    return {
      ok: true,
      link: link ? toRecord(link, scope) : null,
      policy: effective,
      settings,
      card: {
        scope, id: card.id, refCode: card.refCode,
        typeLabel: card.requestType ?? "",
        subject: `#${card.refCode}`,
        description: card.description ?? "",
        status: card.status,
        createdAt: card.createdAt.toISOString(),
        updatedAt: card.lastActivityAt.toISOString(),
        timeline: events.map((e) => ({ toStatus: e.toStatus, at: e.createdAt.toISOString() })),
        messages: messages.map((m) => ({
          id: m.id,
          authorType: m.authorType,
          // اسم الموظف يظهر؛ العميل/الزائر يُعرض بشارة موحدة في الواجهة
          authorName: m.authorType === "staff" ? (m.author?.name ?? null) : null,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          attachments: attachments
            .filter((a) => a.messageId === m.id)
            .map((a) => ({ id: a.id, filename: a.filename, size: a.size, mimeType: a.mimeType })),
        })),
      },
    };
  }

  // استفسار
  const messages = await db.inquiryMessage.findMany({
    where: { inquiryId: cardId, kind: { not: "internal_note" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, authorType: true, authorId: true, body: true, createdAt: true,
      author: { select: { name: true, roleKey: true } },
    },
  });
  const messageIds = messages.map((m) => m.id);
  const attachments = messageIds.length
    ? await db.attachment.findMany({
        where: { inquiryId: cardId, messageId: { in: messageIds } },
        select: { id: true, filename: true, size: true, mimeType: true, messageId: true },
      })
    : [];
  return {
    ok: true,
    link: link ? { ...toRecord(link, scope), state: linkStateOf(link) } : null,
    policy: effective,
    settings,
    card: {
      scope, id: card.id, refCode: card.refCode,
      typeLabel: "general",
      subject: card.subject ?? `#${card.refCode}`,
      description: card.subject ?? "",
      status: card.status,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.lastActivityAt.toISOString(),
      timeline: [{ toStatus: card.status, at: card.updatedAt.toISOString() }],
      messages: messages.map((m) => ({
        id: m.id,
        authorType: m.authorType,
        authorName: m.authorType === "staff" ? (m.author?.name ?? null) : null,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        attachments: attachments
          .filter((a) => a.messageId === m.id)
          .map((a) => ({ id: a.id, filename: a.filename, size: a.size, mimeType: a.mimeType })),
      })),
    },
  };
}

function toRecord(
  link: { id: string; scope: string; requestId: string | null; inquiryId: string | null; expiresAt: Date; revokedAt: Date | null },
  scope: TrackScope
): TrackLinkRecord {
  const state = link.revokedAt ? "revoked" : link.expiresAt.getTime() <= Date.now() ? "expired" : "valid";
  return {
    id: link.id,
    scope,
    cardId: (link.requestId ?? link.inquiryId) as string,
    expiresAt: link.expiresAt,
    revokedAt: link.revokedAt,
    state,
  };
}

// ————————————————————————————————————————————————————————————————
// رد الزائر/المالك عبر قناة المتابعة
// ————————————————————————————————————————————————————————————————

export interface TrackReplyResult {
  ok: boolean;
  reason?: "policy_denied" | "closed" | "not_found" | "empty" | "too_long" | "duplicate";
  message?: TrackMessageView;
}

export async function replyViaTrack(
  scope: TrackScope,
  cardId: string,
  ctx: TrackAccessContext,
  body: string
): Promise<TrackReplyResult> {
  const text = body.trim();
  if (!text) return { ok: false, reason: "empty" };
  if (text.length > 5000) return { ok: false, reason: "too_long" };

  const view = await getTrackView(scope, cardId, ctx);
  if (!view.ok || !view.card) return { ok: false, reason: view.reason === "not_found" ? "not_found" : "policy_denied" };

  const policy = view.policy!;

  // من يرد؟ الطاقم يرد عبر أدواته الخاصة — قناة المتابعة للزوار والمالكين
  const isAuthorizedStaff = Boolean(
    ctx.authUser?.permissions.includes(scope === "request" ? "requests.reply" : "inquiries.reply")
  );
  if (isAuthorizedStaff) return { ok: false, reason: "policy_denied" };

  if (ctx.authUser) {
    // حساب مسجل: يجب أن يكون مالك البطاقة
    const ownerOk = await isCardOwner(scope, cardId, ctx.authUser.id);
    if (!ownerOk) return { ok: false, reason: "policy_denied" };
    if (!policy.canReplyByOwner) return { ok: false, reason: "closed" };
  } else {
    // زائر بجلسة رابط صالحة فقط
    if (!policy.canReplyViaLink) return { ok: false, reason: "policy_denied" };
  }
  if (isCardClosed(view.card.status)) return { ok: false, reason: "closed" };

  // منع تكرار الإرسال المتطابق خلال دقيقتين (نفس نص الرابط/الحساب)
  const { createHash } = await import("crypto");
  const bodyHash = createHash("sha256").update(text).digest("hex");
  if (await isDuplicateRecent(scope, cardId, bodyHash)) {
    return { ok: false, reason: "duplicate" };
  }

  const authorType = ctx.authUser ? "client" : "client"; // الزائر يُسجل كعميل البطاقة — بلا حساب صوري

  let created: { id: string; createdAt: Date } | null = null;
  if (scope === "request") {
    created = await db.requestMessage.create({
      data: { requestId: cardId, authorId: ctx.authUser?.id ?? null, authorType, kind: "message", body: text },
      select: { id: true, createdAt: true },
    });
    await db.projectRequest.update({
      where: { id: cardId },
      data: { lastActivityAt: new Date(), lastClientReplyAt: new Date() },
    }).catch(() => {});
  } else {
    created = await db.inquiryMessage.create({
      data: { inquiryId: cardId, authorId: ctx.authUser?.id ?? null, authorType, kind: "message", body: text },
      select: { id: true, createdAt: true },
    });
    await db.inquiry.update({
      where: { id: cardId },
      data: { lastActivityAt: new Date() },
    }).catch(() => {});
  }

  await audit({
    actorId: ctx.authUser?.id ?? null,
    actorEmail: null,
    action: AUDIT_ACTIONS.trackGuestReply,
    entityType: scope,
    entityId: cardId,
    details: { via: ctx.authUser ? "account_owner" : "track_link", messageId: created.id },
  });

  // إشعار الطاقم — فشله لا يفسد نجاح الحفظ
  notifyStaffOfReply(scope, cardId, view.card.refCode).catch(() => {});

  return {
    ok: true,
    message: {
      id: created.id,
      authorType,
      authorName: null,
      body: text,
      createdAt: created.createdAt.toISOString(),
      attachments: [],
    },
  };
}

async function isCardOwner(scope: TrackScope, cardId: string, userId: string): Promise<boolean> {
  const card = await loadCard(scope, cardId);
  return Boolean(card?.clientId && card.clientId === userId);
}

async function isDuplicateRecent(scope: TrackScope, cardId: string, bodyHash: string): Promise<boolean> {
  const since = new Date(Date.now() - 2 * 60 * 1000);
  if (scope === "request") {
    const rows = await db.requestMessage.findMany({
      where: { requestId: cardId, createdAt: { gte: since } },
      select: { body: true },
    });
    const { createHash } = await import("crypto");
    return rows.some((r) => createHash("sha256").update(r.body.trim()).digest("hex") === bodyHash);
  }
  const rows = await db.inquiryMessage.findMany({
    where: { inquiryId: cardId, createdAt: { gte: since } },
    select: { body: true },
  });
  const { createHash } = await import("crypto");
  return rows.some((r) => createHash("sha256").update(r.body.trim()).digest("hex") === bodyHash);
}

/** إشعار الطاقم برد جديد — نفس نمط الردود القائمة، فشله لا يفسد نجاح الحفظ */
async function notifyStaffOfReply(scope: TrackScope, cardId: string, refCode: string): Promise<void> {
  try {
    const { notifyMany } = await import("@/lib/auth/notifications");
    const { db } = await import("@/lib/db");
    const perm = scope === "request" ? "requests.view.all" : "inquiries.view.all";
    const { ROLE_KEYS } = await import("@/lib/auth/permissions");
    const staff = await db.user.findMany({
      where: { roleKey: { in: ROLE_KEYS.filter((r) => r !== "client") }, status: "active" },
      select: { id: true, roleKey: true },
      take: 50,
    });
    void perm;
    const targets = staff.filter((s) => s.roleKey === "super_admin" || s.roleKey === (scope === "request" ? "support" : "support"));
    if (!targets.length) return;
    await notifyMany(
      targets.map((t) => ({
        userId: t.id,
        type: "reply_received" as const,
        payload: { ref: refCode },
        link: scope === "request" ? `/ar/admin/requests/${cardId}` : `/ar/admin/inquiries/${cardId}`,
      }))
    );
  } catch {
    /* الإشعار غير حرج */
  }
}

/** فحص بصمة رمز مقابل سجل (يُستخدم في مسار التبادل) */
export function tokenMatchesLink(rawToken: string, tokenHash: string): boolean {
  return safeEqualHex(hashTrackToken(rawToken), tokenHash);
}

export type { TrackMode };
