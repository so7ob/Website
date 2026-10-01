# Task 8-a — Admin Panel (Shell + Management Pages)

Agent: admin-panel
Scope: `src/app/[locale]/admin/**` (layout, dashboard, users, requests, inquiries, audit, outbox, menus, settings, media — NOT `admin/pages/**` which the editor agent owns) + `src/components/admin/**` (NOT `components/admin/editor/**`).

## Deliverables

### Routes (server wrappers guard authz + pass `me` {id,name,email,roleKey,locale,permissions} to client components)
| Route | Type | Notes |
|---|---|---|
| `[locale]/admin/layout.tsx` | server | getAuthUser → login?next / account bounce for clients; AdminShell + siteName from settings; force-dynamic |
| `[locale]/admin/page.tsx` | server | dashboard — **direct db queries** (no self-HTTP); 6 stat cards, requestsByStatus bars, last7days mini columns, recentRequests + recentActivity feeds |
| `[locale]/admin/loading.tsx` | server | segment loading skeleton |
| `[locale]/admin/users/page.tsx` | server wrapper | reads `?q=` searchParams → initial filter; UsersClient |
| `[locale]/admin/requests/page.tsx` | server wrapper | RequestsClient |
| `[locale]/admin/requests/[id]/page.tsx` | server wrapper | RequestDetailClient |
| `[locale]/admin/inquiries/page.tsx` | server wrapper | InquiriesClient |
| `[locale]/admin/inquiries/[id]/page.tsx` | server wrapper | InquiryDetailClient |
| `[locale]/admin/{audit,outbox,menus,settings,media}/page.tsx` | server wrappers | respective clients, per-permission guards |

### Components (`src/components/admin/`)
| File | Purpose |
|---|---|
| `types.ts` | `Me` + all API response/message interfaces (strict, no `any`) |
| `helpers.ts` | apiGet/apiSend/apiUpload (ApiError with code), apiErrorMessage (maps to portal auth.errors), fmtDate/DateTime/Relative/DayLabel (date-fns v4 + `ar` locale), formatBytes, totalPages, buildQuery |
| `guard.ts` | **server-only** requireMe(locale, permission, nextPath) — redirect login/account |
| `badges.tsx` | StatusBadge / PriorityBadge / UserStatusBadge / RoleBadge (SYSTEM_ROLES ar+en) / OutboxStatusBadge / ActionBadge + roleLabel() |
| `pagination.tsx` | numeric-only prev/next (direction-aware chevrons via locale), range "1–20 / 134" |
| `empty-state.tsx` | icon+title+body |
| `use-debounced.ts` | search debounce hook |
| `admin-shell.tsx` | navy sidebar (sticky h-dvh, active `bg-white/10 text-skydrop`) + mobile Sheet (side flips with locale) + topbar (section title, locale switch via swapLocalePath, user chip) + Toaster (sonner) mount; **hides site header/footer via `body:has(#admin-shell)` CSS** (no shared-layout edits — admin is a standalone app; fallback = site chrome shows) |
| `conversation.tsx` | shared MessageBubble (client start-aligned white / staff end-aligned navy-tint / internal_note amber + Lock + hint / system centered status chip parsed from `status:...` body) + ReplyComposer (tabs reply/internal, textarea, attach, optimistic send) |
| `users/users-client.tsx` | debounced search, role/status selects, sortable columns, pagination; dialogs: invite (devInviteUrl chip + copy), edit profile, change role; AlertDialog suspend/activate (409 last_admin → lastAdminError toast); sendReset via /api/auth/forgot-password; all actions gated by users.update/roles/suspend/create perms |
| `requests/requests-client.tsx` | filters (q/status/priority/service/assignee+unassigned/archived switch), checkbox column + bulk bar (bulkArchive/restore), row actions: view / assignToMe / assign-to submenu (staff list) / archive/restore, needsStaffReply amber dot (title = dashboard.unansweredRequests), relative lastActivity |
| `requests/request-detail-client.tsx` | 2-col: conversation (description as opening client bubble + all message kinds + max-h scroll) + info column (client card w/ link to users?q=, request fields incl. budget/timeline/contact-pref labels from **site content form maps**, management: assignee select + assignToMe, priority, status + note + required closeReason for closed/cancelled, archive/restore), attachments w/ download, status timeline + resolutionNote; clientView toggle hides internal notes + internal tab; composer POST /api/account/requests/[id]/messages (optimistic append then quiet refetch); **poll 20s** (skips while busy/hidden); errors mapped (invalid_transition, too_large, type_not_allowed) |
| `inquiries/inquiries-client.tsx` | list + filters (status/category/q) + pagination |
| `inquiries/inquiry-detail-client.tsx` | lighter detail: subject header, shared conversation, composer (reply/internal), assignee + status selects (staff options from requests list API response) |
| `audit/audit-client.tsx` | table (date, actor+email, ActionBadge, entity+id), expandable JSON details row (navy pre, ltr), q + entity filter, pagination |
| `outbox/outbox-client.tsx` | table (date, to, subject + error, status badge sent/dev_logged/failed), empty state w/ dev-mode body |
| `menus/menus-client.tsx` | header/footer tabs, editable rows (labelAr/labelEn, linkType radio page/custom, pages select w/ localized titles, enabled switch, remove, up/down reorder, add, max 12), PUT full list (order = array order), toast saved |
| `settings/settings-client.tsx` | contact card (email/phone/address), social (github), site names per language; PATCH only changed keys; client-side email/url validation |
| `media/media-client.tsx` | upload card (file + altText), grid of cards (img via /api/media/[id], size/KB/MB, alt inline-edit save-on-blur PATCH, copyUrl absolute + check feedback, AlertDialog delete), pagination |

## Key decisions
- **No edits outside owned folders.** Admin standalone shell achieved via `body:has(#admin-shell) > header/footer { display:none }` style tag inside admin layout only — zero conflicts with parallel agents (auth/account/editor).
- Dashboard queries db directly (per instructions); all other pages call the existing admin APIs with relative fetch, typed responses.
- All UI strings from portal translations (getPortalContent) — verified zero hardcoded Arabic/English outside comments; cross-section reuse where catalog keys exist (e.g. account.detail.*, dashboard.noData, users.cancel). Budget/timeline/contactMethod VALUE labels come from site content `form.*` maps (only bilingual source for those enums). Status/priority/service maps from admin.requests.*.
- UI authz mirrors server: nav items filtered by can(me, perm); every mutation affordance hidden without its permission (server still enforces).
- RTL: logical utilities (ps/pe/ms/me), direction-aware back/next chevrons + sheet side, `ltr-isolate` for emails/refCodes/URLs.
- Sonner Toaster mounted in admin shell (top-center, closeButton) — portal layouts are separate, no cross-mounting conflicts.

## Verification
- `bunx tsc --noEmit`: **0 errors** (whole project).
- `bunx eslint "src/app/[locale]/admin" "src/components/admin"`: **0 errors, 0 warnings**.
- Runtime smoke test (temporary `bun run dev`, admin session admin@so7ob.local): all 10 admin pages return 200 in ar (dashboard also en); created test request + inquiry via public APIs; verified reply 201 / internal note 201 / assign 200 / status 200 / invalid transition 409 / bulk archive+restore / users list+PATCH / last_admin self-suspend 409 / invite with devInviteUrl / menus GET+PUT / settings GET+PATCH / media GET; response shapes match local interfaces exactly. Temp server stopped after test.
- Dev log: no errors from admin routes (only pre-existing "middleware deprecated" notice).

## Integration notes
- Sidebar "Pages" item links to `/{locale}/admin/pages` (editor agent owns that route+list UI) — hidden without `pages.view`.
- Logout link → `/{locale}/auth/logout` (auth agent owns).
- Users page reads `?q=` — request detail client card links to `/admin/users?q={email}`.
- Staff options for assignee selects are taken from `/api/admin/requests?page=1` response `staff` field (the only endpoint exposing it).
- No files created/modified in `src/app/[locale]/auth`, `account`, `admin/pages`, `components/admin/editor`, `components/blocks`.
