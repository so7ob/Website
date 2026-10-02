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

---
Task ID: 5-b,6
Agent: main (Z.ai Code)
Task: Content seed + DB page serving + full account/admin APIs

Work Log:
- Content seed src/db/seed-content.ts: 7 pages → blocks (re-runnable, skips editorTouched), menus, settings; ran successfully
- /[locale]/[[...slug]] catch-all serving published blocks w/ visibility gates + slug redirects + dynamic SEO; layout dynamic w/ DB menus + auth-aware header
- Portal translations src/content/portal/{types,ar,en}.ts
- requests-service.ts: status transitions map, client/staff scoping, message dedupe, notifications
- APIs: account (requests list/detail/reply/cancel/edit, claim+verify, drafts, notifications, profile), admin (dashboard, users+invite, requests+bulk, inquiries+messages, pages CRUD+publish+versions+restore, media, menus, settings, audit, outbox), attachments upload/download w/ permission checks, public inquiries POST, invite accept, media serving
- requests POST links authed users via session; audit + staff notifications wired

Stage Summary:
- All backend APIs ready; auth pages/portals/admin UI remain
- Migrations: 20261001211740_platform_v2, auth_lockout, status_event_relation

---
Task ID: 7-a
Agent: auth-account-portal
Task: Auth pages + client account portal (بوابة العميل)

Work Log:
- Read worklog/portal translations/session helpers/API routes, then built all UI on getPortalContent — no hardcoded strings
- Auth: centered-card layout + login (next-auth credentials, role-aware redirect, safe ?next), register (success card + devVerifyUrl chip), forgot (generic response + devResetUrl), reset (token from searchParams), verified (status card), invite, logout (signOut + clears so7ob-request-draft)
- Account layout: getAuthUser guard → redirect login?next; AccountShell with start-side sticky sidebar (desktop) + mobile Sheet drawer (RTL side flip), lucide nav, roleKey badge, 30s unread-notification polling (badge), DraftHygiene (localStorage draft wipe), amber pending-verification banner
- Pages: dashboard (server db stats: open/awaitingReply/unread/total + recent table + empty state + claim link), requests list (status tabs, table, pagination, claim dialog + ?claim= banners/auto-open), new request (ProjectRequestForm + server drafts: restore→initialValues, 3s debounced PUT autosave, DELETE after submit, own success card w/ detail link), request detail (info card, conversation w/ client/staff/system rendering, composer + FormData attachments, 20s polling, status timeline, cancel dialog, 403/404 card), notifications (markRead+navigate, markAllRead, load-more), profile (PATCH + locale switch redirect), security (change password → signOut; sessions list w/ UA labels, revoke/revokeAll)
- Minimal optional props added to ProjectRequestForm: initialValues/onSubmitted/onValuesChange/suppressLocalDraft — defaults preserve public behavior
- Fixed eslint react-hooks v6 rules (static-components → hoisted subcomponents; set-state-in-effect → async-IIFE awaits, lazy claim-open init)
- Smoke-tested full flows via curl on dev server (register→verify→login→request→reply→drafts→claim) with a test client, then cleaned all test rows via prisma

Stage Summary:
- 26 files created (auth 15, account 8, components/account 11 incl. shared), 1 minimal modification (project-request-form)
- bunx tsc --noEmit: 0 errors in my folders (only admin-agent WIP + stale .next/dev types remain)
- bunx eslint (auth/account/components-account/form): 0 problems
- Toaster (sonner) mounted per auth/account layouts — flag for admin agent to avoid duplicate mounts
- Details: agent-ctx/7-a-auth-account-portal.md

---
Task ID: 8-a
Agent: admin-panel
Task: لوحة الإدارة — الهيكل وصفحات الإدارة (dashboard, users, requests, inquiries, audit, outbox, menus, settings, media)

Work Log:
- قراءة worklog + البنية القائمة (permissions/session/portal types/APIs/prisma) قبل أي كتابة
- src/components/admin/: types (Me + استجابات الواجهات), helpers (apiGet/apiSend/apiUpload + ApiError + رسائل الأخطاء من portal.auth.errors + تنسيق تواريخ date-fns v4 ب locale عربي + أحجام + buildQuery), guard (requireMe خادمي: redirect دخول/لوحة), badges (حالة/أولوية/دور من SYSTEM_ROLES/بريد), pagination رقمي باتجاه معكوس حسب اللغة, empty-state, use-debounced, admin-shell (شريط جانبي navy كامل الارتفاع + عنصر نشط bg-white/10 text-skydrop + درج جوال Sheet + شريط علوي بعنوان القسم ومبدل اللغة وchip المستخدم + Toaster)، conversation (فقاعات مشتركة: عميل/طاقم/ملاحظة داخلية كهرمانية بقفل/نظامية وسطية + ملحن بتبويب رد/ملاحظة)
- المسارات: layout (حارس جلسة + admin.dashboard، العملاء → /account)، loading.tsx، page.tsx لوحة مؤشرات باستعلام Prisma مباشر (6 بطاقات + أشرطة الحالات + أعمدة آخر 7 أيام + جدولا أحدث الطلبات والأحداث)، users/requests/inquiries/audit/outbox/menus/settings/media (أغلفة خادم + عملاء بصرامة الأنواع)
- المستخدمون: بحث مؤجل + تصفية دور/حالة + ترتيب أعمدة + ترقيم؛ دعوة (devInviteUrl قابل للنسخ)، تعديل بيانات، تغيير دور، إيقاف/تفعيل بتأكيد (409 last_admin → toast مخصص)، إرسال استعادة كلمة المرور — كل إجراء ببوابة صلاحيته
- الطلبات: تصفية كاملة (حالة/أولوية/خدمة/مسؤول/مؤرشف) + تحديد جماعي للأرشفة + تعيين لي/لغيري من القائمة؛ التفاصيل: محادثة كاملة (الوصف الافتتاحي فقاعة عميل + clientView يخفي الملاحظات) + عمود إدارة (تعيين/أولوية/حالة بملاحظة وسبب إغلاق إلزامي) + مرفقات + خط زمني + تحديث دوري 20 ثانية + إرفاق ملفات
- الاستفسارات: قائمة + تفاصيل أخف (محادثة + رد/ملاحظة + تعيين/حالة)
- التدقيق: بحث + تصفية كيان + تفاصيل JSON قابلة للتوسيع؛ الصادر: حالات sent/devLogged/failed مع نص الخطأ وشرح وضع التطوير
- القوائم: تبويب ترويسة/تذييل + صفوف (تسميتان، نوع رابط صفحة/مخصص، مفعّل، ترتيب أعلى/أسفل، إضافة) وحفظ PUT؛ الإعدادات: تواصل + اجتماعي + اسم الموقع باللغتين (PATCH للمفاتيح المتغيرة)؛ الوسائط: رفع + شبكة بمعاينة + تحرير alt عند blur + نسخ رابط + حذف بتأكيد
- إخفاء ترويسة/تذييل الموقع داخل اللوحة عبر body:has(#admin-shell) في تخطيط الإدارة فقط — بلا تعديل أي ملف مشترك (لا تعارض مع وكلاء auth/account/editor)
- كل النصوص من ترجمات portal (getPortalContent) — لا نصوص عربية/إنجليزية صلبة خارج التعليقات؛ تسميات قيم الميزانية/الإطار الزمني/قناة التواصل من خرائط form في محتوى الموقع
- تحقق: bunx tsc --noEmit صفر أخطاء (المشروع كله) + eslint مجلداتي نظيف؛ اختبار تشغيلي مؤقت (جلسة admin): 10 صفحات 200 بالعربية (واللوحة بالإنجليزية) + رد 201/ملاحظة 201/تعيين 200/حالة 200/انتقال غير صالح 409/أرشفة جماعية/حماية آخر مدير 409/دعوة بـ devInviteUrl/قوائم/إعدادات/وسائط — الأشكال مطابقة للأنواع؛ أُوقف الخادم المؤقت بعدها
- لم تُنشأ/تُعدل أي ملفات في auth/account/admin/pages/components/admin/editor/components/blocks

Stage Summary:
- لوحة إدارة كاملة عاملة ثنائية اللغة RTL/LTR مع تحكم واجهة بالصلاحيات (القرار في الخادم) — سجل مفصل في agent-ctx/8-a-admin-panel.md

---
Task ID: 9-a
Agent: page-editor
Task: محرر الصفحات الاحترافي — المكتبة/الرسم/الخصائص، سحب وإفلات، تراجع/إعادة، حفظ تلقائي، نشر وإصدارات

Work Log:
- قراءة worklog + سجل الوكلاء ثم البنية: blockSchemas/BLOCK_LIBRARY (27 نوعًا)، مكونات العرض، ترجمات portal (admin.editor/admin.pages كاملة)، حرس/مساعدات/أنواع لوحة الإدارة، مسارات API الصفحات والوسائط
- "use client" أضيف إلى page-renderer + 29 ملفًا في components/blocks (كان hero-block وrequest-form-shell فقط) — العرض العام يبقى سليمًا (خواص JSON متسلسلة من صفحة خادم) وتحقق /ar و/en و/ar/services و/en/works بعد التغيير
- src/components/admin/editor/: types (واجهات استجابات الصفحات/الإصدارات/الوسائط + newBlockId بأسلوب b-{type}-{random6})، prop-fields (سجل PROP_FIELDS للـ27 نوعًا + DEFAULT_PROPS صالحة zod + تحقق تطوري dev + خيارات تعدادات الخدمات من form.services وأنواع الأعمال من works.statuses + خيارات قوالب الصفحة الجديدة)، props-form (نموذج عام: نص/طويل/رقم/اختيار — مع أرقام heading.level وgallery.columns — /مفتاح/وسائط/قائمة نصوص/مصفوفة كائنات إضافة-حذف-ترتيب/مجموعة/صفوف جدول)، media-picker (شبكة + ترقيم + رفع بصلاحية media.upload + تحرير alt عند blur)، properties-panel (تبويبا المحتوى والمظهر: خلفية/حشوة/رؤية أجهزة/معرف مرساة)، block-library (مجمّعة حسب editor.groups بأيقونات)، editor-canvas (dnd-kit بقبضة سحب فقط + SortableContext + DragOverlay chip + طبقة شفافة تمنع تنقل الروابط وتلتقط التحديد + شريط أدوات عائم أعلى-البداية + عرض الجهاز 1280/768/375 بانتقال + جسم الكتلة memo عبر PageRenderer بمصفوفة وحيدة فلا يعاد رسم غير المعدل)، page-settings-dialog (عنوانان/مسار بتحقق/ترتيب/ظهور+أدوار SYSTEM_ROLES/SEO باللغتين — PATCH فوري)، versions-dialog (تبويب لغة + استعادة بتأكيد بصلاحية pages.restore)، page-editor (الشريط العلوي: عودة/عنوان/تبويب لغة المسودة/مؤشر حالة الحفظ محفوظة-جارٍ-غير محفوظة-فشل مع زر إعادة/تراجع وإعادة/أجهزة/معاينة مستقلة/إصدارات/إعدادات/نشر — زر التعطيل بنص publishDisabled tooltip — ورابط عرض المنشور)
- التاريخ: لقطات {ar,en} — دفع فوري للعمليات المنفصلة، وتجميع 500ms للكتابة (baseline قبل الوجبة)، سقف 50، Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y وEscape لإلغاء التحديد، أزرار أيضًا
- الحفظ التلقائي: مؤجل 2000ms، تحقق محلي بvalidateBlocks قبل الإرسال، draftUpdatedAt للكشف → 409 conflict يفتح حوار conflictTitle/conflictBody مع زر إعادة تحميل (يعيد الجلب ويلغي المحلي)، الفشل الشبكي = حالة «فشل الحفظ» + إعادة — لا نجاح زائف أبدًا، قبل المغادرة beforeunload بleaveWarning، النشر يحفظ فورًا ثم POST publish مع toast publishedOk، الاستعادة تعيد التحميل
- المسارات: /[locale]/admin/pages (غلاف pages.view + جدول عميل: العنوانان/مسار ltr-isolate/شارة حالة بألوان/نجمة الرئيسية/نقطة hasUnpublishedChanges/الترتيب/الإصدارات + بحث وتصفية + إجراءات ببوابات الصلاحيات: تحرير/معاينة/نسخة -copy مع تدوير اللاحقة عند التعارض/تعيين رئيسية/أرشفة بتأكيد)؛ /[id]/edit (غلاف pages.edit)؛ /[id]/preview (غلاف pages.view يجلب من DB مباشرة ويحلل مسودة ?locale= داخل غلاف عميل بشارة «مسودة» ومبدل أجهزة وثابت سفلي)
- قالب «ترويسة + نص» يُبنى في العميل (إنشاء فارغ ثم PATCH بكتل من DEFAULT_PROPS) — التفاف على قالب الخادم القديم غير الصالح (richText بفقرات فارغة يخالف min(1)) دون تعديل ملفات API المملوكة لغيري
- الاستجابة: 3 لوحات على xl، المكتبة/الخصائص أدراج Sheet تحت lg/xl (side ينعكس مع اللغة) — الفتح التلقائي لدرج الخصائص عند التحديد على الضيق فقط عبر matchMedia
- تحقق نهائي: bunx tsc --noEmit صفر أخطاء (المشروع كله) + eslint مجلداتي نظيف (0/0)؛ تحقق بيانات: DEFAULT_PROPS 27/27 تطابق zod (سكربت مؤقت bun) وتغطية السجل كاملة للمفاتيح العلوية والمتداخلة (17 مصفوفة/مجموعة مطابقة 0 نواقص)؛ اختبار تشغيلي بمتصفح headless (جلسة admin): القائمة والمحرر والمعاينة 200، تحديد كتلة وفتح الخصائص، تعديل kicker → محفوظة تلقائيًا وإعادة تحميل تُظهره (أُعيدت الرئيسية لحالتها البذرية تمامًا)، إضافة فاصل+مسافة من المكتبة، Ctrl+Z وأداة التراجع تحذفان — بلا أخطاء console؛ API: إنشاء/تعديل بطابع/تعارض 409/نشر/إصدارات/استعادة/نسخة/أرشفة كلها كما تتوقعها الواجهة، وحُذفت صفحات الاختبار

Stage Summary:
- محرر كامل ثنائي اللغة RTL/LTR فوق الكتل الحية مع مكتبة (27) وخصائص عامة من سجل حقول مطابق للمخططات وسحب وإفلات وتراجع وحفظ تلقائي بكشف تعارض ونشر/إصدارات/معاينة أجهزة ومنتقي وسائط — التفاصيل في agent-ctx/9-a-page-editor.md

---
Task ID: 10-13
Agent: main (Z.ai Code)
Task: Integration, E2E QA via agent-browser, fixes, docs, tests, PR

Work Log:
- Integrated all agent work (7-a auth/account, 8-a admin panel, 9-a page editor)
- Fixed blank-section template invalid blocks; relaxed publish to require one non-empty locale (unpublished translation = 404, not blocked publish)
- CRITICAL FIX: draft leak in RSC flight payload (React dev instrumentation serialized full page row) → getPage now selects published fields only
- E2E QA via agent-browser: register→verify(dev link)→login→dashboard→new request (server draft autosave PUT 200, POST 201)→client reply 201→admin login→reply+internal note+status change PATCH 200→client sees reply+status, internal note ABSENT (0 matches)→ suspension revokes session (401)→client blocked from admin APIs (403/404)
- Editor E2E: created page 'extra-services' from editor (3 blocks) → publish 200 → live for visitors at /ar/extra-services (no code changes); edited FAQ title → publish → live update; draft-only edit NOT visible; version restore 200 works
- Mobile 375px no overflow; EN LTR works; sticky footer verified; server restart preserves data
- Added tests: blocks validation (11), permissions+transitions (14), portal parity (3) → 67 total passing
- Updated README (platform guide), AGENTS.md (content separation rules), .env.example (auth+mail vars)
- Cleaned agent test leftovers; kept synthetic demo data (1 client + 1 request + 1 editor page)

Stage Summary:
- Platform complete: auth+RBAC, client portal, admin panel, page editor, messaging w/ attachments, notifications, audit, media, menus, settings
- All checks: lint ✓, typecheck ✓, 67/67 tests ✓, git diff --check ✓
- Demo admin: admin@so7ob.local / AdminS7ob2026! (local dev only)
- Known: single-instance rate limits (documented); editor device-hiding follows viewport (documented)

---
Task ID: 14
Agent: main (Z.ai Code)
Task: Branch/watcher resolution + final verification + PR

Work Log:
- Diagnosed sandbox watcher forcing `git checkout main` periodically (reflog evidence: flip within seconds of each feature checkout)
- Resolution: fast-forwarded LOCAL main to feature tip (7b45a9a) — remote untouched (origin/main = original site; PR #4 reviews feature→main); watcher's checkout is now a no-op
- All routes verified: public pages, CMS pages (incl. editor-created extra-services), auth pages, sitemap, robots; account/admin redirect to login with ?next=
- Dev server running stable on port 3000

Stage Summary:
- PR #4 open: https://github.com/so7ob/Website/pull/4 (feature/3-interactive-platform, 5 commits)
- Local main == feature tip (not pushed — PR is the review path per AGENTS.md)
- Platform fully operational and stable

---
Task ID: 15-qa
Agent: main (Z.ai Code)
Task: Status assessment + agent-browser QA round + critical fixes before feature work

Work Log:
- Verified all checks green: lint ✓, typecheck ✓, 67/67 tests ✓, dev server stable
- Full browser QA: public AR/EN, admin login (all 9 admin pages), client portal (7 pages), request detail, page editor (toolbar/blocks/select), mobile 375px no-overflow (public + account)
- BUG FIXED (crash): /ar/admin/menus threw client-side exception — Radix SelectItem rejects value="" (home page slug). Fix: "/" sentinel in UI (menus-client.tsx slugToValue/valueToSlug + Select value/pageSlug ?? undefined), server PUT maps "/" → "" (canonical DB value for home)
- BUG FIXED (data corruption): admin menus PUT converted pageSlug "" → null, silently turning home links into dead "#" links; round-trip now verified via browser (select home → save → DB stores "" → public header renders /ar → reload shows home selected) then demo data reverted to seeded state
- FIXED warning: added data-scroll-behavior="smooth" to <html> in [locale]/layout.tsx (Next.js route-transition smooth-scroll handling)
- ENVIRONMENT: dev server OOM-killed twice during rapid cold-compile QA burst (next-server 2.7GB RSS, 4GB sandbox limit) — restarted detached via setsid; warm Turbopack cache keeps it ~1.3GB; navigate sequentially during QA
- ADDED translation keys (types/ar/en, parity tests still 67/67): account.requests.search*; admin.requests.export/exportOk; admin.users.viewProfile + users.detail section; admin.savedReplies section (for Task 15-b features)

Stage Summary:
- Platform fully stable; 3 fixes landed; translations staged for feature round
- Next: parallel subagents 15-a (styling polish) + 15-b (features: CSV export, user detail page, saved replies, client request search)

---
Task ID: 15-a
Agent: frontend-styling-expert
Task: Portal/admin styling polish round (visual-only, no logic/data/translation changes)

Work Log:
- src/app/globals.css: added @keyframes shimmer + .animate-shimmer utility (gradient sweep on ::after, animation:none to neutralize Skeleton's animate-pulse via later-in-layer cascade, RTL sweep direction reversed, frozen by existing prefers-reduced-motion block)
- src/app/[locale]/admin/page.tsx (stays server, all Prisma queries untouched): stat cards get per-stat tinted icon chip + h-1 gradient top bar + hover lift (-translate-y-0.5 + shadow-lg) + p-5; status bars now rounded-full bg-muted track with per-status gradient fills (same color families as StatusBadge) + animate-shimmer glint + count chip (rounded-full bg-muted); week columns bg-gradient-to-t from-navy to-skydrop with hover:brightness-125 + title tooltip; recent lists rows hover:bg-muted/50 with transition-colors
- src/app/[locale]/account/page.tsx: same stat-card treatment (gradient top bar per tone, hover lift, overflow-hidden rounded-2xl); recent table rows get transition-colors + hover:bg-muted/50
- src/components/admin/badges.tsx: refactored tones to {chip,dot} — tinted bg + family-matched border + size-1.5 dot indicator, rounded-full (twMerge overrides base rounded-md); identical props signatures and color semantics; ActionBadge rounded-full + bg-muted/50
- src/components/admin/empty-state.tsx: dashed-border card (border-dashed bg-muted/20 rounded-2xl) + size-12 icon circle with ring-8 ring-accent/50 halo; props signature IDENTICAL
- src/components/admin/admin-shell.tsx: active nav item gets start-edge skydrop pill (absolute inset-y-2 start-0 w-1, logical property), inactive hover:bg-white/5 + duration-200; sidebar bg gradient from-navy to-navy-soft (desktop aside + mobile Sheet); brand chip gradient from-skydrop/25; topbar user chip: shadow-sm + backdrop-blur + gradient avatar (from-brand to-navy) with ps-1.5/pe-3 flush avatar
- src/app/[locale]/auth/layout.tsx: decorative layer (aria-hidden, pointer-events-none, -z-10, overflow-hidden): top wash from-accent/70 via-brand/10 + 3 blur-3xl circles in brand/skydrop behind card
- src/app/[locale]/auth/_components/auth-card.tsx: shadow-lg shadow-navy/10 + ring-1 ring-brand/5 + border-border/80
- Loading skeletons (className-only): admin/loading.tsx + account requests-view/security-view/notifications-view/request-detail-view Skeletons now animate-shimmer
- Verified statically: bunx tsc --noEmit = 0 errors; bunx eslint (13 touched files) = 0 problems; git diff --check clean; no forbidden files touched (menus/requests/users/conversation/api/prisma/content untouched — concurrent 15-b changes visible in git status are theirs)

Stage Summary:
- Admin/account dashboards now have tinted, gradient-accented, hover-lifting stat cards; status bars chart with animated gradient fills + count chips; brand-gradient week columns; refined dot-indicator badges; dashed empty states; navy-gradient sidebar with start-edge active accent; softer auth background with brand blur glows; skeletons shimmer instead of pulse — all RTL-safe (logical properties), reduced-motion-respecting, 44px targets preserved

---
Task ID: 15-b
Agent: general-purpose
Task: New features — saved replies, CSV export, user detail page, client request search
Work Log:
- Feature 1 (Saved replies): prisma model SavedReply + migration 20261002000931_saved_replies (+savedReplies back-relation on User); AUDIT_ACTIONS savedReplyCreated/Updated/Deleted; API /api/admin/saved-replies (GET requests.view.all ordered updatedAt desc; POST requests.reply, name≤80/content≤2000, createdBy=guard.user.id) + /api/admin/saved-replies/[id] (PATCH/DELETE requests.reply, team-shared — no ownership check); UI saved-replies-dialog.tsx (list+inline edit+delete confirm+create form, all labels t.admin.savedReplies.*), trigger button t.admin.savedReplies.manage in requests-client header gated by can(me,"requests.reply"); conversation.tsx ReplyComposer gained optional savedReplies prop → SavedReplyPicker Popover (t.admin.savedReplies.useReply/insert/empty) fetches via apiGet on each open and inserts content with \n\n separation — passed only from admin request-detail-client (mayReply && !clientView), client portal has its own composer so clients never see it
- Feature 2 (CSV export): /api/admin/requests/export GET permission requests.export, mirrors list route where-building (q/status/service/priority/assignee/archived, NO pagination, take 5000, orderBy lastActivityAt desc); text/csv; charset=utf-8 + \uFEFF BOM, Content-Disposition so7ob-requests-YYYY-MM-DD.csv; 15 columns refCode,status,priority,service,clientName,clientEmail,assigneeEmail,budget,currency,timeline,contactPref,createdAt,lastMessageAt(=lastActivityAt),closedReason(=resolutionNote),archived(1/0); proper CSV escaping (quote on , " \n, doubled quotes); audit requestsExported (count+filters); export button t.admin.requests.export in requests-client header gated requests.export, window.open same-origin relative URL + toast exportOk
- Feature 3 (User detail): GET /api/admin/users/[id] permission users.view — safe fields only (no passwordHash/tokens), stats totalRequests + openRequests (status NOT IN closed/cancelled), last 20 requests (with assignee name), sessions {activeCount (revokedAt null + unexpired), last5 [createdAt,lastSeenAt,userAgent,ipHash] — no fingerprint/token}, auditLog last 10 by actorId; suspendedAt derived from latest user.suspended audit event; page /[locale]/admin/users/[id] (requireMe users.view) + user-detail-client.tsx: back link, role+status badges (reused badges.tsx as-is), accountInfo card (email/phone/company/locale/verified/createdAt/lastLogin/lastSeen/suspendedAt), 3 stat cards, userRequests table with refCode deep-link → /[locale]/admin/requests/[id], activityLog with ActionBadge; users table: name is now a link + dropdown item t.admin.users.viewProfile (Eye icon); types UserDetail*/SavedReply* added to admin types.ts
- Feature 4 (Client request search): /api/account/requests GET accepts q (min 2 chars) — scoped search on top of ownership (never widens): refCode contains (uppercased, SQLite ASCII-case-insensitive) OR serviceType equals q if in service enum OR status equals q if in REQUEST_STATUSES; requests-view.tsx: search Input (t.account.requests.searchPlaceholder, debounced 300ms via new components/account/use-debounded.ts duplicate of admin hook), X clear button (t.account.requests.clearSearch), request-sequence guard against stale responses, distinct noResults empty state when list empty AND q≥2 chars (regular empty state otherwise)
- Runtime smoke (dev server had STALE prisma client after migrate — restarted it detached, now healthy): saved-replies CRUD 201/200/200/200 + invalid 400; export 200 with correct headers/BOM/data rows; user detail 200 full shape; account search all cases OK (refCode prefix, lowercase, service match, status match, no-match 0, 1-char no-filter, status+q combined); pages /ar+/en admin users/[id], requests, account requests all 200; temp test user+request created then fully cleaned via prisma; audit entries verified
- Verification: bunx tsc --noEmit 0 errors (whole project incl. concurrent 15-a WIP); eslint 0 problems on all touched folders; bun run test 67/67; git diff --check clean
Stage Summary:
- All 4 features working end-to-end (API verified live, pages render AR/EN); dev server restarted at 00:18 to load regenerated Prisma client (old process had pre-migration client cached — any future migrate requires dev restart)
- Browser-test suggestions: saved-replies manage dialog (create/edit/delete + picker insert in request conversation), CSV export opens file with Arabic names intact in Excel (BOM), users list → name link/dropdown → detail page incl. RTL/LTR, client portal search field (debounce, X clear, no-results state vs regular empty)

---
Task ID: 15
Agent: main (Z.ai Code)
Task: QA-driven bug fixes + styling polish round + 4 new features (15-a/15-b integration)

Work Log:
- Browser QA of ALL new work by both subagents, all verified working:
  1. Saved replies: manage dialog on requests page (created test reply), composer picker "رد محفوظ" on request detail inserts content into textarea (verified value); clients never see it (separate composer); test reply cleaned from DB after
  2. CSV export: button gated by requests.export; response 200 text/csv; charset=utf-8; BOM verified at byte level (EF BB BF); filename so7ob-requests-2026-10-02.csv; Arabic data intact
  3. User detail page /ar/admin/users/[id]: stat cards (1 total/1 open/2 sessions), requests table with deep links, account info, activity log; reachable via user name link + dropdown in users list
  4. Client request search: debounce filters server-side (refCode prefix "S7-4V" → row stays), "zzzz" → distinct no-results state "لا نتائج مطابقة لبحثك", X clear restores list
- Styling verified via VLM screenshots (admin dashboard, account dashboard, login): professional, RTL-correct, no major visual bugs; minor notes only (chart label contrast)
- Full checks after integration: lint ✓, tsc --noEmit ✓, 67/67 tests ✓, git diff --check ✓
- ENVIRONMENT: dev server OOM-killed 3× during QA bursts (4GB sandbox; next-server grows with each cold-compiled route ~2.5GB+). Mitigation: restart detached via setsid; navigate sequentially; warm cache ~1.3-1.8GB. NOTE for future rounds: after prisma migrate, dev server MUST be restarted (stale client)
- Cleaned QA artifacts (qa-shots/, tool-results/, scripts/check-menus.ts) and test data

Stage Summary:
- Round complete: 3 bug fixes (menus crash + home-slug corruption + scroll-behavior), 14 files styling polish, 4 new features (saved replies + CSV export + user detail + client search), migration 20261002000931_saved_replies applied
- Known/accepted: single-instance rate limits; dev-server memory ceiling in sandbox (not a production issue); VLM minor a11y notes (chart label contrast, red asterisk contrast on login)
- Next candidates: request deep-linking from user detail is list-filter based; announcements/banner block for editor; notification real-time push; CSV export for inquiries

---
Task ID: 16-qa
Agent: main (Z.ai Code)
Task: Round-16 assessment + QA + shared-file prep for feature round

Work Log:
- All checks green at round start: lint ✓, tsc ✓, 67/67 ✓, dev server 200
- agent-browser QA: public AR pages (about/faq/contact/works/process/services) 0 errors; 404 page renders bilingual heading; admin login + inquiries list + inquiry detail + media + audit + outbox 0 errors; client dashboard + notifications 0 errors
- No bugs found this round → feature round confirmed
- Round-16 plan (from worklog next-candidates): announcement banner system (SiteSetting-based, no migration), inquiries CSV export (new permission), saved replies in inquiries, styling polish round 2
- SHARED FILES PREPARED by main agent (subagents must NOT edit these): portal types/ar/en — added admin.settings.announcement* (+variants record), admin.inquiries.export/exportOk, top-level announce.{ariaLabel,dismiss}; permissions.ts — added "inquiries.export" granted to ops_manager (tests still 67/67, tsc clean)

Stage Summary:
- Platform stable; translations + permission staged; parallel subagents 16-a (styling) + 16-b (features) launching

---
Task ID: 16-a
Agent: frontend-styling-expert
Task: Styling polish round 2 — tables, media grid, audit, pagination, conversation

Work Log:
- src/components/admin/users/users-client.tsx: thead gets xs/medium/uppercase/tracking-wide muted labels via [&_th]:* on header row (border-b already from TableHeader); rows hover:bg-muted/50; SortHeader arrows → ChevronsUpDown (idle, opacity-60) / ChevronUp / ChevronDown (active, text-navy) with hover:text-foreground — onClick/props untouched; name+email two-line identity cell, ltr-isolate email and size-10 action buttons were already correct (kept)
- src/components/admin/media/media-client.tsx: upload card → dashed border + hover:border-brand hover:bg-accent/30 transition (dropzone affordance); grid cards → group; image container framed (m-3 mb-0, rounded-xl border overflow-hidden); image transition-transform duration-300 group-hover:scale-[1.03]; copy-url + delete buttons moved into navy hover overlay (bg-navy/60, opacity-0 → group-hover/focus-within:opacity-100 on ≥sm, always visible on touch <sm) as size-11 (44px) round white/blurred buttons — same onClick/refs/permission gates, old bottom bar removed
- src/app/[locale]/admin/pages/pages-client.tsx: same thead treatment; rows group/row + transition-colors hover:bg-muted/50 (archived keeps opacity-60); slug cell ltr-isolate font-mono text-xs untouched; status badges untouched; actions trigger size-9→size-10 text-muted-foreground → group-hover/row:text-foreground
- src/components/admin/audit/audit-client.tsx: same thead/row treatment; details toggle size-9→size-10 with muted→foreground hover; expanded JSON now rounded-xl border bg-muted/40 p-3 font-mono text-xs text-foreground ltr-isolate max-h-64 overflow-auto with subtle custom scrollbar ([scrollbar-width:thin] + ::-webkit-scrollbar w-2 rounded thumb bg-border) — replaces navy/skydrop terminal look
- src/components/admin/outbox/outbox-client.tsx: same thead/row treatment; status chips untouched (badges.tsx already polished)
- src/components/admin/pagination.tsx: numeric pagination — page-number buttons (size-10 rounded-full, hover:bg-muted, current = border-transparent bg-navy text-white, aria-current="page") with ±1 window + "…" gaps when >7 pages; prev/next arrows size-10 rounded-full, disabled arrows text-muted-foreground/50 (disabled:opacity-100 override keeps them readable); RTL icon flip, props signature, from–to/total aria-live summary unchanged (screen-reader "page/pages" text replaced by aria-current)
- src/components/admin/conversation.tsx: client bubbles bg-accent/60 + border-sky-200/70 rounded-ss-sm tail; staff bubbles bg-navy text-white rounded-se-sm tail (logical corner utilities verified to override rounded-2xl shorthand via compiled CSS test — longhands emit after shorthand); internal-note amber + system chip untouched; composer wrapper focus-within:border-brand/40 + ring-2 ring-ring/40, textarea border-0 bg-transparent px-0 shadow-none focus-visible:ring-0; savedReplies picker + all logic/props/state untouched
- src/components/account/request-detail-view.tsx: timeline — non-latest dots bg-border, latest dot bg-brand + ring-4 ring-brand/15, dots size-2.5 transition-all duration-300 (history is createdAt asc so last item = current status); bubbles realigned to shared conversation language (own/client = accent tint rounded-se-sm, staff = navy white rounded-ss-sm, labels skydrop/white-60) since this view renders its own bubbles (NOT the shared conversation.tsx — verified, aligned manually); info card dt/dd definition-list already correct (kept); attachments list already polished (kept)
- src/components/admin/requests/saved-replies-dialog.tsx: list rows rounded-xl + hover:bg-muted/50 transition; preview already line-clamp-2 text-xs text-muted-foreground (kept)
- Verified statically: bunx tsc --noEmit = 0 errors; bunx eslint (all 9 touched files) = 0 problems; bun run test 67/67; git diff --check clean; no forbidden files touched (16-b's settings/inquiries/api/layout/site-data/portal-content/permissions untouched)

Stage Summary:
- Workhorse screens now speak the round-15 polish language: uppercase muted table headers + hover-tinted rows across users/pages/audit/outbox; framed media cards with zoom-on-hover and a navy action overlay (44px targets, touch-visible on small screens); audit JSON details as a proper mono code block with slim custom scrollbar; round numeric pagination with navy active chip; chat bubbles differentiated by role (accent client / navy staff / amber notes) with logical-corner tails; composer with unified focus-within ring and borderless textarea; client request timeline with brand-ringed current status — all RTL-safe (logical properties, logical corners), palette-compliant (navy/skydrop/brand/accent only), no logic/props/translation changes

---
Task ID: 16-b
Agent: general-purpose
Task: Announcement banner system + inquiries CSV export + saved replies in inquiries

Work Log:
- Feature 1 (Site-wide announcement banner, no migration — reuses SiteSetting KV):
  - API /api/admin/settings PATCH: ALLOWED_KEYS + announcement.{enabled,messageAr,messageEn,ctaLabelAr,ctaLabelEn,ctaUrl,variant}; validation messageAr/En ≤280, ctaLabels ≤60, ctaUrl ≤200 + must start "/" or http(s)://, variant ∈ {info,warning,success,brand}, enabled ∈ {true,false}; any announcement key change also writes "announcement.revision"=String(Date.now()) in the SAME PATCH (upsert loop unchanged, audit keys list includes it) so dismissed browsers see the banner again
  - src/lib/site-data.ts: getSettings() now queries 14 keys and returns `announcement` object {enabled,messageAr,messageEn,ctaLabelAr,ctaLabelEn,ctaUrl,variant,revision} (defaults: disabled, variant "info", arbitrary variant falls back to "info"); SiteSettings interface updated; exported AnnouncementSettings/AnnouncementVariant/ANNOUNCEMENT_VARIANTS types
  - Admin UI settings-client.tsx: new 4th section card (Megaphone icon, t.admin.settings.announcement + announcementSubtitle) with Switch (enabled as "true"/"false" form string, normalized on load) + 6-field grid (messageAr dir=rtl, messageEn dir=ltr ltr-isolate, ctaLabels, ctaUrl placeholder "/ar/services", variant Select from announcementVariants — Radix needs non-empty so "info" default); dirty-keys-only save loop unchanged; client-side ctaUrl format check mirrors server
  - Public banner src/components/site/announcement-bar.tsx ("use client", new file): props {announcement, locale, labels{ariaLabel,dismiss}}; renders null when disabled OR locale message empty OR dismissed; dismissal via localStorage "so7ob-announcement" storing revision — read with useSyncExternalStore (server snapshot "" → no hydration mismatch, storage event → cross-tab sync, self-dismiss state keyed to revision so updating the announcement mid-session re-shows it; revision falls back to content-derived string if unset); variant styles info=bg-skydrop/15+Info, warning=amber+TriangleAlert, success=emerald+CircleCheck, brand=bg-navy+Megaphone; strip is id="site-announcement" role="region" aria-label, direct child of body above header; container max-w-7xl flex-wrap gap-3 py-2.5 text-sm font-medium, message flex-1 break-words, CTA pill min-h-9 rounded-full (internal "/" → next/link, external http(s) → target=_blank rel=noopener noreferrer, mailto/tel plain), dismiss X button size-9 hover:bg-black/5
  - [locale]/layout.tsx: <AnnouncementBar> rendered as FIRST element inside <body> before skip-link with labels from portal.announce; admin-shell.tsx CSS hide rule extended: body:has(#admin-shell) > #site-announcement { display:none !important } (banner is direct body child so selector works; account/auth/public pages keep it)
- Feature 2 (Inquiries CSV export): /api/admin/inquiries/export GET guardApi "inquiries.export" (super_admin+ops_manager), mirrors list route where-building (q contains subject/email/name/refCode-upper, status ∈ 5 statuses, category), take 5000 orderBy createdAt desc; 11 columns refCode,id,subject,category,status,name,email,assignedTo(assignee email),createdAt,lastMessageAt(=last message createdAt via messages orderBy desc take 1, fallback inquiry updatedAt),archived(1/0); \uFEFF BOM + text/csv; charset=utf-8, CRLF, csvEscape like requests export, filename so7ob-inquiries-YYYY-MM-DD.csv; AUDIT_ACTIONS.inquiriesExported ("inquiries.exported") added to audit.ts, logged with count+filters; inquiries-client.tsx header restructured flex-wrap justify-between with Download export button gated can(me,"inquiries.export"), window.open relative URL with current q/status/category, toast ti.exportOk — exact mirror of requests-client pattern
- Feature 3 (Saved replies in inquiries): inquiry-detail-client.tsx passes savedReplies={trigger:t.admin.savedReplies.useReply, insert, empty} to ReplyComposer gated by mayReply (= can "inquiries.reply") — same wiring as request-detail-client; picker only renders on the reply tab, clients never see it (admin-only page)
- Static verification only (shared dev server, per instructions): bunx tsc --noEmit = 0 errors; bunx eslint (10 touched files) = 0 problems — note initial react-hooks/set-state-in-effect error on mounted-flag pattern solved by switching to useSyncExternalStore; bun run test 67/67; git diff --check clean; only my 10 files + 16-qa's prepared translations/permissions touched (16-a's concurrent files untouched)

Stage Summary:
- All 3 features complete: announcement banner (admin-managed, bilingual, 4 styles, dismissible with revision-based reset, hidden in admin panel), inquiries CSV export (permission-gated, filter-mirroring, Excel-safe Arabic via BOM, audited), saved replies picker wired into inquiry reply composer
- Browser-test checklist for main agent: (1) admin settings → announcement section: enable + fill AR/EN texts + CTA + variant, save → verify banner on public AR and EN pages above header with correct style/icon/CTA (internal link navigates client-side, external opens new tab), dismiss (X) hides it, reload keeps it hidden, editing+saving announcement brings it back; (2) banner hidden on /admin pages (CSS :has rule), visible on account/auth pages; (3) empty message or disabled → no banner; (4) inquiries page: Export CSV button for super_admin/ops_manager only, exports with current search/status/category filters, Arabic subjects intact in Excel, audit log shows inquiries.exported; (5) inquiry detail: "Saved reply" picker on reply tab inserts template, absent on internal-note tab, support-role agent with inquiries.reply sees it, client portal never does; (6) RTL/LTR both directions + 375px mobile wrap of banner text/CTA

---
Task ID: 16
Agent: main (Z.ai Code)
Task: Round-16 integration — QA of 16-a styling + 16-b features, verification, commit

Work Log:
- Integrated both subagents; full checks: lint ✓, tsc ✓, 67/67 tests ✓, git diff --check ✓
- Browser QA of announcement system (all pass):
  - Admin settings 4th card renders all fields (switch, AR/EN messages, CTA labels+url, variant select); save 200 writes announcement.revision
  - Public AR: banner renders (region "إعلان", message, CTA link "الخدمات" href=/ar/services, dismiss button); VLM review: integrated, no visual bugs
  - Dismissal: X hides instantly, persists after reload (localStorage so7ob-announcement = revision); editing any announcement field via PATCH re-shows (revision reset) — verified with fetch PATCH + reload
  - EN page: English message + "Services" CTA; auth pages show banner
  - Admin isolation: #site-announcement display:none in /en/admin and subpages (CSS body:has rule) — NOTE: verify with computed style (offsetParent), NOT getElementById existence (initial false positive)
  - Mobile 375: no overflow (banner 375px wide) — NOTE: check against window.innerWidth, not hardcoded 375 (false positive when viewport is desktop)
- Browser QA of inquiries features (all pass):
  - Export button visible, API 200 with Content-Disposition so7ob-inquiries-2026-10-02.csv, 11 columns, Arabic subjects intact (BOM pattern same as requests export), audit inquiries.exported
  - Saved-replies picker in inquiry composer: empty state "لا ردود محفوظة" → created test reply via API → picker lists it → click inserts into textarea (verified value)
- Styling round 2 verified: users table (uppercase thead, sort chevrons — VLM: "high polish, correct RTL"), media grid (dashed dropzone; cards polished; empty state professional), pagination active page bg-navy + aria-current, conversation bubbles rounded-ss-sm tail corners confirmed in DOM
- Demo state kept intentionally: announcement ENABLED with demo text (shows feature end-to-end in PR review) + 1 demo saved reply "رد استفسار تجريبي"

Stage Summary:
- Round 16 complete: announcement banner system (8 settings keys, revision-based dismissal, 4 variants, admin-isolated), inquiries CSV export (new inquiries.export permission), saved replies wired into inquiries, 9 files styling polish round 2
- All features verified in browser AR/EN RTL/LTR + mobile
- Known/accepted: dev-server OOM ceiling in sandbox (restarted once this round); announcement demo text is fictional (product owner should edit before production)
- Next candidates: scheduled announcements (start/end dates); notification real-time push (websocket); request SLA indicators; dashboard date-range filters

---
Task ID: 17-qa
Agent: main (Z.ai Code)
Task: Round-17 assessment + QA + shared-file prep

Work Log:
- All checks green at round start: lint ✓, tsc ✓, 67/67 ✓, server 200
- agent-browser QA: admin login+dashboard, pages list → editor load (toolbar renders, 0 errors), client profile/security (0 errors), no console errors anywhere
- FUNCTIONAL GAP FOUND (top priority): staff notifications exist in DB (admin has 13 unread) and /api/account/notifications works for any authed user, but admin panel has NO bell and NO notifications page — staff never see their notifications
- Round-17 scope: (1) staff notifications in admin shell + /admin/notifications page; (2) request response-aging badges (admin list awaitingTeam/overdueReply + client list awaitingYou); (3) scheduled announcements (start/end dates); styling round 3 on remaining screens
- SHARED FILES PREPARED by main agent: portal types/ar/en — admin.nav.notifications + full admin.notifications section (title/subtitle/markRead/markAllRead/empty/types×7), admin.requests.{awaitingTeam,overdueReply,agingHours("{n} ساعة"/"{n}h"),agingDays}, account.requests.awaitingYou, admin.settings.{announcementStart,announcementEnd}. tsc clean, 67/67 pass. No permission changes needed (own-data notifications + settings.manage existing)

Stage Summary:
- Platform stable; translations staged; launching 17-a (styling round 3) + 17-b (staff notifications + aging badges + scheduled announcements) in parallel with strict file ownership: 17-b owns requests-client.tsx/inquiries-client.tsx/admin-shell.tsx/settings/API/site-data; 17-a owns user-detail/account-views/editor-chrome

---
Task ID: 17-b
Agent: general-purpose
Task: Staff notifications in admin + request aging badges + scheduled announcements
Work Log:
- Feature 1 (Staff notifications in admin panel):
  - API: verified /api/account/notifications GET/POST works for ANY authenticated user (guardApi without permission → own data only); reused AS-IS, zero server changes. Response rows: {id,type,payload{ref,status,name},link,readAt,createdAt}; links stored with hardcoded locale prefix (/ar/admin/requests/{id} for staff notifications, /ar/account/requests/{id} for client-facing ones)
  - NEW src/app/[locale]/admin/notifications/page.tsx: server wrapper following audit-page pattern — requireMe(locale, "admin.dashboard") (every staff role holds it; layout already redirects clients → /account), force-dynamic, passes me+locale
  - NEW src/components/admin/notifications/notifications-client.tsx: adaptation of account notifications-view (unread rows bg-accent/30 + brand icon circle, per-row markRead-on-click + navigate, markAllRead w/ CheckCheck, 20/page load-more button "shown/total", skeleton first load, error banner + retry, empty state) — labels from t.admin.notifications.*, status chips from t.admin.requests.statuses, dates via fmtDateTime; admin/types.ts gained AdminNotification/NotificationsResponse
  - Staff link mapping (client-side staffLink helper): /account/requests/ → /admin/requests/ when me.roleKey !== "client", plus stored /ar|en/ prefix rewritten to current display locale (verified with node: /ar/admin/requests/xyz + en → /en/admin/requests/xyz)
  - admin-shell.tsx: Bell in topbar (ghost icon size-10 rounded-full, aria-label = t.admin.notifications.title + count when >0) with unread badge absolute -top-0.5 -end-0.5 size-4 bg-skydrop text-navy capped "9+"; polls /api/account/notifications?unread=1 every 30s (exact account-shell pattern: active flag, pathname dep, silent catch); sidebar nav gained "notifications" (Bell, no permission — own data) between inquiries and pages; titleFor map updated
- Feature 2 (Request response-aging badges):
  - /api/admin/requests GET: added awaitingSince (ISO|null) per row — null unless status NOT closed/cancelled AND the LAST kind="message" row (internal_note/system excluded via where kind:"message") is authorType==="client" (authorType is the client/staff identifier on RequestMessage, NOT senderId); computed with ONE extra findMany for the page's 20 ids (orderBy createdAt asc, last-per-request wins in Map, select requestId/authorType/createdAt only); all existing fields unchanged
  - requests-client.tsx: AgingBadge next to StatusBadge in the status cell (flex-wrap gap-1.5) — <24h neutral chip border-border bg-muted text-muted-foreground "بانتظار رد الفريق · {n} ساعة/{n}h", ≥24h amber chip border-amber-300 bg-amber-100 text-amber-900 "رد متأخر · {n} يوم/{n}d" (labels from t.admin.requests.awaitingTeam/overdueReply/agingHours/agingDays, {n} replaced; hours/days floored from now−awaitingSince, clamped ≥0); admin/types.ts RequestRow gained awaitingSince: string | null
  - 16-a table polish applied to the 2 unpolished workhorse tables: requests + inquiries thead rows get exact users-client classes ([&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground), rows hover:bg-muted/50 (was /40), refCode cells font-mono text-xs ltr-isolate (was text-sm)
  - Client-side awaitingYou chip SKIPPED (17-a owns requests-view.tsx) — translations t.account.requests.awaitingYou remain staged for a future round; /api/account/requests untouched (purely status-based "responded" would need no API change)
- Feature 3 (Scheduled announcements):
  - /api/admin/settings PATCH: announcement.startAt/endAt added to ALLOWED_KEYS; validation = empty OR YYYY-MM-DD or full ISO (regex also accepts T..:..(:..(.mmm)?)?(Z|±hh:mm)); any announcement.* change still bumps announcement.revision (existing startsWith check covers new keys)
  - site-data.ts: SETTINGS_KEYS now 16 (2 new), AnnouncementSettings gained startAt/endAt strings (kept raw in returned object so the admin form shows them); getSettings computes effective enabled OUTSIDE storage: startAt boundary = date at local 00:00:00, endAt = date at 23:59:59 (full ISO values used as-is); now < start OR now > end → returned announcement.enabled=false while stored value untouched (verified via node: future start hides, past end hides, same-day end shows until 23:59:59, invalid strings → no gating)
  - settings-client.tsx: announcement card gained 2 date inputs (type="date" dir="ltr" min unset, labels t.admin.settings.announcementStart/End) wired into FIELDS/EMPTY_FORM/dirty-save loop as plain strings — empty clears (server upserts ""); load normalizes full-ISO stored values to their day so the date input renders truthfully
  - announcement-bar.tsx unchanged — it already returns null when !announcement.enabled, which now carries the schedule gate
- Static verification only (shared tree w/ concurrent 17-a): bunx tsc --noEmit = 0 errors (re-run after final tweak); bunx eslint (10 touched paths incl. new folders) = 0 problems; bun run test 67/67; git diff --check clean; account-shell/users-client/portal-content/prisma/editor files untouched (git-verified — 17-a's concurrent edits to account-views/user-detail-client are theirs)

Stage Summary:
- All 3 features complete: staff can now SEE their notifications (topbar bell + full page with mark-read/navigation), request list flags how long a client reply has been waiting (neutral <24h / amber ≥24h next to status), announcements can be scheduled with start/end dates evaluated server-side at render (no cron needed — gating is evaluated on every request via getSettings)
- Browser-test checklist for main agent: (1) login as admin → bell in admin topbar shows unread count (admin@so7ob.local had 13 unread in QA), badge capped 9+, count drops on mark-read, auto-refreshes every 30s, hidden when 0; (2) /ar/admin/notifications lists own notifications with unread accent rows — click a request notification → lands on /{locale}/admin/requests/{id} (NOT the client portal), a client-link notification rewires to admin route; mark-all clears header pill + bell badge; load-more pages 20 at a time; (3) client user hitting /admin/notifications → redirected to /account; (4) requests list: rows where client sent the LAST visible message (status not closed/cancelled) show aging chip next to status — fresh ones neutral "بانتظار رد الفريق · n ساعة", ≥24h amber "رد متأخر · n يوم"; closed/cancelled/staff-last rows show none; (5) requests+inquiries tables now have uppercase muted headers + hover rows + mono-xs refCodes (visual parity with users table); (6) settings → announcement card: start/end date pickers save; start date in the future hides the banner everywhere (enabled stays "true" in DB), end date in the past hides it, clearing both + saving restores per the enabled switch; banner reappears for dismissed browsers on any announcement save (revision bump covers schedule keys); (7) RTL/LTR + 375px: bell badge position flips correctly (logical -end-), aging chips wrap under status badge on narrow screens
- Notes: client-portal awaitingYou badge deferred (17-a file ownership) — t.account.requests.awaitingYou stays staged; notification links in DB carry a hardcoded /ar/ prefix by legacy design, the admin client rewrites locale at render (account portal still navigates as-is — unchanged behavior)

---
Task ID: 17-a
Agent: frontend-styling-expert
Task: Styling polish round 3 — user detail, account views, editor chrome

Work Log:
- src/components/admin/users/user-detail-client.tsx: 3 stat cards now speak the dashboard language — StatCard helper gains chip/bar class props, each card gets size-10 rounded-xl tinted icon chip (totalRequests=emerald/FileText, openRequests=amber/FileClock new import, sessionsCount=skydrop/MonitorSmartphone) + h-1 gradient top bar (rounded-t-2xl, overflow-hidden) + hover lift (-translate-y-0.5 shadow-lg shadow-navy/10 duration-300) + p-5; loading skeletons h-24→h-28 to match; requests table thead gets the 16-a uppercase muted pattern ([&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground) + rows hover:bg-muted/40→/50; accountInfo InfoRow dds (incl. emailVerified row) get border-s-2 border-border/60 ps-3 start-accent (values stay font-medium text-navy); activityLog rows rounded-xl px-2.5 py-1.5 + hover:bg-muted/50 transition-colors, ol space-y-2.5→1, timestamps text-[11px]→text-xs; both back links get text-muted-foreground hover:text-navy transition-colors (per-locale ArrowLeft/ArrowRight BackIcon already logical — kept)
- src/components/account/requests-view.tsx: status tabs → pill segment language: TabsList rounded-full, triggers rounded-full px-4 min-h-9 with active state bg-navy text-white shadow-none (twMerge overrides base bg-background) + data-[state=inactive]:hover:bg-muted transition-colors — tablist a11y untouched; table rows hover:bg-muted/40→/50; refCode cell gains text-xs + ltr-isolate (was missing); lastActivity column text-xs; 17-b's awaitingLabel prop + awaitingClientReply amber dot preserved untouched (no badges added)
- src/components/account/notifications-view.tsx: TYPE_ICONS → TYPE_META with per-type tinted icon chips (size-9 rounded-full: new_request=skydrop, request_assigned/content=navy, reply_received/content_published=emerald, info_requested/status_changed=amber — icons unchanged); unread rows get border-s-2 border-s-brand + bg-accent/30 (read rows border-s-transparent — no layout shift), rows rounded-xl hover:bg-muted/50; unread dot bg-red-600 h-2 w-2 → bg-brand size-2 (static, no pulse); chip tint now independent of read state (read/unread no longer swap chip colors)
- src/components/account/profile-form.tsx (task named profile-view.tsx — actual file is profile-form.tsx): header gains User icon chip (size-10 rounded-xl bg-accent text-brand-strong) beside h1; all inputs (email/name/phone/company) get focus-visible:ring-2 ring-ring/40 polish matching the 16-a composer language; off-palette text-slate-400 hint → text-muted-foreground
- src/components/account/security-view.tsx: header gains ShieldCheck icon chip; password-change section heading KeyRound→Lock inside size-8 rounded-lg bg-accent chip; sessions heading MonitorSmartphone gets same chip treatment; session rows get transition-colors + hover:bg-muted/50 (non-current only — current keeps its accent tint), current session gains emerald dot (size-2 bg-emerald-500) before the thisDevice chip; password inputs get focus-visible ring polish; revoke buttons/revokeAll untouched (size + red tone kept)
- src/components/admin/editor/page-editor.tsx: topbar action cluster (undo/redo + device group + preview/versions/settings) grouped into one subtle bg-muted/60 rounded-full p-1 segment container (flex-wrap keeps xl→lg collapse + narrow widths safe; publish CTA + live link stay outside); buttons inside switch outline→ghost for proper segmented-control look (handlers/aria/disabled/size untouched); device group loses its own border (now borderless inside segment), active device state bg-accent text-brand-strong → bg-white text-navy shadow-sm; save-status indicator now dot-driven: saved=emerald dot (replaces Check icon), error=destructive dot (replaces AlertTriangle icon), dirty=amber dot (already existed), saving keeps spinner — removed now-unused Check import
- src/components/admin/editor/block-library.tsx: library cards get border-border/70 at rest + hover:border-brand hover:bg-accent/20 (was transparent border + accent/60 + shadow); icon chips tinted per group via GROUP_CHIPS (home=skydrop, pages=emerald, generic=amber, layout=navy)
- src/components/admin/editor/editor-canvas.tsx: selected-block ring ring-2 ring-brand → ring-2 ring-brand/50; block hover hint changes from ring to a dashed border — always-present border-dashed border-transparent + group-hover:border-border (no layout shift, no CLS on select)
- Verified statically: bunx tsc --noEmit = 0 errors; bunx eslint (all 8 touched files) = 0 problems; bun run test 67/67; git diff --check clean; no forbidden files touched (17-b's requests/inquiries/admin-shell/settings/api/site-data/announcement-bar/portal-content all untouched; their concurrent changes visible in git status are theirs)

Stage Summary:
- User detail page now matches the dashboard stat-card language (tinted chips + gradient top bars + hover lifts), its tables/lists share the 16-a uppercase-thead + hover-row + accent-bordered dt/dd patterns
- Account portal: pill status tabs with navy active state, brand-accented unread notification rows with per-type tinted icon chips, icon-chip page headers on profile/security, softer focus rings, emerald current-session marker
- Editor chrome: unified rounded-full segmented topbar with white active device toggle, dot-based save-status indicator, tinted block-library chips, softer selection ring + dashed hover hint — all RTL-safe (logical properties only), palette-compliant (navy/skydrop/brand/accent/muted + semantic emerald/amber), 44px targets + ARIA preserved, zero logic/state/prop-signature changes (local StatCard helper gained presentational chip/bar props only)

---
Task ID: 17
Agent: main (Z.ai Code)
Task: Round-17 integration — staff notifications QA, aging edge-case fix, schedule verification

Work Log:
- Integrated 17-a + 17-b; full checks: lint ✓, tsc ✓, 67/67 ✓, git diff --check ✓
- Browser QA of staff notifications (all pass):
  - Admin shell bell shows unread count "الإشعارات (11)" + sidebar nav link between inquiries and pages; badge clears after mark-all-read
  - /ar/admin/notifications renders (type chips طلب جديد/رد جديد/تغيير حالة, markAll, load-more); 0 errors
  - Staff link mapping VERIFIED: clicked notification → /ar/admin/requests/{id} (rewrote /account/requests/ prefix for staff)
- Browser QA of aging badges: found + FIXED edge case in /api/admin/requests — new requests with ZERO messages showed no badge (description is the client's communication); now awaitingSince falls back to createdAt when no messages and lastStaffReplyAt null. Verified: S7-87ADGHJU shows "بانتظار رد الفريق · 1 ساعة" (neutral); S7-4VSZBSNR correctly null (staff replied last). Age math verified against server clock (00:29→02:01 UTC = 1h)
- Browser QA of scheduled announcements (all pass): future startAt → banner not-rendered; past endAt → not-rendered; cleared → visible again. UI date inputs save correctly (note: testing controlled date inputs via JS requires React-safe native setter + input event — direct .value set is a test artifact, not an app bug)
- Client portal: status tabs now navy pills (active "عرض الكل" bg-navy ✓); awaitingYou client badge wired by 17-b (awaitingClientReply from API)
- VLM review of notifications + user-detail pages: "high visual polish, RTL correct, no bugs" (all rows read during test = expected)
- Mobile 375px: account notifications + admin requests no overflow
- Demo state: announcement enabled (no dates), notifications all read for admin
- ENVIRONMENT: dev server OOM-restarted once this round (4th time total)

Stage Summary:
- Round 17 complete: staff notifications (bell + page + staff link mapping), request aging badges (with zero-message edge case fixed), scheduled announcements (start/end dates), styling round 3 (user-detail stat cards, account views pills/unread styling, editor chrome segmented toolbar)
- All verified in browser AR + mobile; checks all green
- Next candidates: client awaitingYou chip visual on requests list (API ready, only rendering), dashboard overdue KPI card, websocket real-time notifications, dashboard date-range filters

---
Task ID: 18-b
Agent: general-purpose
Task: Dashboard date-range selector + overdue KPI + client awaitingYou aging chip

Work Log:
- Read worklog (17-b aging-badge semantics, main's "Next candidates"), staged translations (admin.dashboard rangeLabel/range7/range30/range90/overdueReplies/overdueHint, account.requests awaitingYou/awaitingHours/awaitingDays — all present, untouched) and owned files
- src/app/[locale]/admin/page.tsx (server component, still no "use client"):
  - Feature 1 — range param: added `searchParams: Promise<Record<string, string | string[] | undefined>>` to page props (awaited, array-safe first value); parse `range`: "30"/"90" literal, anything else (incl. missing/invalid/array) → 7; RangeDays type from `RANGE_DAYS = [7,30,90] as const`
  - Segmented pill control in header row (now `flex flex-wrap items-center justify-between gap-3` with h1): rounded-full bg-muted p-1 container with role="group" aria-label={t.rangeLabel}; three Links `/${locale}/admin?range=7|30|90` with scroll={false}, aria-current={active ? "page" : undefined}, classes "inline-flex min-h-9 items-center rounded-full px-4 text-xs font-semibold transition-colors" + active "bg-navy text-white" / inactive "text-muted-foreground hover:bg-white/60" (conditional cn() — 17-a pill language)
  - Chart bucketing rewritten to ChartBar[] {key,count,label|null,title}: range=7 → 7 daily bars with fmtDayLabel (unchanged visuals incl. gap-2 sm:gap-3 + max-w-10); range=30 → 30 daily bars gap-1, bar max-w-10 removed (w-full flex), day-number labels only at index%5===0 or last bar via fmtDate(date, locale, "d"), other bars get aria-hidden &nbsp; placeholder p to preserve column alignment, full-date title tooltips kept; range=90 → 13 weekly buckets (week w starts today-89+7w, covers [start, start+7d), last bucket ends tomorrow so current days are covered), label = fmtDate(start, locale, "d/M"), tooltip = full week range "PP – PP"; heading uses active t.range7/range30/range90; h-28 height, 4px min height, EmptyState on rangeTotal===0 all unchanged
  - rangeRows Prisma query now `createdAt: { gte: rangeStart }` with rangeStart = now − rangeDays days (was hardcoded 7-day weekAgo); openRequests KPI hint = `${rangeTotal} · label` where label is t.last7days for 7 (preserves existing rendering; AR identical to range7) else the active range label
  - Feature 2 — overdue KPI: 14th Promise.all entry = projectRequest.findMany where {status in openStatuses, archivedAt: null, OR: [ {lastClientReplyAt not null, lt: now-24h}, {lastClientReplyAt: null, lastStaffReplyAt: null, createdAt: lt: now-24h} ]} select {lastClientReplyAt,lastStaffReplyAt}; count = rows.filter(clientNull ? staffNull : staffNull || client > staff).length — Prisma cannot compare two columns in a where (lastClientReplyAt > lastStaffReplyAt), so a pruned findMany + in-memory match implements the spec's two clauses exactly (verified truth table: client-only ✓, staff-after-client ✗, client-after-staff ✓, zero-message ✓, staff-only ✗ — the where already excludes the staff-only shape)
  - New 7th stat card inserted after awaitingInfo (position 4): Timer icon, chip bg-rose-100 text-rose-800, bar bg-gradient-to-r from-rose-300 to-rose-500, label t.overdueReplies, hint t.overdueHint; KPI grid xl:grid-cols-6 → grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 (4+3 on lg+)
- src/components/account/requests-view.tsx:
  - Feature 3 — replaced the h-2.5 w-2.5 bg-amber-500 dot with AwaitingYouChip component (plain Date math, mirrors admin AgingBadge from 17-b): since=r.lastStaffReplyAt; ageMs clamped ≥0; <24h → "border-border bg-muted text-muted-foreground" `${awaitingYou} · ${awaitingHours.replace("{n}",h)}`; ≥24h → "border-amber-300 bg-amber-100 text-amber-900" `${awaitingYou} · ${awaitingDays.replace("{n}",d)}`; chip classes inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium (+tabular-nums); since null → plain awaitingLabel chip without age (prop stays used, parent page.tsx untouched); stays inside the existing flex-wrap gap-2 cell next to StatusBadge
  - account/types.ts NOT modified — AccountRequestRow already carries lastStaffReplyAt: string | null; no API changes
- Static verification only (shared dev server with 18-a, no browser/dev-server commands): `bunx tsc --noEmit` = 0 errors; `bunx eslint` on the 3 owned files = 0 problems; `bun run test` 67/67; `git diff --check` clean; `git status --short` shows only my 2 owned files modified (18-a's styling files + main's staged translations are theirs — untouched); logic sanity-checked in node (bucket contiguity/labels 0,5,10,15,20,25,29 for 30d; 13 weeks spanning −89d→tomorrow; overdue truth table)

Stage Summary:
- All 3 features complete and static-verified. Dashboard now answers "when + what's stale": ?range=7|30|90 server-side re-render (daily bars for 7/30 — sparse day numbers at every 5th bar for 30 — and 13 weekly buckets for 90, KPI hint + chart + query all follow the selected range), a rose overdue-replies card counts open requests awaiting a team reply >24h (client-last-voice or zero-message fallback, matching round-17 aging semantics), and the client portal's tiny amber dot became a full "بانتظار ردك · n ساعة/يوم" aging chip in the same neutral/amber language as the admin badges
- Key decisions: (1) overdue count via one pruned findMany + in-memory column comparison instead of two counts — Prisma where cannot express lastClientReplyAt > lastStaffReplyAt, so two pure counts would silently over-count rows where staff replied after the client; the where's OR keeps the fetched set tiny (open, unarchived, already older than 24h) so the in-memory filter is exact and cheap; (2) KPI hint keeps t.last7days for range 7 (EN reads "5 · Last 7 days"; AR string identical to t.range7) and uses t.range30/range90 for the others; (3) 90-day week tooltips use an "–" en-dash separator (punctuation, like the existing "·"), chart heading = t.range7/range30/range90 per spec
- Browser-test checklist for main agent: (1) /ar/admin → pill group beside h1, "آخر 7 أيام" active (bg-navy) — click "آخر 30 يومًا" → URL ?range=30, chart heading + 30 thin bars with day numbers every 5th + last, no scroll jump; (2) ?range=90 → 13 bars labeled d/M, tooltip shows week range, ?range=999/invalid falls back to 7; (3) openRequests card hint follows range; (4) overdue card: value = open requests whose last voice is client's >24h ago (or no messages at all >24h) — create/age a request with a client message and no staff reply to see it climb; (5) client /account/requests: rows where team replied last show "بانتظار ردك · n ساعة" (neutral) turning amber "· n يوم" after 24h, plain chip if no staff date; (6) EN locale parity + RTL: pills/charts/bars flip via logical layout, 375px header wraps pill row under title

---
Task ID: 18-a
Agent: frontend-styling-expert
Task: Styling polish round 4 — audit, outbox, pages list, menus, detail pages

Work Log:
- src/components/admin/audit/audit-client.tsx: page header gets the 17-a icon-chip treatment (header flex items-center gap-3 + size-10 rounded-xl bg-accent text-brand-strong chip with ScrollText, h1+subtitle in title block); search Input + entity SelectTrigger get focus-visible:ring-2 focus-visible:ring-ring/40 (account-form language, overrides ring-[3px]/50 via twMerge); details toggle now renders a single ChevronDown with transition-transform duration-200 + rotate-180 when expanded (replaces ChevronUp/ChevronDown swap — visually identical, aria-label/aria-expanded/onClick/size-10 untouched, ChevronUp import removed); expanded details TableCell upgraded bg-muted/20→/30 + rounded-b-xl
- src/components/admin/outbox/outbox-client.tsx: same header icon-chip pattern with Send icon; date cell gets tabular-nums (kept text-xs); recipient email cell → font-mono text-xs (was text-sm, kept max-w-56 truncate ltr-isolate text-navy); thead uppercase pattern + hover rows + rounded-2xl card wrapper already correct from 16-a (verified, kept)
- src/app/[locale]/admin/pages/pages-client.tsx: rows gain status-tinted FileText icon chips (new STATUS_CHIP_TONES map: published=bg-emerald-100 text-emerald-800, draft=bg-amber-100 text-amber-800, in_review=bg-skydrop/20 text-brand-strong, archived fallback=bg-muted text-muted-foreground) as size-9 rounded-xl aria-hidden chips at the head of the title cell, before the home Star; text STATUS_TONES badges kept untouched per task; search Input + status SelectTrigger get the focus-visible ring polish (thead pattern + hover rows already 16-a)
- src/components/admin/menus/menus-client.tsx: location Tabs (header/footer) get the 17-a pill-segment language (TabsList h-auto w-max gap-1 rounded-full bg-muted/60 p-1; triggers min-h-9 rounded-full px-4 + data-[state=active]:bg-navy text-white shadow-none + inactive hover:bg-muted — exact account requests-view classes); item cards → rounded-xl border-border/70 (block-library item-card radius) + transition-colors hover:bg-muted/50; each card gains an ordering number header row (font-mono text-xs tabular-nums text-muted-foreground index + h-px bg-border/60 hairline, aria-hidden) — numbers previously not displayed, added per task; page-slug SelectTrigger gets focus-visible ring polish; NO drag handle exists (up/down buttons only) so GripVertical skipped; "/" homepage sentinel value mapping untouched
- src/components/admin/requests/request-detail-client.tsx: header badges (StatusBadge + PriorityBadge + archived chip) grouped into one flex flex-wrap items-center gap-2 row beside the mono refCode h1; client + request-info sidebar dds get the 17-a user-detail InfoRow treatment (border-s-2 border-border/60 ps-3, values font-medium text-navy, text-end dropped for shrink-wrapped start rule; email/reference dds keep brand link styling inside, truncate/min-w-0 preserved); conversation.tsx + composer + management selects + action buttons untouched (Button base already has transition-all)
- src/components/admin/inquiries/inquiry-detail-client.tsx: same badges-row grouping (StatusBadge + category chip) beside mono refCode; client sidebar dds (name/email/createdAt) get the same border-s-2 ps-3 font-medium text-navy pattern; conversation + selects untouched
- Verified statically (shared dev server untouched, no browser commands): bunx tsc --noEmit = 0 errors; bunx eslint (all 6 files) = 0 problems; bun run test = 67/67 (portal-parity green — zero translation keys added); git diff --check clean; git status confirms only my 6 owned files touched (admin/page.tsx + requests-view.tsx + portal/* changes visible are 18-b's concurrent work); diff audited for RTL-safety (logical ps/border-s only, no pl/pr/ml/mr/left/right)

Stage Summary:
- Audit + outbox now have icon-chip headers matching profile/security pages; audit JSON expand cue rotates smoothly and the expanded band reads as a tinted detail section; outbox emails/dates are mono/tabular like other workhorse tables
- Pages list rows get status-colored FileText chips (emerald/amber/skydrop/muted) giving instant visual triage; menus builder speaks the pill-tab + rounded-xl item-card language with visible ordering numbers and softer focus rings
- Request + inquiry detail sidebars now share the user-detail dt/dd start-rule pattern (border-s-2 accent, navy values) and wrap their status/priority badges as one gap-2 row — all RTL-safe (logical properties), palette-compliant, zero logic/state/prop/translation changes, 44px targets + ARIA preserved

---
Task ID: 18
Agent: main (Z.ai Code)
Task: Round-18 integration — QA, dashboard range/overdue/client-chip features, styling round 4, commit

Work Log:
- Round-start assessment: worklog read; all checks green (lint/tsc/67-67/server 200 AR+EN); tree clean at a8aabf0
- agent-browser QA (all pass, 0 console errors): admin login+dashboard, notifications page + staff link mapping (click → /ar/admin/requests/{id}), requests aging badge "بانتظار رد الفريق · 1 ساعة" (S7-87ADGHJU) + no badge when staff replied last, client portal pills + awaitingYou dot, client→admin redirect, mobile 375px no overflow. NOTE: login lives at /ar/auth/login (not /ar/login)
- Stability verdict: NO bugs found → scope = round-17 "next candidates": dashboard date-range filters + overdue KPI + client awaitingYou chip visual + styling round 4
- Main agent staged ALL shared translations first (round-17 conflict-avoidance pattern): admin.dashboard.{rangeLabel,range7,range30,range90,overdueReplies,overdueHint} + account.requests.{awaitingHours("{n} ساعة"/"{n}h"),awaitingDays("{n} يوم"/"{n}d")} — tsc + 67/67 verified before launching subagents
- Launched 18-a (frontend-styling-expert, styling round 4: audit/outbox/pages/menus/request+inquiry detail) + 18-b (general-purpose, 3 features) in parallel with strict file ownership
- BUG FOUND IN INTEGRATION QA: 18-b passed a full ISO timestamp to fmtDayLabel (expects YYYY-MM-DD; it appends T00:00:00) → "RangeError: Invalid time value" crashed /ar/admin on 7-day render (subagent static checks can't catch runtime date bugs) — fixed with .slice(0, 10); page reloads clean
- Browser QA of dashboard features (all pass): range pills (7/30/90) with navy active state + aria-current, chart 7 daily bars w/ weekday labels / 30 bars w/ sparse day numbers (3,8,13,18,23,28,2) / 13 weekly buckets w/ d/M labels (5/7…27/9), invalid range=999 → default 7, KPI hint uses range total + label, EN locale fully verified
- Overdue KPI verified positive AND negative: current data → 0 (correct); backdated S7-87ADGHJU createdAt 25h → card shows "1 ردود متأخرة"; ALSO first browser verification of round-17 amber aging badge "رد متأخر · 1 يوم" on admin list; data restored after test
- Client awaitingYou chip: neutral "بانتظار ردك · 3 ساعة" (border-border bg-muted), amber "بانتظار ردك · 1 يوم" (backdated both lastStaff/lastClientReplyAt 30h/32h), EN "Awaiting your reply · 3h"; data restored; verified chip correctly DISAPPEARS when only staff reply backdated (client became last responder — logic sanity confirmed by accident)
- 18-a styling verified in DOM: audit+outbox header icon chips + computed uppercase 12px theads + rotate chevron, pages list 8 status icon chips, menus pill tabs + order numbers 1-6 + card hover, request detail 9 accent-start dd borders + mono ref, inquiry detail 3 dd borders. NOTE: after subagent edits a hard reload is needed (stale Turbopack cache served old markup on first load)
- Mobile 375px: dashboard (2-col cards, pills wrap, no overflow), 30d chart, client requests — all clean; VLM review of desktop dashboard: "professionally designed with zero apparent technical or directional errors"; request-detail VLM: high-quality RTL, consistent accent borders
- ENVIRONMENT: dev server OOM-killed twice during round (5th+6th occurrences — kernel killed next-server at ~2.5GB RSS during /ar/admin cold compile; dmesg confirmed). Recovery that worked: agent-browser close --all (frees ~600MB chrome), setsid restart, warm routes SEQUENTIALLY with patient single curls (--max-time 240); unauthenticated curl to /ar/admin returns 307 BEFORE compiling the page — to warm the admin chain use an authenticated curl (csrf+credentials flow with cookie jar); after warmup memory stabilizes ~2.0-2.2GB
- Final checks: lint ✓, tsc ✓, 67/67 ✓, git diff --check ✓; committed afc9cea and pushed HEAD:feature/3-interactive-platform (PR #4 updated); server verified healthy post-push (all routes 200)

Stage Summary:
- Round 18 complete: dashboard date-range selector (server-rendered pills, adaptive daily/weekly chart bucketing), overdue-replies KPI (in-memory column comparison after pruned Prisma query), client awaitingYour-reply aging chip (dot→labeled chip, neutral/amber), styling round 4 (audit, outbox, pages, menus, request+inquiry details)
- All features browser-verified AR/EN + mobile; one integration bug (fmtDayLabel ISO arg) caught and fixed by main-agent QA — subagent static-only verification has this blind spot
- Next candidates: websocket real-time notifications (mini-service; polling exists at 30s), requests-list overdue filter chip (KPI → filtered list), request deep-link from notifications already works — consider email-outbox retry UX, editor keyboard shortcuts, or inquiry SLA next
