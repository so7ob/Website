import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";

const isolated = await vi.hoisted(async () => {
  // Only a fresh synthetic database; never inherit DATABASE_URL from the caller.
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "so7ob-tokens-"));
  const database = path.join(root, "fixture.db");
  fs.writeFileSync(database, "");
  process.env.DATABASE_URL = `file:${database}`;
  return { root };
});
vi.mock("@/lib/auth/session", () => ({ assertSameOrigin: () => true }));
vi.mock("@/lib/auth/audit", () => ({ audit: vi.fn(), AUDIT_ACTIONS: {} }));
import { rmSync } from "node:fs";
import { db } from "../db";
import { issueToken, consumeToken, sha256, TOKEN_TTL } from "../auth/tokens";
import { beginClaim, completeClaim } from "../auth/claims";
import { POST as acceptInvite } from "@/app/api/auth/invite/route";

let serial = 0;
async function user(status = "active") {
  return db.user.create({ data: { email: `synthetic-${++serial}@example.invalid`, name: "Synthetic", passwordHash: "not-a-password-hash", status, roleKey: "client" } });
}
async function request() {
  return db.projectRequest.create({ data: { refCode: `TEST-${++serial}`, requestType: "quote", serviceType: "web", description: "Synthetic request", budget: "unspecified", timeline: "flexible", name: "Synthetic", email: "synthetic@example.invalid", preferredContact: "email", descriptionHash: "synthetic" } });
}
beforeAll(async () => {
  execFileSync("bun", ["x", "--no-install", "prisma", "migrate", "deploy"], { env: process.env, stdio: "pipe" });
  await db.role.create({ data: { key: "client", nameAr: "اختبار", nameEn: "Test" } });
}, 30000);
afterAll(async () => { await db.$disconnect(); rmSync(isolated.root, { recursive: true, force: true }); });

describe("resource-bound claims on SQLite", () => {
  it("rejects swapped reference and user without consuming the valid token", async () => {
    const owner = await user(); const other = await user();
    const a = await request(); const b = await request();
    const first = (await beginClaim(owner.id, a.refCode))!;
    const second = (await beginClaim(owner.id, b.refCode))!;
    expect(await completeClaim(owner.id, second.token.raw, a.refCode)).toBeNull();
    expect(await completeClaim(other.id, first.token.raw, a.refCode)).toBeNull();
    expect((await completeClaim(owner.id, first.token.raw, a.refCode))?.id).toBe(a.id);
    expect((await completeClaim(owner.id, second.token.raw, b.refCode))?.id).toBe(b.id);
  });
  it("allows exactly one claim and one history event across ten simultaneous requests", async () => {
    const owner = await user(); const resource = await request();
    const started = (await beginClaim(owner.id, resource.refCode))!;
    const results = await Promise.all(Array.from({ length: 10 }, () => completeClaim(owner.id, started.token.raw, resource.refCode)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await db.requestMessage.count({ where: { requestId: resource.id } })).toBe(1);
    expect((await db.projectRequest.findUniqueOrThrow({ where: { id: resource.id } })).clientId).toBe(owner.id);
  });
  it("does not consume or transfer a suspended user's claim", async () => {
    const owner = await user(); const resource = await request();
    const started = (await beginClaim(owner.id, resource.refCode))!;
    await db.user.update({ where: { id: owner.id }, data: { status: "suspended" } });
    expect(await completeClaim(owner.id, started.token.raw, resource.refCode)).toBeNull();
    expect(await beginClaim(owner.id, resource.refCode)).toBeNull();
    expect((await db.projectRequest.findUniqueOrThrow({ where: { id: resource.id } })).clientId).toBeNull();
  });
  it("rejects archived and already-owned requests and rolls token consumption back", async () => {
    const owner = await user(); const other = await user(); const resource = await request();
    const started = (await beginClaim(owner.id, resource.refCode))!;
    await db.projectRequest.update({ where: { id: resource.id }, data: { clientId: other.id } });
    expect(await completeClaim(owner.id, started.token.raw, resource.refCode)).toBeNull();
    expect((await db.authToken.findUniqueOrThrow({ where: { tokenHash: sha256(started.token.raw) } })).usedAt).toBeNull();
    await db.projectRequest.update({ where: { id: resource.id }, data: { clientId: null, archivedAt: new Date() } });
    expect(await completeClaim(owner.id, started.token.raw, resource.refCode)).toBeNull();
    expect(await beginClaim(owner.id, resource.refCode)).toBeNull();
  });
  it("allows a new claimant after pending expiry and rejects legacy unbound tokens", async () => {
    const owner = await user(); const other = await user(); const resource = await request();
    const initial = (await beginClaim(owner.id, resource.refCode))!;
    expect(await beginClaim(other.id, resource.refCode)).toBeNull();
    await db.authToken.updateMany({ where: { userId: owner.id }, data: { expiresAt: new Date(0) } });
    const renewed = (await beginClaim(other.id, resource.refCode))!;
    expect(renewed).not.toBeNull();
    expect(await completeClaim(owner.id, initial.token.raw, resource.refCode)).toBeNull();
    const legacy = "a".repeat(64);
    await db.authToken.create({ data: { userId: other.id, tokenHash: sha256(legacy), type: "request_claim", expiresAt: new Date(Date.now() + TOKEN_TTL.request_claim) } });
    expect(await completeClaim(other.id, legacy, resource.refCode)).toBeNull();
    expect((await completeClaim(other.id, renewed.token.raw, resource.refCode))?.id).toBe(resource.id);
  });
  it("resending invalidates only the same resource's token", async () => {
    const owner = await user(); const a = await request(); const b = await request();
    const first = (await beginClaim(owner.id, a.refCode))!;
    const second = (await beginClaim(owner.id, b.refCode))!;
    const replacement = (await beginClaim(owner.id, a.refCode))!;
    expect(await completeClaim(owner.id, first.token.raw, a.refCode)).toBeNull();
    expect(await completeClaim(owner.id, replacement.token.raw, a.refCode)).not.toBeNull();
    expect(await completeClaim(owner.id, second.token.raw, b.refCode)).not.toBeNull();
  });
});

describe("one-time account tokens and invites", () => {
  it.each(["password_reset", "email_verify"] as const)("consumes %s once under concurrency", async type => {
    const owner = await user(); const token = await issueToken(owner.id, type);
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeToken(token.raw, type)));
    expect(results.filter(Boolean)).toEqual([owner.id]);
  });
  it("rolls consumption back with the business transaction", async () => {
    const owner = await user(); const token = await issueToken(owner.id, "password_reset");
    await expect(db.$transaction(async tx => {
      expect(await consumeToken(token.raw, "password_reset", { tx })).toBe(owner.id);
      throw new Error("synthetic failure");
    })).rejects.toThrow("synthetic failure");
    expect(await consumeToken(token.raw, "password_reset")).toBe(owner.id);
  });
  it("rejects expired and wrong-purpose tokens", async () => {
    const owner = await user(); const token = await issueToken(owner.id, "password_reset");
    expect(await consumeToken(token.raw, "email_verify")).toBeNull();
    await db.authToken.updateMany({ where: { userId: owner.id }, data: { expiresAt: new Date(0) } });
    expect(await consumeToken(token.raw, "password_reset")).toBeNull();
  });
  it("accepts one invitation once with account creation in the same transaction", async () => {
    const raw = "b".repeat(64);
    await db.userInvite.create({ data: { tokenHash: sha256(raw), email: "invite@example.invalid", roleKey: "client", expiresAt: new Date(Date.now() + 60000) } });
    const results = await Promise.all(Array.from({ length: 10 }, () => acceptInvite(new NextRequest("http://localhost/api/auth/invite", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: raw, name: "Synthetic", password: "Synthetic-fixture-4829" }),
    }))));
    expect(results.filter(response => response.status === 201)).toHaveLength(1);
    expect(results.filter(response => response.status === 400)).toHaveLength(9);
    expect(await db.user.count({ where: { email: "invite@example.invalid" } })).toBe(1);
  }, 30000);
});
