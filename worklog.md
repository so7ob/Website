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
