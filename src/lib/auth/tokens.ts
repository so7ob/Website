/**
 * رموز أحادية الاستخدام محدودة المدة — تحقق البريد، استعادة كلمة المرور، ربط الطلبات.
 * تُخزن كبصمة SHA-256 فقط؛ لا تُخزن الرموز نفسها في قاعدة البيانات.
 */
import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
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

type TokenScope = { resourceId?: string; userId?: string; tx?: Prisma.TransactionClient };

/** Reissuing a claim affects only this resource, not another request's mail. */
export async function issueToken(userId: string, type: TokenType, options: TokenScope = {}): Promise<IssuedToken> {
  if (type === "request_claim" && !options.resourceId) throw new Error("Claim tokens require a resource");
  const raw = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL[type]);
  const write = async (tx: Prisma.TransactionClient) => {
    const resourceId = options.resourceId ?? null;
    await tx.authToken.deleteMany({ where: { userId, type, resourceId, usedAt: null } });
    await tx.authToken.create({ data: { userId, type, resourceId, tokenHash: sha256(raw), expiresAt } });
    return { raw, expiresAt };
  };
  return options.tx ? write(options.tx) : db.$transaction(write);
}

/** The conditional UPDATE is the first DB operation: only one caller can consume. */
export async function consumeToken(raw: string, type: TokenType, options: TokenScope = {}): Promise<string | null> {
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) return null;
  if (type === "request_claim" && (!options.resourceId || !options.userId)) return null;
  const tokenHash = sha256(raw);
  const consume = async (tx: Prisma.TransactionClient) => {
    const changed = await tx.authToken.updateMany({
      where: {
        tokenHash, type, resourceId: options.resourceId ?? null,
        ...(options.userId ? { userId: options.userId } : {}),
        usedAt: null, expiresAt: { gt: new Date() }, user: { status: { not: "suspended" } },
      },
      data: { usedAt: new Date() },
    });
    if (changed.count !== 1) return null;
    return (await tx.authToken.findUniqueOrThrow({ where: { tokenHash } })).userId;
  };
  return options.tx ? consume(options.tx) : db.$transaction(consume);
}

/** بصمة IP مجهولة لأغراض التدقيق وحماية الإساءة — لا يُخزن العنوان نفسه */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return sha256(`ip:${ip}`);
}

export { sha256 };
