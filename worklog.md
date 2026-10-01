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

---
Task ID: 5-a
Agent: block-renderers
Task: Create CMS block renderer components

Work Log:
- Read types.ts (28 block schemas), all original section components (home/, pages/, works/, site/), ProjectRequestForm, FaqAccordion, ServiceIcon, CaseVisual, CloudHeroArt, BookingPrototype, content ar/en, i18n helpers
- Created src/components/blocks/ with 31 files: PageRenderer dispatcher + 28 per-block renderers + shared helpers (BlockLink, BlockContainer) + request-form-shell (client)
- Dispatcher: CSS-only device visibility (max-md:hidden / md:max-lg:hidden / lg:hidden), style wrapper (bg default/white/accent-50/navy/brand-soft-30 + paddingY none/sm/md/lg), anchorId on outermost section; style absent/default → render bare (original own Section padding)
- Renderers are exact markup clones of originals taking (props, locale); props typed via z.input<typeof blockSchemas.X>["props"] (type-only imports, zero runtime zod), dispatcher casts block.props
- UI action labels (discuss/quote/learnMore/requestService/viewAll*/works disclaimer/form services names/contact privacy+nextSteps/process changes CTA) come from @/content/ar|en translations — no hardcoded bilingual strings in components
- Client components only where original was client: hero-block (framer-motion), request-form-shell (wraps ProjectRequestForm; preselectService applied via ?service= URL param with router.replace so the existing form picks it up without modification)
- requestForm block keeps ContactPage layout: Section + lg:grid-[1.35fr/0.65fr] + Suspense + optional nextSteps/privacy cards (showPrivacy/showNextSteps props)
- All internal links locale-prefixed (localePath or BlockLink/localizeHref); external http(s) links get target=_blank rel=noopener noreferrer; mailto/tel plain <a>; plain <img> used for CMS images (no next/image domain config issues, eslint rule disabled in repo config)
- Generic blocks (heading/text/image/gallery/buttonLink/columns/simpleTable/divider/spacer) use BlockContainer (max-w-7xl px + py-8); richText uses Section per original site rhythm; shadcn Table for simpleTable

Stage Summary:
- 31 files created in src/components/blocks/ (list in agent-ctx/5-a-block-renderers.md)
- bunx tsc --noEmit: 0 errors in blocks files (only pre-existing unrelated .next/dev/types/validator.ts error remains)
- bunx eslint src/components/blocks: clean (0 problems)
- No files modified outside src/components/blocks/; types.ts untouched; no test files
- Next: seed content task (5-b) + /[locale]/[slug] page route consuming PageRenderer
