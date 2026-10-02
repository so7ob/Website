import { describe, expect, it } from "vitest";
import { canAccessInquiry, canAccessPage, dashboardAccess } from "../auth/resource-access";
import { SYSTEM_ROLES, type AuthUser } from "../auth/permissions";
function user(roleKey: string, status = "active"): AuthUser {
  return { id: "owner", roleKey, status, email: "synthetic@example.invalid", name: "Synthetic", locale: "ar", emailVerified: true, permissions: SYSTEM_ROLES.find(role => role.key === roleKey)?.permissions ?? [] };
}
describe("private resource policies", () => {
  it.each(["super_admin", "ops_manager", "support", "content_editor", "client"])("enforces inquiry access for %s", role => {
    const viewer = user(role);
    expect(canAccessInquiry(viewer, { clientId: "other" })).toBe(["super_admin", "ops_manager", "support"].includes(role));
    expect(canAccessInquiry(viewer, { clientId: viewer.id })).toBe(true);
    expect(canAccessInquiry(user(role, "suspended"), { clientId: viewer.id })).toBe(false);
  });
  it("does not grant every staff role a role-restricted page", () => {
    const page = { visibility: "role", allowedRoles: '["support"]' };
    expect(canAccessPage(user("content_editor"), page)).toBe(false);
    expect(canAccessPage(user("ops_manager"), page)).toBe(false);
    expect(canAccessPage(user("support"), page)).toBe(true);
    expect(canAccessPage(user("super_admin"), page)).toBe(true);
    expect(canAccessPage(null, page)).toBe(false);
    expect(canAccessPage(user("support", "suspended"), page)).toBe(false);
  });
  it.each(['null', '{}', '[1]', 'invalid'])("fails closed for malformed role policy %s", allowedRoles => {
    expect(canAccessPage(user("support"), { visibility: "role", allowedRoles })).toBe(false);
  });
  it("permits public and authenticated policies but rejects unknown visibility", () => {
    expect(canAccessPage(null, { visibility: "public", allowedRoles: "[]" })).toBe(true);
    expect(canAccessPage(user("client"), { visibility: "authenticated", allowedRoles: "[]" })).toBe(true);
    expect(canAccessPage(null, { visibility: "authenticated", allowedRoles: "[]" })).toBe(false);
    expect(canAccessPage(user("client"), { visibility: "unknown", allowedRoles: "[]" })).toBe(false);
  });
  it("limits a content editor dashboard to pages", () => {
    expect(dashboardAccess(user("content_editor"))).toEqual({ users: false, requests: false, inquiries: false, pages: true, audit: false });
    expect(Object.values(dashboardAccess(user("super_admin", "suspended"))).every(value => !value)).toBe(true);
    expect(Object.values(dashboardAccess(user("client"))).every(value => !value)).toBe(true);
  });
});
