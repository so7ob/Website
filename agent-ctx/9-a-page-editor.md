# Task 9-a — Page Editor (محرر الصفحات الاحترافي)

Agent: page-editor
Scope: `src/app/[locale]/admin/pages/**` (list + editor + preview routes) + `src/components/admin/editor/**` + إضافة `"use client"` فقط إلى `src/components/blocks/*.tsx`. لم يُعدّل أي ملف آخر (لا admin layout ولا مسارات API ولا مكونات المشرف الآخرى).

## Deliverables

### Routes
| Route | Type | Notes |
|---|---|---|
| `[locale]/admin/pages/page.tsx` | server | requireMe(pages.view) → PagesClient |
| `[locale]/admin/pages/pages-client.tsx` | client | جدول القائمة + بحث/تصفية + إجراءات + حوار «صفحة جديدة» |
| `[locale]/admin/pages/[id]/edit/page.tsx` | server | requireMe(pages.edit) → PageEditor (القراءة بلا تحرير عبر مسار المعاينة) |
| `[locale]/admin/pages/[id]/preview/page.tsx` | server | requireMe(pages.view)، جلب مباشر من db، validateBlocks لمسودة `?locale=` (الافتراضي لغة المسار)، يمرر `?device=` كبداية |
| `[locale]/admin/pages/[id]/preview/preview-shell.tsx` | client | شارة «معاينة · مسودة» عائمة + مبدل أجهزة + عودة للمحرر، إطار عرض بعرض الجهاز |

### Components (`src/components/admin/editor/`)
| File | Purpose |
|---|---|
| `types.ts` | واجهات استجابات (PageRow/PageDetail/VersionRow/MediaItem + ConflictBody) + `DraftState{ar,en}` + `newBlockId()` بأسلوب `b-{type}-{random6}` (لاحقة a-z0-9، فريدة ضمن الصفحة) |
| `prop-fields.ts` | **سجل الحقول**: `PROP_FIELDS` للـ27 نوعًا (نص/textarea/رقم/اختيار/switch/media/stringlist/array بـitemFields/group/rows) + خيارات التعدادات (خدمات من `form.services` بالعربية والإنجليزية من محتوى الموقع، kind من `works.statuses`، variant/align/level/columns/size/channel…) + `numeric` لاختيارات heading.level وgallery.columns (قيم رقمية z.literal) + `DEFAULT_PROPS` (27/27 صالحة zod — مؤكدة بسكربت) + `assertDefaultProps()` dev-only + `PAGE_TEMPLATE_OPTIONS` (التسميات inline ثنائية اللغة كأداة تحرير كما سُمح للسجل) |
| `props-form.tsx` | العارض العام: كل حقل يقرأ raw value بأمان (asString/asBool/asArray/asRecord) ويبني props جديدة غير قابلة للتغيير؛ مصفوفات بعناصر قابلة للإضافة/الحذف/التحريك مع itemFields؛ stringlist بـTextarea dir=auto؛ rows الجدول خلايا إضافة/حذف؛ select الاختياري يسمح بـ«بدون» (يحذف المفتاح)؛ حقل الوسائط = Input ltr + زر منتقي |
| `media-picker.tsx` | Dialog شبكة وسائط (GET ?page=) + ترقيم مشترك + رفع FormData بصلاحية media.upload (أخطاء too_large/type_not_allowed من ترجمات المنصة) + تحرير altText عند blur بصلاحية media.manage + النقر يعيد `/api/media/{id}` |
| `properties-panel.tsx` | ترويسة (اسم الكتلة من BLOCK_LIBRARY + تكرار/حذف) + تبويبان: الخصائص (PropsForm) والمظهر (خلفية default/white/accent/navy/soft، paddingY none/sm/md/lg، روابط رؤية الجوال/التابلت/الكمبيوتر بعناوين hiddenOn*، معرف مرساة بتحقق نمط يظهر خطأً) |
| `block-library.tsx` | تجميع BLOCK_LIBRARY حسب editor.groups بأيقونات lucide لكل نوع، إضافة عند النقر (بعد المحدد أو في النهاية) |
| `editor-canvas.tsx` | DndContext + SortableContext (verticalListSortingStrategy) — السحب بقبضة GripVertical فقط (attributes+listeners على زر الactivator، PointerSensor بمسافة 5 + KeyboardSensor)؛ DragOverlay شريحة باسم الكتلة؛ غلاف group بحلقة تحويل hover ring-brand/40 ومحدد ring-2 ring-brand؛ **طبقة زر شفافة inset-0 z-10 تمنع تفاعل الروابط/النماذج دائمًا وتلتقط النقر للتحديد**؛ شريط أدوات عائم top-start (اسم النوع + قبضة + أعلى/أسفل + تكرار + حذف) يظهر عند hover/تحديد؛ إطار الجهاز 1280/768/375 بtransition + dir حسب لغة المسودة؛ **BlockBody = memo(PageRenderer blocks=[block])** فلا يعاد رسم إلا الكتلة المتغيرة؛ حالة فراغ dashed |
| `page-settings-dialog.tsx` | العنوانان (تسميات menus.labelAr/labelEn — لا مفاتيح titleAr في الفهرس)، المسار بتحقق isValidSlug محلي ورسالة slugHint، الترتيب، الظهور public/authenticated/role + أدوار SYSTEM_ROLES (بدون client)، SEO عنوان/وصف باللغتين؛ PATCH فوري مع draftUpdatedAt → 409 يفتح حوار التعارض؛ onSaved يحدّث الحالة محليًا (بلا إعادة تحميل تفقد التعديلات غير المحفوظة) |
| `versions-dialog.tsx` | GET versions + تبويب AR/EN، صف: رقم + مؤلف + تاريخ + blockCount + استعادة (AlertDialog تأكيد) بصلاحية pages.restore → onRestored يعيد المحرر تحميل المسودة |
| `page-editor.tsx` | الشريط العلوي (عودة/عنوان→إعدادات/تبويب لغة المسودة AR-EN/مؤشر الحفظ saved✓-saving…-unsaved•-error⚠+زر إعادة/تراجع/إعادة/أجهزة/معاينة مستقلة/إصدارات/إعدادات/نشر بزر معطل وتلميح publishDisabled لغير المصرح + رابط «نُشرت الصفحة» يفتح `/{draftLocale}/{slug}`) |

## State / history / autosave design
- الحالة كلها في `EditorState {draft:{ar,en}, past[], future[]}` مع `stateRef` متزامن (commit فوري) — تحديثات نقية بلا آثار جانبية في المحدثات.
- تاريخ: **فوري** لكل عملية منفصلة (إضافة/حذف/تكرار/ترتيب/تحريك/مظهر/رؤية/مرساة) يدفع `s.draft` القديم؛ **مجمّع 500ms** للكتابة (baseline يلتقط قبل أول تعديل في الوجبة، يدفع عند السكون)؛ سقف 50؛ undo/redo نقية + إلغاء الوجبة المعلقة.
- حفظ تلقائي: مؤجل 2000ms بعد أي تغيير؛ قبل الإرسال validateBlocks محلي (رسالة خطأ عند فشل — لا إرسال حالة غير صالحة)؛ PATCH بـ`draftUpdatedAt` المحمّل → 409 conflict يفتح حوار conflictTitle/conflictBody + زر إعادة تحميل (loadPage يلغي المحلي والتاريخ)؛ الفشل الشبكي = حالة «فشل الحفظ» + زر إعادة، **لا نجاح زائف**؛ عند النجاح يُحدّث lastSaved + loadedStamp + slug/status؛ مقارنة تسلسل قبل الحفظ فلا PATCH فارغة (وترجع «محفوظة» عند العودة بالتراجع للحالة المحفوظة)؛ beforeunload بleaveWarning عندما dirty/saving/error.
- النشر: performSave فورًا ثم POST publish → toast publishedOk + publishedAt + رابط حي؛ الاستعادة/إعادة تحميل التعارض عبر loadPage (يصفّر التاريخ والمراجع).
- RTL: كروم المحرر بأدوات منطقية (ms/ps/start/rtl:rotate-180 للعودة)، أدراج Sheet بside منعكس مع اللغة، الكانفس `dir` حسب لغة **المسودة**.

## Responsive
- xl+: ثلاث لوحات (مكتبة 13rem / رسم مرن / خصائص 20rem).
- lg: مكتبة + رسم؛ الخصائص درج يفتح تلقائيًا عند التحديد.
- <lg: الرسم فقط؛ المكتبة زر درج في الشريط. العزل عبر matchMedia (lg 1024 / xl 1280) حتى لا يفتح الدراج على العريض.

## Registry coverage — 27/27
- تحقق آلي بسكربت مؤقت (bun): `DEFAULT_PROPS[type]` تعبر `blockSchemas[type].safeParse` — **0 فشل**؛ تغطية مفاتيح كل مخطط (علوي + متداخل داخل itemFields لكل مصفوفة/مجموعة) — **0 نواقص، 0 زوائد علوية**.
- أعمدة بصرية: `heading.level` و`gallery.columns` أرقام (z.literal(2|3|4)) → FieldDef.numeric مع تحويل Number.
- الحقول الاختيارية (faqSection.limit، preselectService، disclaimer/changes في worksFull/processFull…) تسمح بقيمة فارغة تحذف المفتاح من JSON.
- `simpleTable.rows` (string[][]) بنوع rows مخصص: صفوف قابلة للإضافة/الحذف/التحريك وكل صف خلايا نصية إضافة/حذف.

## Verification
- `bunx tsc --noEmit`: **0 أخطاء (المشروع كله)**.
- `bunx eslint src/app/[locale]/admin/pages src/components/admin/editor src/components/blocks`: **0 أخطاء، 0 تحذيرات**.
- dev.log: لا أخطاء من مسارات المحرر (طلبات 200 فقط).
- متصفح headless (جلسة admin): القائمة تعرض الجدول كاملًا؛ المحرر يحمّل المكتبة المجمعة والكانفس (كتل الرئيسية الحية)؛ تحديد hero يفتح الخصائص ببياناتها؛ تعديل kicker → «محفوظة» تلقائيًا بعد 2s ويظهر بعد reload (أُعيدت الصفحة الرئيسية لحالتها البذرية: kicker الأصلي، draftUpdatedAt=publishedAt، editorTouched=null)؛ إضافة فاصل+مسافة من المكتبة؛ Ctrl+Z وأداة التراجع تحذفان؛ **لا أخطاء console**.
- API flow عبر curl: POST إنشاء 201؛ PATCH بكتل (نصوص JSON) + طابع 200؛ طابع قديم → 409 conflict؛ نشر 200 (إصدار ar+en)؛ استعادة v1 200 (ترجع مسودة)؛ نسخة -copy 201؛ أرشفة 200؛ صفحات الاختبار حُذفت نهائيًا.

## Integration notes
1. **Toaster**: مثبت مسبقًا في AdminShell (admin layout) — لم أكرره.
2. **قالب الخادم «blank-section» معطوب سلفًا**: `POST /api/admin/pages` مع template=blank-section يبني richText بـ`paragraphs: []` فيخالف `min(1)` → 400 invalid_blocks دائمًا (خطأ في ملف API ليس من ملكيتي). الالتفاف: العميل ينشئ فارغًا ثم PATCH فوري بكتلتين من DEFAULT_PROPS (صالحات بالبناء). **التوصية**: تصحيح سطر واحد في `src/app/api/admin/pages/route.ts` (`paragraphs: [""]`).
3. تسميات inline ثنائية اللغة مقصورة على ملف السجل prop-fields.ts (تسميات الحقول + خياري القالب) — الباقي كله من getPortalContent؛ أعمدة العنوانين في القائمة/الإعدادات تعيد استخدام menus.labelAr/labelEn (لا مفاتيح titleAr/En في الفهرس — فجوة فهرس).
4. إخفاء الكتل حسب الجهاز (visibility) بوسائط عرض CSS في الموزع (max-md:hidden…) — يستجيب لعرض **نافذة المتصفح** لا عرض إطار المعاينة؛ محدودية معروفة لمعاينة الأجهزة داخل div (بدون iframe). المعاينة المستقلة تعطي نفس السلوك.
5. `pages-client` (قائمة الصفحات) وضعت في مجلد المسار المملوك بدل components/admin — الالتزام بحدود الملكية.
6. الغلاف `/edit` يحرس `pages.edit`؛ من يملك `pages.view` فقط يستخدم مسار المعاينة للقراءة.
