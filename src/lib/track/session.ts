/**
 * رموز وجلسات المتابعة:
 * - الرمز الخام: 32 بايت عشوائي (base64url) — يُعرض مرة واحدة عند الإنشاء ولا يُخزن.
 * - التخزين: بصمة sha256 للرمز فقط.
 * - جلسة الرابط: كوكي HttpOnly موقّع HMAC-SHA256 يحمل {lid, exp} —
 *   يُستبدل بالرمز في العنوان (يُزال من شريط العنوان بعد التبادل).
 *   ليست جلسة دخول عامة — لا تحمل هوية مستخدم ولا صلاحيات.
 * - الرابط قابل للاستخدام المتكرر حتى الانتهاء/الإلغاء (ليس لمرة واحدة).
 */

import { createHmac, randomBytes, timingSafeEqual, createHash } from "crypto";

export const TRACK_COOKIE_NAME = "so7ob_track";
/** عمر جلسة الرابط — قصيرة ومحدودة، وتُعاد أثناء كل زيارة عبر التبادل من جديد */
export const TRACK_SESSION_TTL_SEC = 12 * 60 * 60;

/**
 * سر التوقيع — نفس قرار src/lib/auth/options.ts:
 * سر احتياطي ثابت للتطوير فقط؛ الإنتاج بلا AUTH_SECRET مرفوض من next-auth أصلًا
 * ويجب ألا يوقّع هنا شيئًا.
 */
const DEV_AUTH_SECRET_FALLBACK = "ce1cfd44862e227ec0cd7d7e40d7b0145031bfaa0070fe12ecd36ce1146bcc5d";

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : DEV_AUTH_SECRET_FALLBACK);
  if (!secret) throw new Error("TRACK_SIGNING_SECRET_MISSING");
  return secret;
}

/** رمز خام جديد — 32 بايت عشوائي مشفرًا */
export function generateTrackToken(): string {
  return randomBytes(32).toString("base64url");
}

/** بصمة الرمز كما تُخزن في قاعدة البيانات */
export function hashTrackToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** مقارنة زمنية ثابتة للبصمات */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

interface TrackSessionPayload {
  lid: string; // معرف سجل الرابط
  exp: number; // انتهاء الجلسة (ثوانٍ)
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", signingSecret()).update(data).digest("base64url");
}

/** إنشاء قيمة كوكي جلسة الرابط */
export function createTrackSessionValue(linkId: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const payload: TrackSessionPayload = { lid: linkId, exp: nowSec + TRACK_SESSION_TTL_SEC };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** التحقق من قيمة كوكي الجلسة — يعيد معرف الرابط أو null */
export function verifyTrackSessionValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TrackSessionPayload;
    if (typeof payload.lid !== "string" || !payload.lid) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload.lid;
  } catch {
    return null;
  }
}

/** خيارات كوكي جلسة الرابط */
export function trackCookieOptions(maxAgeSec = TRACK_SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}
