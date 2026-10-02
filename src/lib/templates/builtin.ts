/**
 * القوالب المدمجة — ستة نماذج صفحات جاهزة تُزرع آليًا في قاعدة البيانات (idempotent).
 *
 * كل قالب يخزن شجرتي محتوى v1 (عربي + إنجليزي) تمرّان عبر validateContent قبل
 * الزرع وقبل أي تطبيق — فلا يدخل الموقع محتوى غير مطابق للمخطط إطلاقًا.
 * المعرفات ثابتة وبادئتها t-{key}- لأن التطبيق يستبدل شجرة المسودة كاملة
 * (لا تصادم معرفات داخل لغة واحدة)، والاستعادة ممكنة عبر اللقطة الاحتياطية.
 */
import type { ContentNode } from "@/lib/blocks/tree";

export interface BuiltinTemplateDef {
  key: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  blocksAr: ContentNode[];
  blocksEn: ContentNode[];
}

// ─── أدوات بناء مختصرة ───

const heading = (id: string, text: string, level: 2 | 3 | 4 = 2): ContentNode => ({
  id,
  type: "heading",
  props: { text, level, align: "start" },
});

const text = (id: string, paragraphs: string[], size: "base" | "lg" = "base"): ContentNode => ({
  id,
  type: "text",
  props: { paragraphs, align: "start", size },
});

const button = (id: string, label: string, href: string, variant: "primary" | "outline" | "navy" = "primary"): ContentNode => ({
  id,
  type: "buttonLink",
  props: { label, href, variant },
});

const divider = (id: string): ContentNode => ({ id, type: "divider", props: {} });

/** قسم بخلفية وحشوة محددة وأبناء جاهزين */
const section = (id: string, background: "soft" | "white" | "navy" | "accent" | "muted" | "default", children: ContentNode[]): ContentNode => ({
  id,
  type: "section",
  style: background === "default" ? undefined : { base: { background, paddingY: "lg" } },
  children,
});

// ─── القوالب الستة ───

export const BUILTIN_TEMPLATES: BuiltinTemplateDef[] = [
  {
    key: "landing",
    nameAr: "صفحة هبوط سريعة",
    nameEn: "Quick landing page",
    descAr: "واجهة افتتاحية + نبذة تعريفية + دعوة ختامية — انطلاقة مثالية لصفحة حملة أو منتج جديد.",
    descEn: "Hero + intro copy + final CTA — the perfect starting point for a campaign or product page.",
    blocksAr: [
      {
        id: "t-landing-hero",
        type: "hero",
        props: {
          kicker: "سُحُب التقنية",
          title: "حلول رقمية",
          titleAccent: "تُطِر أفكارك",
          description:
            "نصمم ونبني مواقع وتطبيقات وأنظمة تُدار بسهولة وتنمو مع أعمالك — من الفكرة الأولى إلى الإطلاق وما بعده.",
          support: ["تصميم تجربة مستخدم", "تطوير ويب وجوال", "أنظمة إدارية متكاملة"],
        },
      },
      section("t-landing-intro", "white", [
        heading("t-landing-intro-h", "لماذا سُحُب؟", 2),
        text("t-landing-intro-t", [
          "نعمل معك خطوة بخطوة: نفهم المشكلة أولًا، ثم نقترح الحل الأنسب نطاقًا ووقتًا وميزانية، ونسلّم على مراحل واضحة تراجعها بنفسك.",
          "كل مشروع يُسلّم بلوحة متابعة خاصة، وتقارير دورية، وتدريب فريقك على التشغيل.",
        ], "lg"),
        button("t-landing-intro-cta", "اطلب عرض سعر", "/request", "navy"),
      ]),
      {
        id: "t-landing-cta",
        type: "ctaSection",
        props: {
          title: "جاهز لبدء مشروعك؟",
          body: "أرسل طلبك الآن وسنعود إليك خلال يوم عمل باقتراح أولي واضح.",
          links: [
            { label: "إرسال طلب مشروع", href: "/request", variant: "primary" },
            { label: "تواصل معنا", href: "/contact", variant: "outline" },
          ],
        },
      },
    ],
    blocksEn: [
      {
        id: "t-landing-hero",
        type: "hero",
        props: {
          kicker: "so7ob tech",
          title: "Digital solutions",
          titleAccent: "that grow with you",
          description:
            "We design and build websites, apps and systems that are easy to run and scale with your business — from first idea to launch and beyond.",
          support: ["UX design", "Web & mobile development", "End-to-end systems"],
        },
      },
      section("t-landing-intro", "white", [
        heading("t-landing-intro-h", "Why so7ob?", 2),
        text("t-landing-intro-t", [
          "We work with you step by step: understand the problem first, propose the right scope, timeline and budget, then deliver in clear phases you review yourself.",
          "Every project ships with a follow-up dashboard, regular reports and training for your team.",
        ], "lg"),
        button("t-landing-intro-cta", "Request a quote", "/request", "navy"),
      ]),
      {
        id: "t-landing-cta",
        type: "ctaSection",
        props: {
          title: "Ready to start?",
          body: "Send your request now and we'll get back within one business day with a clear initial proposal.",
          links: [
            { label: "Submit a project request", href: "/request", variant: "primary" },
            { label: "Contact us", href: "/contact", variant: "outline" },
          ],
        },
      },
    ],
  },
  {
    key: "about",
    nameAr: "من نحن — قصة الشركة",
    nameEn: "About — company story",
    descAr: "ترويسة + نص تعريفي + رؤية ورسالة + قيم مرقمة — الهيكل الكامل لصفحة تعريفية.",
    descEn: "Header + story copy + vision & mission + numbered values — the full profile page structure.",
    blocksAr: [
      {
        id: "t-about-header",
        type: "pageHeader",
        props: {
          kicker: "من نحن",
          title: "فريق يترجم الأفكار إلى منتجات",
          intro: [
            "سُحُب التقنية فريق متخصص في بناء المنتجات الرقمية: نبدأ من فهم عملك وننتهي بمنتج يعمل ويُقاس أثره.",
          ],
          quickLinks: [{ label: "رؤيتنا ورسالتنا", href: "#vision" }],
        },
        anchorId: "about-top",
      },
      {
        id: "t-about-story",
        type: "richText",
        props: {
          heading: "قصتنا",
          lead: "بدأنا بفكرة بسيطة: التقنية الجيدة تُفصَّل على مقاس صاحبها.",
          paragraphs: [
            "منذ انطلاقنا رافقنا شركات وناشئين في بناء مواقعهم وأنظمتهم، معتمدين على منهجية واضحة: تحليل، تصميم، تطوير، قياس، ثم تحسين مستمر.",
            "لا نبيع «حلولًا جاهزة» — نبني ما يحتاجه عملك فعلًا، ونشرح كل قرار بلغة مفهومة.",
          ],
          align: "start",
        },
      },
      {
        id: "t-about-vm",
        type: "visionMission",
        props: {
          vision: {
            title: "رؤيتنا",
            body: "أن نكون الشريك التقني الأول للشركات الطموحة في المنطقة، بحلول ذكية تُمطِر نتائج ملموسة.",
          },
          mission: {
            title: "رسالتنا",
            body: "نمنح كل عميل منتجًا رقميًا سريعًا وآمنًا وسهل التشغيل، مع شراكة استمرارية لا تنتهي عند التسليم.",
          },
        },
        anchorId: "vision",
      },
      {
        id: "t-about-values",
        type: "numberedValues",
        props: {
          title: "قيمنا في العمل",
          intro: "أربعة مبادئ تحكم كل مشروع نستلمه:",
          items: [
            { title: "الوضوح", body: "نطاق مكتوب وجدول زمني معلن وسعر بلا مفاجآت." },
            { title: "الجودة", body: "كود نظيف واختبارات حقيقية قبل التسليم، لا وعود عند التسليم." },
            { title: "الاستمرارية", body: "دعم وتطوير بعد الإطلاق — منتجك يبقى لدينا مسؤولية." },
            { title: "الشرح", body: "نوثق كل شيء وندرّب فريقك حتى يدير منتجاه بنفسه." },
          ],
          closingNote: "هل تشترك معنا القيم؟ جرّبنا بمشروع صغير أولًا.",
        },
      },
    ],
    blocksEn: [
      {
        id: "t-about-header",
        type: "pageHeader",
        props: {
          kicker: "About us",
          title: "A team that turns ideas into products",
          intro: ["so7ob tech is a specialized digital product team: we start by understanding your business and end with a product that works — measurably."],
          quickLinks: [{ label: "Vision & mission", href: "#vision" }],
        },
        anchorId: "about-top",
      },
      {
        id: "t-about-story",
        type: "richText",
        props: {
          heading: "Our story",
          lead: "It started with a simple idea: good technology is tailored to its owner.",
          paragraphs: [
            "Since day one we've helped companies and startups build their websites and systems with a clear methodology: analysis, design, development, measurement, then continuous improvement.",
            "We don't sell off-the-shelf solutions — we build what your business actually needs and explain every decision in plain language.",
          ],
          align: "start",
        },
      },
      {
        id: "t-about-vm",
        type: "visionMission",
        props: {
          vision: {
            title: "Vision",
            body: "To be the go-to technology partner for ambitious companies in the region, with smart solutions that rain tangible results.",
          },
          mission: {
            title: "Mission",
            body: "Give every client a fast, secure, easy-to-run digital product, backed by a continuing partnership that doesn't end at delivery.",
          },
        },
        anchorId: "vision",
      },
      {
        id: "t-about-values",
        type: "numberedValues",
        props: {
          title: "How we work",
          intro: "Four principles govern every project we take:",
          items: [
            { title: "Clarity", body: "Written scope, declared timeline, pricing with no surprises." },
            { title: "Quality", body: "Clean code and real testing before delivery — not promises at delivery." },
            { title: "Continuity", body: "Support and development after launch — your product stays our responsibility." },
            { title: "Explanation", body: "We document everything and train your team to run their own products." },
          ],
          closingNote: "Do our values match? Try us with a small project first.",
        },
      },
    ],
  },
  {
    key: "services",
    nameAr: "صفحة الخدمات",
    nameEn: "Services page",
    descAr: "ترويسة + تفصيل الخدمات (لمن؟ المشكلات؟ المخرجات؟) — صفحة خدمات كاملة بضغطة.",
    descEn: "Header + detailed services (for whom? problems? deliverables?) — a full services page in one click.",
    blocksAr: [
      {
        id: "t-services-header",
        type: "pageHeader",
        props: {
          kicker: "خدماتنا",
          title: "ماذا نبني لك؟",
          intro: ["ست خدمات أساسية تغطي دورة حياة منتجك الرقمي كاملة — وكل خدمة تُفصَّل على مشروعك."],
        },
      },
      {
        id: "t-services-detail",
        type: "servicesDetail",
        props: {
          items: [
            {
              service: "web",
              name: "تطوير المواقع",
              definition: "مواقع تعريفية ومتاجر ولوحات تحكم سريعة ومتوافقة مع الجوال ومهيأة لمحركات البحث.",
              forWhom: "الشركات التي تريد حضورًا رقميًا محترفًا يعمل من أول يوم.",
              problems: ["موقع بطيء لا يظهر في البحث", "تصميم قديم لا يعكس هوية النشاط"],
              deliverables: ["موقع كامل بالعربية والإنجليزية", "لوحة إدارة محتوى بسيطة", "تدريب على التشغيل"],
            },
            {
              service: "mobile",
              name: "تطبيقات الجوال",
              definition: "تطبيقات iOS وAndroid بأداء قريب من الأصلي وتجربة استخدام مدروسة.",
              forWhom: "المنتجات التي تحتاج وجودًا دائمًا في جيب عميلها.",
              problems: ["فكرة تطبيق بلا تنفيذ تقني", "تطبيق حالي يعاني تعليقًا وتقييمات منخفضة"],
              deliverables: ["تطبيق منشور على المتجرين", "لوحة تحكم للمحتوى والإشعارات"],
            },
            {
              service: "systems",
              name: "الأنظمة الإدارية",
              definition: "أنظمة داخلية تدير الطلبات والعملاء والصلاحيات والتقارير في مكان واحد.",
              forWhom: "فرق عمل تغرق في الملفات المتفرقة والرسائل المتبادلة.",
              problems: ["بيانات موزعة بين أرشيفات وبريد إلكتروني", "لا أحد يعرف حالة أي طلب لحظيًا"],
              deliverables: ["نظام مخصص بأدوار وصلاحيات", "سجل تدقيق كامل للعمليات"],
            },
          ],
          labels: { forWhom: "لمن هذه الخدمة؟", problems: "مشكلات نعالجها", deliverables: "ماذا تستلم؟" },
          requestLabel: "اطلب هذه الخدمة",
        },
      },
    ],
    blocksEn: [
      {
        id: "t-services-header",
        type: "pageHeader",
        props: {
          kicker: "Our services",
          title: "What do we build for you?",
          intro: ["Six core services covering your product's whole digital lifecycle — each tailored to your project."],
        },
      },
      {
        id: "t-services-detail",
        type: "servicesDetail",
        props: {
          items: [
            {
              service: "web",
              name: "Web development",
              definition: "Company sites, stores and dashboards — fast, mobile-friendly and search-ready.",
              forWhom: "Businesses that want a professional digital presence working from day one.",
              problems: ["Slow site that never ranks", "Outdated design that hides the brand"],
              deliverables: ["Full site in Arabic and English", "Simple content admin panel", "Launch training"],
            },
            {
              service: "mobile",
              name: "Mobile apps",
              definition: "iOS and Android apps with near-native performance and considered UX.",
              forWhom: "Products that need to live in their customer's pocket.",
              problems: ["An app idea with no technical path", "An existing app crashing with low ratings"],
              deliverables: ["App published on both stores", "Admin panel for content and push"],
            },
            {
              service: "systems",
              name: "Business systems",
              definition: "Internal systems managing requests, customers, permissions and reports in one place.",
              forWhom: "Teams drowning in scattered files and chat threads.",
              problems: ["Data spread across archives and email", "Nobody knows a request's status in real time"],
              deliverables: ["Custom system with roles and permissions", "Full audit trail of operations"],
            },
          ],
          labels: { forWhom: "Who is it for?", problems: "Problems we solve", deliverables: "What you get" },
          requestLabel: "Request this service",
        },
      },
    ],
  },
  {
    key: "works",
    nameAr: "معرض الأعمال",
    nameEn: "Works showcase",
    descAr: "ترويسة + دراسات حالة موسعة (المشكلة، المستخدمون، الوظائف) — لعرض أعمالك بثقة.",
    descEn: "Header + extended case studies (problem, users, functions) — present your work with confidence.",
    blocksAr: [
      {
        id: "t-works-header",
        type: "pageHeader",
        props: {
          kicker: "أعمالنا",
          title: "منتجات نفخر بشاركتنا فيها",
          intro: ["نماذج مختارة من أعمالنا — لكل حالة سياقها ومشكلتها وما خرجت به."],
        },
      },
      {
        id: "t-works-full",
        type: "worksFull",
        props: {
          intro: "الأعمال أدناه أمثلة توضيحية — استبدلها بقضاياك الحقيقية من لوحة الخصائص.",
          labels: { problem: "المشكلة", users: "المستخدمون", functions: "الوظائف", status: "النوع" },
          statuses: { design: "تصميم", interactive: "تفاعلي", flow: "تدفق عمل" },
          cases: [
            {
              key: "case-store",
              title: "متجر إلكتروني لمنتجات حرفية",
              kind: "design",
              summary: "واجهة بيع سريعة برحلة شراء من ثلاث خطوات وسلة محفوظة تلقائيًا.",
              problem: "بائع حرفي يبيع عبر رسائل مبعثرة وفواتير يدوية.",
              users: "عملاء محليون يشترون من الهاتف غالبًا.",
              functions: ["كاتالوج منتجات بالصور", "دفع عند الاستلام", "تأكيد طلب برسالة نصية"],
            },
            {
              key: "case-booking",
              title: "نظام حجز مواعيد لعيادة",
              kind: "flow",
              summary: "حجز ذاتي بتقويم حي وتذكير تلقائي قبل الموعد بساعتين.",
              problem: "مكتب استقبال يغرق في مكالمات الحجز والتعديل.",
              users: "مرضى وعمال استقبال.",
              functions: ["تقويم مواعيد حي", "تذكير تلقائي", "ملف مريض مختصر"],
            },
          ],
          interactiveNote: "النماذج التفاعلية تعمل هنا بمعاينة آمنة.",
          flowNote: "خرائط التدفق تُحدَّث مع كل تغيير في المتطلبات.",
        },
      },
    ],
    blocksEn: [
      {
        id: "t-works-header",
        type: "pageHeader",
        props: {
          kicker: "Our works",
          title: "Products we're proud to share",
          intro: ["Selected samples of our work — each case with its context, problem and outcome."],
        },
      },
      {
        id: "t-works-full",
        type: "worksFull",
        props: {
          intro: "The cases below are illustrative — replace them with your real cases from the properties panel.",
          labels: { problem: "Problem", users: "Users", functions: "Functions", status: "Kind" },
          statuses: { design: "Design", interactive: "Interactive", flow: "Workflow" },
          cases: [
            {
              key: "case-store",
              title: "E-commerce store for handmade goods",
              kind: "design",
              summary: "A fast selling interface with a three-step checkout and auto-saved cart.",
              problem: "A craftsman selling through scattered chats and manual invoices.",
              users: "Local customers, mostly buying from phones.",
              functions: ["Photo product catalog", "Cash on delivery", "SMS order confirmation"],
            },
            {
              key: "case-booking",
              title: "Clinic appointment booking system",
              kind: "flow",
              summary: "Self-service booking with a live calendar and automatic reminder two hours ahead.",
              problem: "A reception desk drowning in booking calls.",
              users: "Patients and reception staff.",
              functions: ["Live appointment calendar", "Automatic reminders", "Compact patient file"],
            },
          ],
          interactiveNote: "Interactive demos run here in a safe preview.",
          flowNote: "Flow maps update with every requirement change.",
        },
      },
    ],
  },
  {
    key: "process",
    nameAr: "آلية العمل",
    nameEn: "How we work",
    descAr: "ترويسة + مراحل العمل الكاملة (الهدف، دورنا، دورك، المخرجات) — صفحة توضيح منهجية.",
    descEn: "Header + full working phases (goal, our role, your role, deliverables) — a methodology page.",
    blocksAr: [
      {
        id: "t-process-header",
        type: "pageHeader",
        props: {
          kicker: "آلية العمل",
          title: "من الفكرة إلى الإطلاق في مراحل واضحة",
          intro: ["كل مرحلة لها هدف محدد ومخرجات تراجعها وتعتمدها قبل الانتقال لما بعدها."],
        },
      },
      {
        id: "t-process-full",
        type: "processFull",
        props: {
          intro: "لا نقفز إلى الكود مباشرة — الفكرة التي لم تُكتب لا تُبنى.",
          labels: { clientRole: "دورك في هذه المرحلة", deliverables: "ماذا تستلم؟" },
          phases: [
            {
              title: "التحليل والتخطيط",
              goal: "فهم المشكلة والنطاق ومؤشرات النجاح قبل أي تصميم.",
              weDo: ["جلسة اكتشاف معك", "توثيق النطاق والمتطلبات", "خطة مراحل وزمنية"],
              clientRole: "تشرح عملك وأولوياتك ونراجع معك النطاق المكتوب.",
              deliverables: ["مستند نطاق المشروع", "جدول زمني بالمراحل"],
            },
            {
              title: "التصميم والتجربة",
              goal: "واجهات تحل مشكلات حقيقية لا مجرد شكل جميل.",
              weDo: ["خرائط تدفق وشاشات أولية", "نموذج تفاعلي قابل للتجربة", "مراجعتان للتصميم معك"],
              clientRole: "تجرّب النموذج التفاعلي وتجمع ملاحظات فريقك.",
              deliverables: ["تصميم نهائي معتمد", "نموذج تفاعلي للعرض"],
            },
            {
              title: "التطوير والاختبار",
              goal: "بناء المنتج بجودة قابلة للقياس وتوسعة لاحقة.",
              weDo: ["تطوير على دفعات أسبوعية", "اختبارات آلية ويدوية", "رابط معاينة حي عند كل دفعة"],
              clientRole: "تتابع المعاينة الحية وتسجل ملاحظاتها في مكان واحد.",
              deliverables: ["منتج يعمل على رابط معاينة", "تقرير اختبارات لكل دفعة"],
            },
            {
              title: "الإطلاق والتشغيل",
              goal: "انتقال سلس إلى التشغيل الفعلي بلا مفاجآت.",
              weDo: ["إعداد الاستضافة والنطاق", "نقل البيانات واختبارها", "تدريب فريقك وتسليم التوثيق"],
              clientRole: "تشارك بجلسة التدريب وتعتمد قائمة الإطلاق.",
              deliverables: ["منتج منشور ومستقر", "توثيق تشغيل وتدريب مسجل"],
            },
          ],
          changes: {
            kicker: "وبعد الإطلاق؟",
            title: "التحسين المستمر جزء من العقد",
            body: "نقيس الاستخدام بعد الإطلاق ونقترح تحسينات دورية بناءً على أرقام حقيقية لا انطباعات.",
            items: ["تقرير شهري للاستخدام", "تحسينات أداء وأمان دورية", "أولوية دعم للعملاء النشطين"],
          },
        },
      },
    ],
    blocksEn: [
      {
        id: "t-process-header",
        type: "pageHeader",
        props: {
          kicker: "How we work",
          title: "From idea to launch in clear phases",
          intro: ["Every phase has a defined goal and deliverables you review and approve before moving on."],
        },
      },
      {
        id: "t-process-full",
        type: "processFull",
        props: {
          intro: "We never jump straight to code — an unwritten idea doesn't get built.",
          labels: { clientRole: "Your role in this phase", deliverables: "What you get" },
          phases: [
            {
              title: "Analysis & planning",
              goal: "Understand the problem, scope and success metrics before any design.",
              weDo: ["Discovery session with you", "Written scope and requirements", "Phased plan and timeline"],
              clientRole: "Explain your business and priorities; review the written scope with us.",
              deliverables: ["Project scope document", "Phased timeline"],
            },
            {
              title: "Design & experience",
              goal: "Interfaces that solve real problems — not just pretty shapes.",
              weDo: ["Flow maps and wireframes", "Clickable interactive prototype", "Two design reviews with you"],
              clientRole: "Try the prototype and collect your team's feedback.",
              deliverables: ["Approved final design", "Interactive demo prototype"],
            },
            {
              title: "Development & testing",
              goal: "Build the product with measurable, extensible quality.",
              weDo: ["Weekly batch delivery", "Automated and manual testing", "Live preview link per batch"],
              clientRole: "Follow the live preview and log feedback in one place.",
              deliverables: ["Working product on a preview link", "Test report per batch"],
            },
            {
              title: "Launch & operation",
              goal: "A smooth transition to real operation with no surprises.",
              weDo: ["Hosting and domain setup", "Data migration and verification", "Team training and documentation"],
              clientRole: "Join the training session and approve the launch checklist.",
              deliverables: ["Published, stable product", "Runbook and recorded training"],
            },
          ],
          changes: {
            kicker: "And after launch?",
            title: "Continuous improvement is part of the contract",
            body: "We measure usage after launch and propose regular improvements based on real numbers, not impressions.",
            items: ["Monthly usage report", "Regular performance and security updates", "Priority support for active clients"],
          },
        },
      },
    ],
  },
  {
    key: "contact",
    nameAr: "تواصل معنا",
    nameEn: "Contact page",
    descAr: "ترويسة + قسم بيانات تواصل داخل حاوية + نموذج طلب مباشر — صفحة تحويل جاهزة.",
    descEn: "Header + contact details in a styled container + a direct request form — a ready conversion page.",
    blocksAr: [
      {
        id: "t-contact-header",
        type: "pageHeader",
        props: {
          kicker: "تواصل",
          title: "نحب أن نسمع فكرتك",
          intro: ["اختر ما يناسبك: رسالة سريعة أو نموذج طلب مفصل — كلاهما يصل إلينا فورًا."],
        },
      },
      section("t-contact-info-section", "soft", [
        heading("t-contact-info-h", "بيانات التواصل", 2),
        text("t-contact-info-t", ["نرد على الرسائل خلال يوم عمل واحد. للطلبات العاجلة استخدم النموذج أدناه مباشرة."]),
        {
          id: "t-contact-info",
          type: "contactInfo",
          props: {
            channels: [
              { kind: "email", label: "البريد الإلكتروني", value: "hello@so7ob.tech", href: "mailto:hello@so7ob.tech" },
              { kind: "phone", label: "الهاتف", value: "+000 000 0000", href: "tel:+0000000000" },
              { kind: "address", label: "العنوان", value: "المدينة — شارع الأعمال، مبنى ١٢" },
            ],
          },
        },
        divider("t-contact-divider"),
      ]),
      {
        id: "t-contact-form",
        type: "requestForm",
        props: { showPrivacy: true, showNextSteps: true },
      },
    ],
    blocksEn: [
      {
        id: "t-contact-header",
        type: "pageHeader",
        props: {
          kicker: "Contact",
          title: "We'd love to hear your idea",
          intro: ["Pick what suits you: a quick message or a detailed request form — both reach us instantly."],
        },
      },
      section("t-contact-info-section", "soft", [
        heading("t-contact-info-h", "Contact details", 2),
        text("t-contact-info-t", ["We reply within one business day. For urgent requests use the form below directly."]),
        {
          id: "t-contact-info",
          type: "contactInfo",
          props: {
            channels: [
              { kind: "email", label: "Email", value: "hello@so7ob.tech", href: "mailto:hello@so7ob.tech" },
              { kind: "phone", label: "Phone", value: "+000 000 0000", href: "tel:+0000000000" },
              { kind: "address", label: "Address", value: "Business district — Building 12" },
            ],
          },
        },
        divider("t-contact-divider"),
      ]),
      {
        id: "t-contact-form",
        type: "requestForm",
        props: { showPrivacy: true, showNextSteps: true },
      },
    ],
  },
];

/** مفاتيح القوالب المدمجة — للتحقق السريع في المسارات */
export const BUILTIN_TEMPLATE_KEYS = new Set(BUILTIN_TEMPLATES.map((t) => t.key));
