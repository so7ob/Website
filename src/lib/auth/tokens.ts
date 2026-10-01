/**
 * رموز أحادية الاستخدام محدودة المدة — تحقق البريد، استعادة كلمة المرور، ربط الطلبات.
 * تُخزن كبصمة SHA-256 فقط؛ لا تُخزن الرموز نفسها في قاعدة البيانات.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const TOKEN_TTL = {
  email_verify: 1000 * 60 * 60 * 24, // 24 ساعة
  password_reset: 1000 * 60 * 30, // 30 دقيقة
  request_claim: 1000 * 60 * 60 * 24, // 24 ساعة
} as const;

export type TokenType = keyof typeof TOKEN_TTL;

export interface IssuedToken {
  raw: string; // يُرسل بالبريد فقط ولا يُخزن
  expiresAt: Date;
}

/** يُصدر رمزًا جديدًا لغرض محدد — يبطل أي رموز سابقة من نفس النوع لنفس المستخدم */
export async function issueToken(userId: string, type: TokenType): Promise<IssuedToken> {
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL[type]);
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(raw), expiresAt } });
  return { raw, expiresAt };
}

/** يتحقق من رمز ويستهلكه (أحادي الاستخدام) — يرجع userId عند النجاح فقط */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  if (!raw || typeof raw !== "string" || raw.length > 200) return null;
  const tokenHash = sha256(raw);
  const record = await db.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.type !== type) return null;
  if (record.usedAt || record.expiresAt.getTime() < Date.now()) {
    // رمز مستهلك أو منتهٍ — نبطله إن كان صالح الشكل
    if (!record.usedAt) await db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return null;
  }
  const ok = timingSafeEqual(Buffer.from(record.tokenHash, "hex"), Buffer.from(tokenHash, "hex"));
  if (!ok) return null;
  await db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.userId;
}

/** بصمة IP مجهولة لأغراض التدقيق وحماية الإساءة — لا يُخزن العنوان نفسه */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return sha256(`ip:${ip}`);
}

export { sha256 };
