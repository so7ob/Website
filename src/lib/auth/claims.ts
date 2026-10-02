import { db } from "@/lib/db";
import { consumeToken, issueToken, TOKEN_TTL } from "./tokens";

class InvalidClaim extends Error {}

/** Reserve an unowned resource. Expired/legacy pending reservations are replaceable. */
export async function beginClaim(userId: string, refCode: string) {
  return db.$transaction(async tx => {
    // A conditional write before reads serializes reservations in SQLite.
    const request = await tx.projectRequest.updateMany({ where: { refCode, clientId: null, archivedAt: null }, data: { clientId: null } });
    if (request.count !== 1) return null;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status === "suspended") return null;
    const resource = await tx.projectRequest.findUniqueOrThrow({ where: { refCode }, include: { claim: true } });
    const previous = resource.claim;
    if (previous?.status === "verified") return null;
    if (previous && previous.userId !== userId) {
      const live = await tx.authToken.count({ where: { userId: previous.userId, type: "request_claim", resourceId: resource.id, usedAt: null, expiresAt: { gt: new Date() } } });
      if (live) return null;
    }
    await tx.requestClaim.upsert({ where: { requestId: resource.id },
      create: { requestId: resource.id, userId, status: "pending" },
      update: { userId, status: "pending", createdAt: new Date(), verifiedAt: null },
    });
    const token = await issueToken(userId, "request_claim", { resourceId: resource.id, tx });
    return { request: resource, token };
  });
}

/** Token consumption, ownership, claim state and history commit or roll back together. */
export async function completeClaim(userId: string, raw: string, refCode: string) {
  // Resolve the public reference before the transaction; all mutable conditions are rechecked inside.
  const request = await db.projectRequest.findUnique({ where: { refCode } });
  if (!request) return null;
  try {
    return await db.$transaction(async tx => {
      const consumed = await consumeToken(raw, "request_claim", { userId, resourceId: request.id, tx });
      if (!consumed) return null;
      const changed = await tx.projectRequest.updateMany({ where: { id: request.id, refCode, clientId: null, archivedAt: null }, data: { clientId: userId } });
      const claim = await tx.requestClaim.updateMany({
        where: { requestId: request.id, userId, status: "pending", createdAt: { gt: new Date(Date.now() - TOKEN_TTL.request_claim) } },
        data: { status: "verified", verifiedAt: new Date() },
      });
      if (changed.count !== 1 || claim.count !== 1) throw new InvalidClaim();
      await tx.requestMessage.create({ data: { requestId: request.id, authorType: "system", kind: "system", body: `claim_linked:${userId}` } });
      return request;
    });
  } catch (error) {
    if (error instanceof InvalidClaim) return null;
    throw error;
  }
}
