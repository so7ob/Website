import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SYSTEM_ROLES, type AuthUser } from "../auth/permissions";
const fake = vi.hoisted(() => ({ user: vi.fn(), attachment: vi.fn(), read: vi.fn(), page: vi.fn(), userCount: vi.fn(), requestCount: vi.fn(), requestGroup: vi.fn(), requestList: vi.fn(), inquiryCount: vi.fn(), pageCount: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: fake.user, guardApi: async () => ({ ok: true, user: await fake.user() }), json: (data: unknown) => Response.json(data) }));
vi.mock("@/lib/db", () => ({ db: {
  attachment: { findUnique: fake.attachment }, page: { findFirst: fake.page, count: fake.pageCount },
  user: { count: fake.userCount }, projectRequest: { count: fake.requestCount, groupBy: fake.requestGroup, findMany: fake.requestList },
  inquiry: { count: fake.inquiryCount }, auditLog: { findMany: fake.audit },
} }));
vi.mock("@/lib/file-storage", () => ({ readFileBuffer: fake.read }));
import { GET as attachment } from "@/app/api/attachments/[id]/route";
import { GET as dashboard } from "@/app/api/admin/dashboard/route";
import { generateMetadata } from "@/app/[locale]/[[...slug]]/page";
function viewer(roleKey: string): AuthUser { return { id: "owner", roleKey, status: "active", email: "synthetic@example.invalid", name: "Synthetic", locale: "ar", emailVerified: true, permissions: SYSTEM_ROLES.find(role => role.key === roleKey)?.permissions ?? [] }; }
afterEach(() => vi.resetAllMocks());
describe("server-side private responses", () => {
  it("allows the inquiry owner to download a staff-uploaded attachment", async () => {
    fake.user.mockResolvedValue(viewer("client")); fake.attachment.mockResolvedValue({ request: null, inquiry: { clientId: "owner" }, uploaderId: "staff", storedName: "synthetic.txt", mimeType: "text/plain", filename: "test.txt" }); fake.read.mockReturnValue(Buffer.from("synthetic"));
    const response = await attachment(new NextRequest("http://localhost/api/attachments/abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it.each(["client", "content_editor"])("denies unrelated %s before reading attachment bytes", async role => {
    fake.user.mockResolvedValue(viewer(role)); fake.attachment.mockResolvedValue({ request: null, inquiry: { clientId: "other" }, uploaderId: "owner" });
    const response = await attachment(new NextRequest("http://localhost/api/attachments/abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(response.status).toBe(403); expect(fake.read).not.toHaveBeenCalled();
  });
  it("denies suspended access before looking up any attachment", async () => {
    fake.user.mockResolvedValue({ ...viewer("client"), status: "suspended" });
    const response = await attachment(new NextRequest("http://localhost/api/attachments/abc"), { params: Promise.resolve({ id: "abc" }) });
    expect(response.status).toBe(401); expect(fake.attachment).not.toHaveBeenCalled();
  });
  it.each(["ar", "en"])("hides restricted SEO from anonymous and disallowed staff in %s", async locale => {
    fake.page.mockResolvedValue({ visibility: "role", allowedRoles: '["support"]', seoTitleAr: "SECRET", seoTitleEn: "SECRET" });
    for (const user of [null, viewer("content_editor")]) {
      fake.user.mockResolvedValue(user);
      expect(await generateMetadata({ params: Promise.resolve({ locale, slug: ["private"] }) })).toEqual({ robots: { index: false, follow: false } });
    }
  });
  it("never queries private dashboard tables for content editors", async () => {
    fake.user.mockResolvedValue(viewer("content_editor")); fake.pageCount.mockResolvedValue(2);
    const result = await (await dashboard(new NextRequest("http://localhost/api/admin/dashboard"))).json();
    expect(result.metrics.totalUsers).toBeNull(); expect(result.recentRequests).toEqual([]); expect(result.recentActivity).toEqual([]);
    for (const query of [fake.userCount, fake.requestCount, fake.requestGroup, fake.requestList, fake.inquiryCount, fake.audit]) expect(query).not.toHaveBeenCalled();
    expect(result.metrics.publishedPages).toBe(2);
  });
});
