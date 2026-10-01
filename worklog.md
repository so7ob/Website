# so7ob — Project Worklog

---
Task ID: 0-2
Agent: main (Z.ai Code)
Task: Setup workspace, audit repo, auth foundation (schema v2 + next-auth + RBAC)

Work Log:
- Cloned so7ob/Website, replaced skeleton workspace at /home/z/my-project with repo content + git history (branch: feature/3-interactive-platform, Issue #3)
- Verified next-auth@4.24.11 works with Next 16 (login flow, csrf, getServerSession) — decision: use installed lib
- Prisma schema v2 with migrations (20261001211740_platform_v2, auth_lockout): User, Role, AuthSession, AuthToken, UserInvite, EmailLog, ProjectRequest(+new nullable fields, backward compatible), RequestMessage, RequestStatusEvent, RequestClaim, RequestDraft, Inquiry, InquiryMessage, Attachment, MediaItem, Notification, AuditLog, Page, PageVersion, PageRedirect, MenuItem, SiteSetting
- db:push no longer uses --accept-data-loss; added db:seed / admin:create / db:backup scripts
- Auth core: src/lib/auth/{options,session,permissions,tokens,email,email-templates,audit,notifications}.ts
  - JWT + AuthSession fingerprints (sha256(uid:iat)) → instant revocation on suspension/logout-all
  - Login lockout (5 fails/15min), bcrypt(12), single-use expiring tokens
  - Origin check (CSRF) for mutating APIs; email dev-outbox (EMAIL_DEV_MODE=true) — no fake send success
- API routes: /api/auth/[...nextauth], register, verify-email, forgot-password, reset-password, change-password, sessions; /api/account/profile
- Middleware protects /[locale]/account|admin (cookie presence; full checks server-side)
- Seeded system roles; created first admin via scripts/create-admin.ts (admin@so7ob.local / AdminS7ob2026!)

Stage Summary:
- Foundation ready for portal/admin/editor UIs
- Admin credentials (local dev): admin@so7ob.local / AdminS7ob2026!
- Next: block system + content seed + account/admin portals + page editor
