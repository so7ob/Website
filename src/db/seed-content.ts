/**
 * بذرة المحتوى الأولي — تنقل صفحات الموقع الثابتة إلى نظام إدارة المحتوى.
 *
 * قابلة لإعادة التشغيل بأمان:
 * - إنشاء الصفحة إن لم توجد.
 * - تحديث البذرة إن وُجدت الصفحة ولم يلمسها محرر (editorTouchedAt = null).
 * - تخطي الصفحة كليًا إن عدّلها المحرر — البذرة لا تكتب فوق عمل المحرر.
 *
 * ترجمات الواجهة (أزرار/رسائل/نموذج) تبقى في src/content/*.ts؛
 * المحتوى التحريري للصفحات يصبح من قاعدة البيانات (مصدر العرض الفعلي).
 */
import { db } from "@/lib/db";
import { ar } from "@/content/ar";
import { en } from "@/content/en";
import { siteConfig } from "@/config/site";
import type { Block } from "@/lib/blocks/types";

const SEED_VERSION = 1;

let idCounter = 0;
function bid(prefix: string): string {
  idCounter += 1;
  return `b-${prefix}-${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function block(type: Block["type"], props: Record<string, unknown>): Block {
  return { id: bid(type), type, props };
}

/** يبني كتل الصفحات من المحتوى الثابت — نفس الأقسام والترتيب الحالي */
function pageBlocks(key: string, locale: "ar" | "en"): Block[] {
  const c = locale === "en" ? en : ar;
  const blocks: Block[] = [];

  if (key === "home") {
    blocks.push(
      block("hero", {
        kicker: c.home.hero.kicker,
        title: c.home.hero.title,
        titleAccent: c.home.hero.titleAccent,
        description: c.home.hero.description,
        support: c.home.hero.support,
      }),
      block("servicesGrid", {
        kicker: c.home.services.kicker,
        title: c.home.services.title,
        description: c.home.services.description,
        cards: c.home.services.cards,
        items: c.services.items,
      }),
      block("featureGrid", {
        kicker: c.home.why.kicker,
        title: c.home.why.title,
        items: c.home.why.items,
        columns: "3",
      }),
      block("worksShowcase", {
        kicker: c.home.works.kicker,
        title: c.home.works.title,
        description: c.home.works.description,
        cases: c.home.works.cases,
        disclaimer: c.works.disclaimer.title,
      }),
      block("processSteps", {
        kicker: c.home.process.kicker,
        title: c.home.process.title,
        steps: c.home.process.steps,
      }),
      block("faqSection", {
        kicker: c.home.faq.kicker,
        title: c.home.faq.title,
        description: c.faq.intro,
        items: c.home.faq.selected.map((i) => c.faq.items[i]).filter(Boolean),
        ctaLabel: c.actions.viewAllFaq,
        ctaHref: "/faq",
      }),
      block("ctaSection", {
        title: c.home.finalCta.title,
        body: c.home.finalCta.body,
        discussNote: c.home.finalCta.discussNote,
        quoteNote: c.home.finalCta.quoteNote,
        links: [
          { label: c.actions.discuss, href: "/contact?type=discussion", variant: "primary" },
          { label: c.actions.quote, href: "/contact?type=quote", variant: "outline" },
        ],
      })
    );
  }

  if (key === "about") {
    blocks.push(
      block("pageHeader", {
        kicker: c.about.kicker,
        title: c.about.title,
        intro: c.about.intro,
      }),
      block("visionMission", { vision: c.about.vision, mission: c.about.mission }),
      block("numberedValues", {
        title: c.about.valuesTitle,
        intro: c.about.valuesIntro,
        items: c.about.values,
        closingNote: c.about.honesty,
      }),
      block("numberedList", { title: c.about.principlesTitle, items: c.about.principles }),
      block("navCtaBanner", {
        label: c.services.title,
        links: [
          { label: c.nav.services, href: "/services", variant: "primary" },
          { label: c.nav.process, href: "/process", variant: "outline" },
        ],
      })
    );
  }

  if (key === "services") {
    blocks.push(
      block("pageHeader", {
        kicker: c.services.kicker,
        title: c.services.title,
        intro: [c.services.intro],
        quickLinks: c.services.items.map((i) => ({ label: i.name, href: `#${i.service}` })),
      }),
      block("servicesDetail", {
        items: c.services.items,
        labels: c.services.labels,
        requestLabel: c.actions.requestService,
      })
    );
  }

  if (key === "works") {
    blocks.push(
      block("pageHeader", {
        kicker: c.works.kicker,
        title: c.works.title,
        intro: [c.works.intro],
      }),
      block("worksFull", {
        disclaimer: c.works.disclaimer,
        labels: c.works.labels,
        statuses: c.works.statuses,
        cases: c.works.cases,
        interactiveNote: c.works.interactiveNote,
        flowNote: c.works.flowNote,
      })
    );
  }

  if (key === "process") {
    blocks.push(
      block("pageHeader", {
        kicker: c.process.kicker,
        title: c.process.title,
        intro: [c.process.intro],
      }),
      block("processFull", {
        labels: c.process.labels,
        phases: c.process.phases,
        changes: c.process.changes,
      })
    );
  }

  if (key === "faq") {
    blocks.push(
      block("pageHeader", {
        kicker: c.faq.kicker,
        title: c.faq.title,
        intro: [c.faq.intro],
      }),
      block("faqSection", {
        kicker: c.faq.kicker,
        title: c.faq.title,
        items: c.faq.items,
        ctaLabel: c.nav.contact,
        ctaHref: "/contact",
      })
    );
  }

  if (key === "contact") {
    blocks.push(
      block("pageHeader", {
        kicker: c.contact.kicker,
        title: c.contact.title,
        intro: [c.contact.description],
      }),
      block("requestForm", { showPrivacy: true, showNextSteps: true })
    );
  }

  return blocks;
}

const PAGES: { key: string; slug: string; order: number }[] = [
  { key: "home", slug: "", order: -1 },
  { key: "about", slug: "about", order: 0 },
  { key: "services", slug: "services", order: 1 },
  { key: "works", slug: "works", order: 2 },
  { key: "process", slug: "process", order: 3 },
  { key: "faq", slug: "faq", order: 4 },
  { key: "contact", slug: "contact", order: 5 },
];

async function seedPages() {
  for (const def of PAGES) {
    const blocksAr = JSON.stringify(pageBlocks(def.key, "ar"));
    const blocksEn = JSON.stringify(pageBlocks(def.key, "en"));
    const metaAr = ar.meta.pages[def.key as keyof typeof ar.meta.pages];
    const metaEn = en.meta.pages[def.key as keyof typeof en.meta.pages];
    const titleAr = def.key === "home" ? ar.meta.siteName : ar.nav[def.key as keyof typeof ar.nav];
    const titleEn = def.key === "home" ? en.meta.siteName : en.nav[def.key as keyof typeof en.nav];

    const existing = await db.page.findUnique({ where: { slug: def.slug } });

    if (existing && existing.editorTouchedAt) {
      console.log(`↷ تخطي «${def.key}» — عدّله المحرر من لوحة الإدارة (يحفظ عمله)`);
      continue;
    }

    const data = {
      sourceKey: def.key,
      seedVersion: SEED_VERSION,
      isHome: def.key === "home",
      order: def.order,
      titleAr,
      titleEn,
      seoTitleAr: metaAr.title,
      seoTitleEn: metaEn.title,
      seoDescAr: metaAr.description,
      seoDescEn: metaEn.description,
      draftBlocksAr: blocksAr,
      draftBlocksEn: blocksEn,
      publishedBlocksAr: blocksAr, // البذرة تُنشأ منشورة — هذا هو الموقع الحالي
      publishedBlocksEn: blocksEn,
      draftUpdatedAt: new Date(),
      publishedAt: new Date(),
      status: "published" as const,
    };

    if (existing) {
      await db.page.update({ where: { id: existing.id }, data });
      console.log(`↻ حُدّثت بذرة «${def.key}» (بلا مساس بتعديلات محرر — لم توجد)`);
    } else {
      await db.page.create({ data: { ...data, slug: def.slug } });
      console.log(`✓ أُنشئت صفحة «${def.key}»`);
    }
  }
}

async function seedMenus() {
  // عناصر الترويسة — تُنشأ مرة واحدة فقط؛ التعديل بعدها من لوحة الإدارة
  const headerCount = await db.menuItem.count({ where: { location: "header" } });
  if (headerCount === 0) {
    const routes: { key: string; slug: string }[] = [
      { key: "about", slug: "about" },
      { key: "services", slug: "services" },
      { key: "works", slug: "works" },
      { key: "process", slug: "process" },
      { key: "faq", slug: "faq" },
      { key: "contact", slug: "contact" },
    ];
    let order = 0;
    for (const r of routes) {
      await db.menuItem.create({
        data: {
          location: "header",
          labelAr: ar.nav[r.key as keyof typeof ar.nav],
          labelEn: en.nav[r.key as keyof typeof en.nav],
          pageSlug: r.slug,
          order: order++,
          enabled: true,
        },
      });
    }
    console.log("✓ قائمة الترويسة (6 روابط)");
  }

  const footerCount = await db.menuItem.count({ where: { location: "footer" } });
  if (footerCount === 0) {
    const routes: { key: string; slug: string }[] = [
      { key: "about", slug: "about" },
      { key: "services", slug: "services" },
      { key: "works", slug: "works" },
      { key: "process", slug: "process" },
      { key: "faq", slug: "faq" },
      { key: "contact", slug: "contact" },
    ];
    let order = 0;
    for (const r of routes) {
      await db.menuItem.create({
        data: {
          location: "footer",
          labelAr: ar.nav[r.key as keyof typeof ar.nav],
          labelEn: en.nav[r.key as keyof typeof en.nav],
          pageSlug: r.slug,
          order: order++,
          enabled: true,
        },
      });
    }
    console.log("✓ قائمة التذييل (6 روابط)");
  }
}

async function seedSettings() {
  const defaults: { key: string; value: string }[] = [
    { key: "contact.email", value: siteConfig.contact.email },
    { key: "contact.phone", value: siteConfig.contact.phone },
    { key: "contact.address", value: siteConfig.contact.address },
    { key: "social.github", value: siteConfig.github },
    { key: "site.nameAr", value: siteConfig.nameAr },
    { key: "site.nameEn", value: siteConfig.nameEn },
  ];
  for (const item of defaults) {
    await db.siteSetting.upsert({
      where: { key: item.key },
      create: { key: item.key, value: item.value },
      update: {}, // لا تكتب فوق تعديلات الإدارة
    });
  }
  console.log("✓ إعدادات الموقع");
}

async function main() {
  console.log("⟐ بذرة المحتوى — سُحُب التقنية");
  await seedPages();
  await seedMenus();
  await seedSettings();
  console.log("✓ اكتملت البذرة — الصفحات تُدار الآن من قاعدة البيانات");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
