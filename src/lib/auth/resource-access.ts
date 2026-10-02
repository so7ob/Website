import { can, type AuthUser } from "./permissions";

export function canAccessInquiry(user: AuthUser, inquiry: { clientId: string | null }): boolean {
  if (user.status === "suspended") return false;
  return inquiry.clientId === user.id || can(user, "inquiries.view.all");
}

export function canAccessPage(user: AuthUser | null, page: { visibility: string; allowedRoles: string }): boolean {
  if (page.visibility === "public") return true;
  if (!user || user.status === "suspended") return false;
  if (user.roleKey === "super_admin") return true;
  if (page.visibility === "authenticated") return true;
  if (page.visibility !== "role") return false;
  try {
    const roles: unknown = JSON.parse(page.allowedRoles);
    return Array.isArray(roles) && roles.every(role => typeof role === "string") && roles.includes(user.roleKey);
  } catch { return false; }
}

export function dashboardAccess(user: AuthUser) {
  const active = user.status !== "suspended" && can(user, "admin.dashboard");
  return {
    users: active && can(user, "users.view"),
    requests: active && can(user, "requests.view.all"),
    inquiries: active && can(user, "inquiries.view.all"),
    pages: active && can(user, "pages.view"),
    audit: active && can(user, "audit.view"),
  };
}
