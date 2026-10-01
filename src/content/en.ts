import type { SiteContent } from "./types";

/** English content — structurally identical to the Arabic source of truth */
export const en: SiteContent = {
  meta: {
    siteName: "so7ob | سُحُب التقنية",
    shortName: "so7ob",
    tagline: "Raining smart solutions.",
    pages: {
      home: {
        title: "so7ob | Raining smart solutions — websites, apps & systems",
        description:
          "We turn your ideas and business needs into easy-to-use websites, apps and systems, connect your tools and automate routines. Clear scope, staged delivery, post-launch support.",
      },
      about: {
        title: "About | so7ob",
        description:
          "A software company that understands the business before building the software: we start from the problem, users and desired outcome, then design and build in reviewable stages.",
      },
      services: {
        title: "Services | so7ob",
        description:
          "Web development, mobile apps, admin systems, UI/UX design, business automation with AI, and maintenance & support.",
      },
      works: {
        title: "Work | so7ob",
        description:
          "Illustrative case studies that show how we think about design and delivery — clearly labelled, never attributed to clients.",
      },
      process: {
        title: "How we work | so7ob",
        description:
          "Four clear stages: understand & define, design & review, build & test, launch & deliver & support — with a defined client role and known deliverables at each stage.",
      },
      faq: {
        title: "FAQ | so7ob",
        description:
          "Straight answers about ideas, cost, timeline, changes, deliverables, hosting, AI, and the nature of our showcased projects.",
      },
      contact: {
        title: "Contact | so7ob",
        description:
          "Tell us what you want to accomplish and who will use it — no technical specs needed; a clear description of the problem is enough to start.",
      },
    },
  },

  nav: {
    home: "Home",
    about: "About",
    services: "Services",
    works: "Work",
    process: "How we work",
    faq: "FAQ",
    contact: "Contact",
  },

  actions: {
    discuss: "Discuss your project",
    quote: "Request a quote",
    learnMore: "Learn more",
    requestService: "Request this service",
    viewAllFaq: "All questions",
    viewAllWorks: "Explore all three cases",
    viewAllServices: "All service details",
    backHome: "Back to home",
  },

  home: {
    hero: {
      kicker: "Software that starts from understanding your business.",
      title: "Raining",
      titleAccent: "smart solutions.",
      description:
        "We turn your ideas and business needs into easy-to-use websites, apps and systems, connect your tools and automate your routines — so you start with a clear solution and grow it as your business grows.",
      support: ["Clear scope.", "Staged delivery.", "Post-launch support."],
    },
    services: {
      kicker: "What we do",
      title: "Main services",
      description: "Six areas we cover from idea to operation — start with any one of them or combine them in a single project.",
      cards: [
        { service: "web", blurb: "A clear digital presence and tools that help users get things done." },
        { service: "mobile", blurb: "Experiences built for repeated use and native phone capabilities." },
        { service: "systems", blurb: "Organizing requests, tasks, approvals, roles and reports." },
        { service: "ux", blurb: "Turning the idea into journeys, screens and forms you can review." },
        { service: "automation", blurb: "Cutting repetitive steps and connecting tools, with accuracy and cost reviewed." },
        { service: "maintenance", blurb: "Monitoring operations, handling incidents and updates under a clear agreement." },
      ],
    },
    why: {
      kicker: "Why so7ob",
      title: "What sets our approach apart",
      items: [
        {
          title: "We start from your business, not from code",
          body: "The first thing we write is not code but a written description of the problem, the users and the desired outcome. If we don't understand the business, the software misses its purpose — so understanding is a separate, reviewable step with its own deliverables.",
        },
        {
          title: "Written scope and acceptance criteria before building",
          body: "Before anything is built we agree on what will be done, what won't, and how success is verified. This reduces late disputes, makes every stage measurable, and gives you an honest picture of cost and time.",
        },
        {
          title: "Reviewable stages, not a black box",
          body: "Work is delivered incrementally in regular reviews you can see and try before moving forward. Your feedback lands early where it is cheapest to apply, and the picture stays clear from week one.",
        },
        {
          title: "A handover you own, with documentation that stays",
          body: "Code, documentation and run instructions are handed over in full, with no lock-in for launching or operating. If you wish, we continue with support and development under a clear agreement.",
        },
      ],
    },
    works: {
      kicker: "Case studies",
      title: "How we think, in practice",
      description: "Three cases showing how we analyse a problem and propose functionality — fully illustrative, never client work.",
      cases: [
        {
          key: "portal",
          title: "Service request portal",
          kind: "design",
          summary: "One channel that receives requests and tracks each one through to closure.",
          badge: "Design concept",
        },
        {
          key: "booking",
          title: "Appointment booking experience",
          kind: "interactive",
          summary: "Booking in three clear steps with live availability.",
          badge: "Interactive prototype",
        },
        {
          key: "automation",
          title: "Inquiry follow-up automation",
          kind: "flow",
          summary: "A workflow that triages inquiries so nothing slips through.",
          badge: "Workflow diagram",
        },
      ],
    },
    process: {
      kicker: "How we work",
      title: "A clear step at every stage",
      steps: [
        { title: "Understand & define", line: "The problem, scope and acceptance criteria." },
        { title: "Design & review", line: "Journeys, screens and an interactive prototype." },
        { title: "Build & test", line: "Incremental development and regular reviews." },
        { title: "Launch, deliver & support", line: "Acceptance, launch, documentation and support." },
      ],
    },
    faq: {
      kicker: "Common questions",
      title: "Selected frequently asked questions",
      selected: [0, 1, 3, 5],
    },
    finalCta: {
      title: "What do you want to accomplish?",
      body: "Tell us your idea or problem as it is — a clear description is enough to start the conversation; we'll help you sort out the details.",
      discussNote: "An open discussion to understand the need before any commitment.",
      quoteNote: "A proposal with scope, stages and acceptance criteria.",
    },
  },

  about: {
    kicker: "About us",
    title: "We understand the business, then we build the software.",
    intro: [
      "so7ob is a software company focused on the needs of small and medium businesses and entrepreneurs in the Arab market. We start by understanding the problem, the users and the desired outcome, then design and build the solution in clear, reviewable stages.",
      "We treat software as a work tool, not an end in itself: every screen and every feature must help a specific person complete their task with less effort, fewer errors and a reasonable operating cost. That is why we write the scope before the code, and measure success against agreed criteria rather than general impressions.",
    ],
    vision: {
      title: "Vision",
      body: "To make building and using software a clear, accessible experience for businesses and entrepreneurs in the Arab market.",
    },
    mission: {
      title: "Mission",
      body: "Designing and developing digital solutions that address real needs, balancing user experience, execution quality and operating cost.",
    },
    valuesTitle: "Values",
    valuesIntro: "Five values govern our decisions in design, delivery and how we work with you:",
    values: [
      { title: "Clarity", body: "Direct language about promises, prices and timelines; a written scope open to no interpretation; and honest notes when something isn't ready yet." },
      { title: "Practical benefit", body: "We evaluate every feature with one question: what does it add to the user and the business? What serves no clear purpose is postponed or dropped, however attractive it looks." },
      { title: "Craft", body: "Execution quality shows in small details: loading speed, reading comfort, clear errors, and consistent behaviour across screens." },
      { title: "Responsibility", body: "We own the results of our work, handle incidents under a known agreement, and say plainly when a simpler or cheaper solution is better than what was asked." },
      { title: "Partnership", body: "We succeed when your project succeeds — we treat clients as partners in knowledge and decisions, not as a ticket queue." },
    ],
    principlesTitle: "How we approach every project",
    principles: [
      { title: "Understanding before proposing", body: "We don't quote before we understand the problem and its users; incomplete understanding means the wrong scope and surprise costs later." },
      { title: "Smallest useful version first", body: "We prefer starting with a working version that serves the core purpose, then expanding based on real usage rather than assumptions." },
      { title: "Documented decisions", body: "Approvals, scope and changes are all written down, so reviews stay fast and both parties' rights and obligations remain clear." },
    ],
    honesty: "so7ob is a startup: what this website presents is our service scope and way of working only. We claim no clients, projects or numbers we haven't achieved.",
  },

  services: {
    kicker: "Services",
    title: "Services that start from a clear need.",
    intro:
      "Each service has a specific definition, who it suits, and what it produces. Pick the closest to your need — or send an open description and we'll shape the path together.",
    labels: { forWhom: "Who is it for?", problems: "Problems it addresses", deliverables: "Expected deliverables" },
    items: [
      {
        service: "web",
        name: "Websites & web applications",
        definition: "A clear digital presence and tools that help users get things done: a convincing company website, a store, or a web app delivering a full service in the browser.",
        forWhom: "Companies without a digital presence that matches their work, owners of slow outdated websites, or teams that need a working tool reachable through the browser.",
        problems: [
          "A website that fails to explain what the company offers, losing visitors before contact.",
          "A service managed manually by phone and paper, impossible to track.",
          "A site that breaks on mobile and loses most of its visitors.",
        ],
        deliverables: [
          "A fast, responsive bilingual website with easy content editing.",
          "Forms and sign-up tools whose data lands somewhere reliable.",
          "Baseline SEO and usage analytics.",
        ],
      },
      {
        service: "mobile",
        name: "Mobile applications",
        definition: "Experiences built for repeated use and phone capabilities: timely push notifications, offline support where needed, and instant access to the core function.",
        forWhom: "Services customers use daily or weekly, anything that needs timely notifications, and field teams whose tools must travel with them.",
        problems: [
          "A website that demands long login paths every time the user returns.",
          "Important alerts that never reach your customers on time.",
          "A field team collecting data on paper, re-entering it manually.",
        ],
        deliverables: [
          "One app for Android and iOS with consistent quality.",
          "Scheduled notifications tied to real events.",
          "Store delivery with publishing and update setup.",
        ],
      },
      {
        service: "systems",
        name: "Admin systems",
        definition: "Organizing requests, tasks, approvals, roles and reports in one system that mirrors how your organisation actually works — instead of forcing a generic workflow on it.",
        forWhom: "Organisations running operations through scattered files and chat groups, needing clear ownership of every step and trustworthy reporting.",
        problems: [
          "Requests lost between email and messaging apps, with no one knowing their status.",
          "Approvals stuck because there is no sequence or notification flow.",
          "Monthly reports assembled manually, consuming days.",
        ],
        deliverables: [
          "A system with roles and permissions shaped by your structure.",
          "A full audit trail for every request: who created it and what happened.",
          "Automated, exportable reports for decisions and follow-up.",
        ],
      },
      {
        service: "ux",
        name: "UI/UX design",
        definition: "Turning the idea into journeys, screens and forms you can review before any code is written — so mistakes get corrected on paper, where they cost far less.",
        forWhom: "Anyone with an idea that needs to become tangible before committing to development, or anyone with confusing interfaces that drive up support and leave features unused.",
        problems: [
          "A clear idea in your head that developers or investors can't picture.",
          "Scattered screens where users can't find the core function.",
          "Sign-up forms so confusing they are abandoned halfway.",
        ],
        deliverables: [
          "User journeys and screen maps ready for review.",
          "An interactive prototype to try before building.",
          "A visual system guide keeping future work consistent.",
        ],
      },
      {
        service: "automation",
        name: "Business automation & AI integration",
        definition: "Cutting repetitive steps and connecting the tools you already use, applying AI where it genuinely fits: classification, summarisation, drafting and data extraction — with accuracy, cost and data reviewed.",
        forWhom: "Teams spending their time copying data between systems or answering similar questions over and over, with scattered tools that need one connected workflow.",
        problems: [
          "The same data entered manually into three different systems.",
          "Similar inquiries eating up the support team's day.",
          "Documents requiring manual reading and sorting before any action.",
        ],
        deliverables: [
          "An automated workflow connecting your current tools in one path.",
          "AI functions whose accuracy is measured before relying on them.",
          "Monitoring and alerts when the path needs a human touch.",
        ],
      },
      {
        service: "maintenance",
        name: "Maintenance, support & continuous development",
        definition: "Monitoring operations, handling incidents and shipping updates under a clear agreement that defines response time, what's included and what isn't — so your product keeps working and improving.",
        forWhom: "Anyone with a live product that needs care: monitoring, incident handling, security updates and gradual improvements, without an in-house technical team.",
        problems: [
          "A product that works but nobody dares to change, afraid of breaking it.",
          "Outages discovered by customers before the operations team.",
          "Postponed improvements piling up into a large burden.",
        ],
        deliverables: [
          "A written support agreement defining scope and response time.",
          "Regular monitoring and incident handling per the agreement.",
          "Scheduled updates and improvements preserving product quality.",
        ],
      },
    ],
  },

  works: {
    kicker: "Our work",
    title: "Illustrative cases of how we think",
    intro:
      "Instead of general promises, we present cases mirroring recurring needs in the market: how we read the problem, who we define as users, and what functionality we propose and prioritise.",
    disclaimer: {
      title: "Illustrative projects to explore our thinking, design and execution — not work attributed to clients.",
      body: "Every case here is our own framing of a common need, and all displayed data is synthetic. We clearly distinguish between a “design concept”, an “interactive prototype” and a “workflow diagram”, and we never show a demo link unless it actually works.",
    },
    labels: { problem: "The problem", users: "The users", functions: "Proposed functionality", status: "Implementation status" },
    statuses: {
      design: "Design concept",
      interactive: "Local interactive prototype",
      flow: "Workflow diagram",
    },
    cases: [
      {
        key: "portal",
        title: "Service request portal & tracking",
        kind: "design",
        summary: "A single channel that receives customer requests and organises each one's path from arrival to closure, with visible status at every moment.",
        problem:
          "Requests arrive through scattered channels: phone, email, messaging apps. Some get lost, the rest get delayed, and no one can answer “where is my request?” without a painful manual search.",
        users: "The customer submitting and tracking the request; the intake officer classifying and assigning them; the coordinator monitoring progress and response times.",
        functions: [
          "A stepped request form that classifies and collects the necessary details.",
          "A tracking number showing the customer their status without complex sign-up.",
          "Assigning an owner per request, with recorded reasons for changes.",
          "Notifications on every status change — in-app and by email.",
          "A dashboard of response times and overdue requests.",
        ],
      },
      {
        key: "booking",
        title: "Appointment booking & management experience",
        kind: "interactive",
        summary: "Booking in three clear steps: choose the service, pick a suitable time, confirm — with live visibility of available slots.",
        problem:
          "Booking happens over message threads: the client proposes a time, gets an apology or a confirmation, then the appointment is forgotten. The result is double-bookings, long waits, and staff time lost to coordination.",
        users: "The client who wants a suitable slot in as few steps as possible; the receptionist managing availability and multiple providers.",
        functions: [
          "Showing only genuinely available slots per service and provider.",
          "Booking in a few steps with instant confirmation and a clear summary.",
          "Cancellation and rescheduling under clearly stated conditions.",
          "Reminders before the appointment to reduce no-shows.",
          "Automatic prevention of double-booking the same slot.",
        ],
      },
      {
        key: "automation",
        title: "Inquiry follow-up automation workflow",
        kind: "flow",
        summary: "An automated path that receives website inquiries, triages them, assigns each to an owner — and guarantees no inquiry goes unanswered.",
        problem:
          "Inquiries arrive from several channels and get read by one busy person; some are forgotten after the first reply, and follow-up depends on memory. The difference between closing a deal and losing it becomes mere forgetfulness.",
        users: "The sales team receiving and following up on inquiries; the potential customer waiting for a clear reply within a reasonable time.",
        functions: [
          "Unified intake of all website inquiries in one place.",
          "Initial automatic triage: service type and priority level.",
          "Automatic assignment to a follow-up owner with a deadline.",
          "Recurring reminders until a reply is logged or the inquiry is closed.",
          "A weekly report: what arrived, what was answered, what slipped and why.",
        ],
      },
    ],
    interactiveNote: "This prototype is local and for illustration only: its data is synthetic and nothing is sent or stored.",
    flowNote: "The diagram illustrates the path's logic and its human decision points; it is not a running tool.",
  },

  process: {
    kicker: "How we work",
    title: "A clear step at every stage.",
    intro:
      "We divide the work into four stages, each with a goal, deliverables and a defined role for you. Every stage ends with a review — and you decide when to move to the next.",
    labels: { clientRole: "Your role at this stage", deliverables: "What you receive" },
    phases: [
      {
        title: "Understand & define",
        goal: "Turning your idea into a written, buildable, measurable scope.",
        weDo: [
          "An understanding session: the problem, the users, the desired outcome.",
          "A quick study of alternatives and real constraints.",
          "Writing the scope: what will be built and what won't.",
          "Drafting clear acceptance criteria for every part.",
        ],
        clientRole: "Share your business context, users and constraints, and correct our understanding before the scope is approved.",
        deliverables: ["An approved scope document with acceptance criteria.", "An initial stage plan with clear priorities."],
      },
      {
        title: "Design & review",
        goal: "Making the solution tangible before it is built, correcting its course on paper.",
        weDo: [
          "Mapping user journeys and core screens.",
          "Building an interactive prototype to actually try the flow.",
          "Reviewing content direction, both languages, and accessibility.",
          "Auditing the design against the written acceptance criteria.",
        ],
        clientRole: "Try the interactive prototype, gather feedback from real users if possible, and approve the screens before development.",
        deliverables: ["A prototype you can try.", "Approved screens ready for development."],
      },
      {
        title: "Build & test",
        goal: "Visible incremental development, not a black box, with continuous testing.",
        weDo: [
          "Short batches of work, shown to you regularly.",
          "Testing functions on mobile and desktop, in both languages.",
          "Automated quality checks preventing regressions.",
          "Handling feedback during development, not after.",
        ],
        clientRole: "Review and try each visible batch, log your notes, and accept each batch before the next.",
        deliverables: ["A pre-launch version for your testing.", "Review reports for every batch."],
      },
      {
        title: "Launch, deliver & support",
        goal: "A safe launch and a complete handover you own, with clear support arrangements.",
        weDo: [
          "A final acceptance checklist against stage-one criteria.",
          "Deployment setup and safe data migration where applicable.",
          "Documentation for operations, content and translation edits.",
          "A handover session training your team on usage.",
        ],
        clientRole: "Run the final acceptance on your side, approve the launch, and set the post-launch support arrangements with us.",
        deliverables: ["The product launched on your domain.", "Full code, documentation and access details.", "A support agreement if you choose to continue with us."],
      },
    ],
    changes: {
      kicker: "Changes",
      title: "How are change requests handled?",
      body: "Change is natural in any project; the mistake is not in change appearing but in executing it without understanding its impact. So every change request follows one path:",
      items: [
        "The request is documented: what is needed, why, and which stage it touches.",
        "We assess its impact on scope, time and cost and present it clearly.",
        "Execution starts only after you approve the agreed impact.",
        "The stage plan and acceptance criteria are updated to include the change.",
      ],
    },
  },

  faq: {
    kicker: "FAQ",
    title: "Direct answers to what we're asked most",
    intro: "If your question isn't here, write to us openly — we'll answer honestly even if the honest answer is that we're not the right fit.",
    items: [
      {
        q: "Does my idea need to be complete?",
        a: "No. Most projects start with a page or a paragraph describing the problem and the goal. Our job in the first stage is to turn a raw idea into a written scope with acceptance criteria — that is part of the structured work, not a precondition for contacting us.",
      },
      {
        q: "How is the project cost determined?",
        a: "After understanding the scope in the “understand & define” stage, we issue a proposal itemising what will be built and its prices. Cost follows the scope and acceptance criteria, not the other way around — which is why we don't announce general prices before knowing exactly what we're building.",
      },
      {
        q: "How is the delivery timeline determined?",
        a: "Based on the size of the scope, its stages, and review cadence. We provide an estimated schedule with the proposal and update it whenever a change is announced. We avoid promising short timelines that win approval and then erode quality.",
      },
      {
        q: "Can we start with a small version?",
        a: "Yes — and we usually recommend it. A small first version serving the real core of the service lets you measure actual usage early; we then expand based on real user behaviour rather than assumptions. It reduces risk and makes every later step more precise.",
      },
      {
        q: "How are changes managed during development?",
        a: "Every change request follows one path: it is documented, we assess its impact on scope, time and cost, and it is executed only after your approval. The stage plan and acceptance criteria are then updated — so cost or duration never shifts opaquely.",
      },
      {
        q: "What does the client receive at the end?",
        a: "The full source code, documentation with operating and content-editing instructions, access details for all services used, and a handover session for your team. You own everything with no forced dependency on us to launch or operate.",
      },
      {
        q: "Are hosting and support included?",
        a: "Hosting is an operating cost paid directly to the hosting provider in your name; we help you choose and set it up. Post-launch support is arranged in a written agreement defining its scope and response time — we never advertise support commitments we haven't agreed on.",
      },
      {
        q: "When is AI actually appropriate?",
        a: "When the task is repetitive and measurable: classification, summarisation, drafting, or extracting data from text — and there is enough data to measure accuracy. We review before relying on it: real accuracy, running cost, and data sensitivity. Adding AI for appearance's sake, we advise against.",
      },
      {
        q: "Are the showcased projects client work?",
        a: "No. The “Work” page holds illustrative cases we crafted to show how we think, design and execute — labelled as such and never attributed to any client. When we deliver real client work, we show it with permission and within limits they set.",
      },
    ],
  },

  contact: {
    kicker: "Contact",
    title: "Let's start by understanding your project.",
    description:
      "Tell us what you want to accomplish, who will use the solution, and the time and budget available. You don't need technical specifications; a clear description of the problem is enough to start the conversation.",
    nextTitle: "What happens after you send?",
    nextSteps: [
      { title: "We read your request carefully", body: "Every request is read and stamped with a reference you can cite in any later correspondence." },
      { title: "We ask for clarification if needed", body: "If we need more details, we'll ask short questions before proposing anything." },
      { title: "We suggest the next step", body: "Either a deeper understanding session, or an initial path outlining stages and acceptance criteria." },
    ],
    privacyTitle: "Privacy notice",
    privacyBody: "We respect your data and process the minimum needed to reply to you:",
    privacyItems: [
      "Form data is stored in this project's database solely to respond to your request.",
      "We don't use it for marketing and never share it with third parties.",
      "We keep an anonymised fingerprint of the network address for abuse prevention only — the address itself is not stored.",
      "You can request deletion of your data at any time by replying to the reference message.",
    ],
  },

  form: {
    title: "Project request form",
    requiredNote: "Fields marked * are required; the rest are optional and help us understand the context.",
    requestTypeLabel: "Request type",
    serviceLabel: "Service type",
    descriptionLabel: "Describe your need",
    descriptionHint: "What problem are you trying to solve? Who will use the solution?",
    budgetLabel: "Approximate budget",
    currencyLabel: "Currency",
    timelineLabel: "Target timeline",
    nameLabel: "Name",
    companyLabel: "Company or project name",
    emailLabel: "Email address",
    phoneLabel: "Phone number",
    preferredContactLabel: "Preferred contact method",
    referenceUrlLabel: "Reference link",
    optional: "optional",
    choose: "Select…",
    requestTypes: { discussion: "Project discussion", quote: "Quote request" },
    services: {
      web: "Websites & web applications",
      mobile: "Mobile applications",
      systems: "Admin systems",
      ux: "UI/UX design",
      automation: "Automation & AI",
      maintenance: "Maintenance & support",
      unsure: "I need help deciding",
    },
    budgets: {
      tier1: "Under 20,000",
      tier2: "20,000 – 60,000",
      tier3: "60,000 – 150,000",
      tier4: "Over 150,000",
      unspecified: "Not decided yet",
    },
    currencies: { SAR: "Saudi Riyal (SAR)", AED: "UAE Dirham (AED)", EGP: "Egyptian Pound (EGP)", KWD: "Kuwaiti Dinar (KWD)", QAR: "Qatari Riyal (QAR)", USD: "US Dollar (USD)", EUR: "Euro (EUR)" },
    timelines: { flexible: "Flexible", asap: "As soon as possible", "1-3m": "Within 1–3 months", "3-6m": "Within 3–6 months", "6m+": "In 6+ months" },
    contactMethods: { email: "Email", phone: "Phone", any: "Whatever suits you" },
    submit: "Send request",
    submitting: "Sending…",
    success: {
      title: "Your request has been received",
      body: "Your request has been saved and stamped with a reference. Keep it for later citation — we'll get back to you through the contact method you selected.",
      refLabel: "Reference",
      another: "Send another request",
    },
    errors: {
      required: "This field is required.",
      invalidEmail: "Enter a valid email like name@company.com.",
      invalidPhone: "Enter a valid phone number — digits, optionally starting with the country code.",
      invalidUrl: "Enter a link starting with http:// or https://",
      descriptionShort: "The description is too short — write at least 30 characters to make your need clear.",
      descriptionLong: "The description is too long (limit 5,000 characters) — shorten it or split it into a follow-up message.",
      nameShort: "The name is too short.",
      nameLong: "The name is too long (limit 100 characters).",
      currencyRequired: "Select the currency for the chosen budget.",
      phoneRequiredForPreferred: "You selected phone as the contact method — enter your number or change the method.",
      tooLong: "The text exceeds the allowed limit.",
      invalidValue: "Invalid value.",
    },
    serverErrors: {
      invalid: "Check the highlighted fields and try again.",
      duplicate: "We received an identical request from you a moment ago — no need to send again.",
      rateLimited: "You've reached the temporary sending limit. Wait a little and try again, or send one comprehensive request.",
      generic: "The request could not be saved right now. Your data is preserved in the form — try again in a moment.",
    },
    honeyLabel: "Leave this field empty",
  },

  footer: {
    about: "A software startup helping businesses and entrepreneurs in the Arab market turn their ideas into easy-to-use, scalable digital products.",
    pagesTitle: "Pages",
    servicesTitle: "Services",
    rights: "All rights reserved.",
    illustrativeNote: "Showcased projects are illustrative, not client work.",
    repoLink: "Public repository on GitHub",
  },

  common: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    switchLanguage: "Switch to Arabic",
    languageSwitched: "Language preference saved",
    brandAria: "so7ob — go to home",
  },
};
