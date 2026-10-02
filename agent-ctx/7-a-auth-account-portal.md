# Task 7-a — auth-account-portal

## Scope
Auth pages + client account portal for bilingual AR/EN (RTL/LTR) Next.js 16 App Router site.
Owned folders: `src/app/[locale]/auth/**`, `src/app/[locale]/account/**`, `src/components/account/**`, plus MINIMAL optional-prop addition to `src/components/form/project-request-form.tsx`.

## Created files

### Auth (`src/app/[locale]/auth/`)
- `layout.tsx` — centered card layout (logo→home), sonner Toaster mounted (dir-aware)
- `_components/auth-card.tsx`, `_components/text-field.tsx`, `_components/dev-link.tsx` (moved to `src/components/account/dev-link.tsx`), `_components/logout-action.tsx`
- `login/page.tsx` + `_components/login-form.tsx` — next-auth `signIn("credentials", {redirect:false})`; maps `CredentialsSignin`→auth.errors.generic; after success fetches `/api/auth/session` → roleKey !== "client" → `/{locale}/admin` else `/{locale}/account`; honors safe `?next=` (internal-only, `//` blocked); `router.refresh()`
- `register/page.tsx` + `_components/register-form.tsx` — POST /api/auth/register; maps 400 error codes + 409 email_taken + 429; success card (registerSuccessTitle/Body) + devVerifyUrl dev chip; name label passed from portal.account.profile.name (auth section has no name label)
- `forgot-password/page.tsx` + `_components/forgot-form.tsx` — always shows forgotSent; devResetUrl chip in dev mode
- `reset-password/page.tsx` + `_components/reset-form.tsx` — token from searchParams (server page); no-token → invalid card; success → toast resetSuccess + redirect login
- `verified/page.tsx` — server page reads ?status=ok|already|invalid → result card + login CTA
- `invite/page.tsx` + `_components/invite-form.tsx` — POST /api/auth/invite → login; invalid_token → errors.invalid
- `logout/page.tsx` — client signOut({callbackUrl:/{locale}}) + removes localStorage `so7ob-request-draft`

### Account (`src/app/[locale]/account/`)
- `layout.tsx` — server; getAuthUser() → redirect `/{locale}/auth/login?next=/{locale}/account` when null; renders AccountShell + Toaster
- `page.tsx` — dashboard (server, direct db queries; scope: client→clientId, staff→assigneeId): stats cards (openRequests [new,in_review,awaiting_info,in_progress,responded & !archived], awaitingReply [lastStaff>lastClient], unreadNotifications, totalRequests), recent 5 table, createRequest CTA, empty state + claim link (`?claim=open`)
- `requests/page.tsx` — Suspense + `RequestsView`
- `requests/new/page.tsx` — `NewRequestView` (server drafts)
- `requests/[id]/page.tsx` — `RequestDetailView`
- `notifications/page.tsx`, `profile/page.tsx` (server db fetch → client form), `security/page.tsx`

### Components (`src/components/account/`)
- `account-shell.tsx` — desktop sidebar (start side, sticky) + mobile top bar + Sheet drawer (side flips with RTL); nav items with lucide icons + active state; user card + roleKey badge; unread notifications polling every 30s (badge on nav + mobile bell); DraftHygiene (clears `so7ob-request-draft` on mount); amber pendingVerification banner when !emailVerified
- `requests-view.tsx` — status Tabs (all + 7 statuses) + table (refCode/service+message count/status+awaiting dot/created/lastActivity/viewDetails) + pagination (RTL chevrons) + skeletons/empty/error + claim Dialog (POST claim → claimSent + dev link) + `?claim=ok|invalid|login_required&ref=` banners + auto-open on `?claim=open`
- `new-request-view.tsx` — mounts ProjectRequestForm with `suppressLocalDraft`; GET drafts → toast draftRestored + initialValues; autosave debounced 3s via onValuesChange → PUT drafts (blocked after submit via finishedRef + timer clear); onSubmitted → DELETE drafts + toast submitSuccess + resolve id from list → own success card (refCode, link to detail, create-another resets form via key)
- `request-detail-view.tsx` — info card (status/service/priority/assignedTo/created/lastActivity/budget/currency/timeline/contactPref/reference/resolutionNote — values localized via site content form maps + admin priorities map); conversation (client bubbles end-side brand-soft, staff start-side bordered, system messages as timeline notes; internal notes excluded server-side); reply composer (textarea + attach + send; disabled when closed/cancelled with notice); attachment upload via FormData POST /api/attachments (too_large/type_not_allowed/locked mapped to toasts) + download chips `/api/attachments/[id]`; statusHistory timeline; polls every 20s (pauses when tab hidden); cancel-request dialog (PATCH action:cancel, only new/in_review/awaiting_info) ; 403/404 → error card + back link
- `notifications-view.tsx` — type icons map, payload rendering (ref chip mono, status via requests.statuses, name), unread highlight, markRead on click (POST + router.push link), markAllRead, load-more (numeric `n / total` button), empty + error states
- `profile-form.tsx` — name/phone/company + locale Select (localeMeta labels) → PATCH; email readonly + verified/notVerified badge; locale change navigates to same page under new locale
- `security-view.tsx` — change password card (POST → toast passwordChanged + passwordChangedBody → signOut to login; wrong_password/password_weak/same_password mapped) + sessions card (GET /api/auth/sessions; UA parsed to "Browser · OS" with unknownDevice fallback; current → thisDevice highlight; per-row revoke — currentRevoked → signOut; revokeAll)
- `status-badge.tsx` — color map: new→brand-soft/brand-strong, in_review→amber, awaiting_info→violet, in_progress→sky, responded→green, closed→muted, cancelled→red
- `format.ts` — date-fns formatDate/formatDateOnly/formatRelative with ar/enUS locales; formatBytes via Intl units; describeUserAgent
- `api.ts` — apiFetch (relative paths, JSON/FormData, never throws)
- `types.ts` — response shapes for account APIs
- `dev-link.tsx` — "dev" chip + link (dev-verify/dev-reset URLs)

### Modified (minimal, optional props only)
- `src/components/form/project-request-form.tsx` — new `ProjectRequestFormProps`: `initialValues?` (applied once after URL params), `onSubmitted?(refCode)`, `onValuesChange?(values)` (debounced 400ms, ref-held listener), `suppressLocalDraft?` (skips localStorage read/write incl. remove-after-submit). Defaults preserve existing public behavior exactly (no other changes).

## Integration notes
- All UI strings from `getPortalContent(locale)` — zero hardcoded AR/EN (dev chip, roleKey, currency codes, "→", "·", numeric pagination are symbols/identifiers only).
- Auth pages pass portal slices as props from server pages (searchParams read server-side; login/requests wrapped in Suspense for useSearchParams… login uses server-read `next` prop; requests-view still uses useSearchParams internally).
- My routes take precedence over `[[...slug]]` catch-all; middleware already redirects unauthed `/account` → login (verified 307).
- Toaster (sonner) mounted in auth + account layouts (no global mount exists; if admin agent mounts another, toasts would duplicate — coordinate if needed).
- Priority value labels reuse `portal.admin.requests.priorities`; budget/timeline/contact values reuse site `content.form.*` maps (same strings the request form uses).
- Verified flows via dev server + curl (registered test client → verified → login → submit request S7-3HROJOKI → detail API + page render → reply → drafts PUT/GET/DELETE → claim generic) — all 200/201 as expected; test data fully cleaned afterwards via prisma script.
- `.next/dev/types/validator.ts` stale errors appear after adding routes (pre-existing class per worklog 5-a) — regenerate on dev server route discovery; all src/ errors are in the parallel admin agent's WIP files only.

## Verification
- `bunx tsc --noEmit`: 0 errors in my files (src/ clean except admin-agent WIP + stale .next types)
- `bunx eslint src/app/[locale]/auth src/app/[locale]/account src/components/account src/components/form/project-request-form.tsx`: 0 problems (fixed react-hooks/static-components by hoisting subcomponents; set-state-in-effect by async-IIFE awaits + lazy claim-open initializer)
