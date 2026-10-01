/**
 * أنواع المحتوى — تضمن تكافؤ النسختين العربية والإنجليزية بنفس البنية تمامًا.
 * اختبار `i18n-parity` يفشل فورًا إن اختلفت المفاتيح بين اللغتين.
 */
import type { FieldErrorCode, ServiceType } from "@/lib/validation";

export type PageKey = "home" | "about" | "services" | "works" | "process" | "faq" | "contact";

export type WorkKind = "design" | "interactive" | "flow";

export interface SiteContent {
  meta: {
    siteName: string;
    shortName: string;
    tagline: string;
    pages: Record<PageKey, { title: string; description: string }>;
  };
  nav: Record<PageKey, string>;
  actions: {
    discuss: string;
    quote: string;
    learnMore: string;
    requestService: string;
    viewAllFaq: string;
    viewAllWorks: string;
    viewAllServices: string;
    backHome: string;
  };
  home: {
    hero: {
      kicker: string;
      title: string;
      titleAccent: string;
      description: string;
      support: string[];
    };
    services: {
      kicker: string;
      title: string;
      description: string;
      cards: { service: ServiceType; blurb: string }[];
    };
    why: {
      kicker: string;
      title: string;
      items: { title: string; body: string }[];
    };
    works: {
      kicker: string;
      title: string;
      description: string;
      cases: { key: string; title: string; kind: WorkKind; summary: string; badge: string }[];
    };
    process: {
      kicker: string;
      title: string;
      steps: { title: string; line: string }[];
    };
    faq: {
      kicker: string;
      title: string;
      selected: number[];
    };
    finalCta: {
      title: string;
      body: string;
      discussNote: string;
      quoteNote: string;
    };
  };
  about: {
    kicker: string;
    title: string;
    intro: string[];
    vision: { title: string; body: string };
    mission: { title: string; body: string };
    valuesTitle: string;
    valuesIntro: string;
    values: { title: string; body: string }[];
    principlesTitle: string;
    principles: { title: string; body: string }[];
    honesty: string;
  };
  services: {
    kicker: string;
    title: string;
    intro: string;
    labels: { forWhom: string; problems: string; deliverables: string };
    items: {
      service: ServiceType;
      name: string;
      definition: string;
      forWhom: string;
      problems: string[];
      deliverables: string[];
    }[];
  };
  works: {
    kicker: string;
    title: string;
    intro: string;
    disclaimer: { title: string; body: string };
    labels: { problem: string; users: string; functions: string; status: string };
    statuses: Record<WorkKind, string>;
    cases: {
      key: string;
      title: string;
      kind: WorkKind;
      summary: string;
      problem: string;
      users: string;
      functions: string[];
    }[];
    interactiveNote: string;
    flowNote: string;
  };
  process: {
    kicker: string;
    title: string;
    intro: string;
    labels: { clientRole: string; deliverables: string };
    phases: {
      title: string;
      goal: string;
      weDo: string[];
      clientRole: string;
      deliverables: string[];
    }[];
    changes: {
      kicker: string;
      title: string;
      body: string;
      items: string[];
    };
  };
  faq: {
    kicker: string;
    title: string;
    intro: string;
    items: { q: string; a: string }[];
  };
  contact: {
    kicker: string;
    title: string;
    description: string;
    nextTitle: string;
    nextSteps: { title: string; body: string }[];
    privacyTitle: string;
    privacyBody: string;
    privacyItems: string[];
  };
  form: {
    title: string;
    requiredNote: string;
    requestTypeLabel: string;
    serviceLabel: string;
    descriptionLabel: string;
    descriptionHint: string;
    budgetLabel: string;
    currencyLabel: string;
    timelineLabel: string;
    nameLabel: string;
    companyLabel: string;
    emailLabel: string;
    phoneLabel: string;
    preferredContactLabel: string;
    referenceUrlLabel: string;
    optional: string;
    choose: string;
    requestTypes: Record<"discussion" | "quote", string>;
    services: Record<ServiceType, string>;
    budgets: Record<"tier1" | "tier2" | "tier3" | "tier4" | "unspecified", string>;
    currencies: Record<"SAR" | "AED" | "EGP" | "KWD" | "QAR" | "USD" | "EUR", string>;
    timelines: Record<"flexible" | "asap" | "1-3m" | "3-6m" | "6m+", string>;
    contactMethods: Record<"email" | "phone" | "any", string>;
    submit: string;
    submitting: string;
    success: {
      title: string;
      body: string;
      refLabel: string;
      another: string;
    };
    errors: Record<FieldErrorCode, string>;
    serverErrors: {
      invalid: string;
      duplicate: string;
      rateLimited: string;
      generic: string;
    };
    honeyLabel: string;
  };
  footer: {
    about: string;
    pagesTitle: string;
    servicesTitle: string;
    rights: string;
    illustrativeNote: string;
    repoLink: string;
  };
  common: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    switchLanguage: string;
    languageSwitched: string;
    brandAria: string;
  };
}
