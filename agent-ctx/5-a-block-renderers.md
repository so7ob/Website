# Task 5-a — Block Renderers (CMS Rendering Layer)

Agent: block-renderers
Scope: `src/components/blocks/**` only (31 files). types.ts untouched, nothing modified outside the folder.

## Deliverables

| File | Component | Original cloned | Client? |
|---|---|---|---|
| page-renderer.tsx | `PageRenderer` + BlockView/BlockContent dispatcher | — | server |
| hero-block.tsx | `HeroBlock` | home/hero.tsx (CloudHeroArt + motion) | client |
| services-grid-block.tsx | `ServicesGridBlock` | home/home-services.tsx | server |
| feature-grid-block.tsx | `FeatureGridBlock` | home/home-why.tsx (columns "2" → md:grid-cols-2, "3" → original stacked ol) | server |
| works-showcase-block.tsx | `WorksShowcaseBlock` | home/home-works.tsx (CaseVisual) | server |
| process-steps-block.tsx | `ProcessStepsBlock` | home/home-process.tsx | server |
| faq-section-block.tsx | `FaqSectionBlock` | home/home-faq.tsx (FaqAccordion stays client; `limit` slices items) | server |
| cta-section-block.tsx | `CtaSectionBlock` | home/final-cta.tsx (links variants primary/outline/navy on navy bg) | server |
| page-header-block.tsx | `PageHeaderBlock` | pages/about-page.tsx PageHero + services-page quickLinks pills | server |
| rich-text-block.tsx | `RichTextBlock` | Section + heading/lead/paragraphs + amber notice (works disclaimer style) | server |
| vision-mission-block.tsx | `VisionMissionBlock` | about-page vision/mission grid (Eye/Target) | server |
| numbered-values-block.tsx | `NumberedValuesBlock` | about-page values grid + dashed honesty li (Quote icon, closingNote optional) | server |
| numbered-list-block.tsx | `NumberedListBlock` | about-page principles ol | server |
| nav-cta-banner.tsx | `NavCtaBannerBlock` | about-page closing CTA banner (Compass; primary/outline/navy) | server |
| services-detail-block.tsx | `ServicesDetailBlock` | pages/services-page.tsx main Section (anchors id={service}, request → contact?service=X&type=quote) | server |
| works-full-block.tsx | `WorksFullBlock` | pages/works-page.tsx (CaseVisual + BookingPrototype + dl details, optional intro/disclaimer/notes) | server |
| process-full-block.tsx | `ProcessFullBlock` | pages/process-page.tsx (timeline + changes navy card incl. CTA row) | server |
| request-form-block.tsx | `RequestFormBlock` | pages/contact-page.tsx (grid + Suspense + optional nextSteps/privacy asides) | server |
| request-form-shell.tsx | `RequestFormShell` | NEW client wrapper: applies block `preselectService` via ?service= URL param + router.replace (ProjectRequestForm reads search params itself; form file NOT modified) | client |
| contact-info-block.tsx | `ContactInfoBlock` | NEW: Mail/Phone/MapPin card row; channels with href become BlockLinks | server |
| heading-block.tsx | `HeadingBlock` | generic: level 2/3/4 + optional kicker pill, align | server |
| text-block.tsx | `TextBlock` | generic: paragraphs, align, size base/lg | server |
| image-block.tsx | `ImageBlock` | generic: plain `<img>` (repo disables no-img-element), object-cover, rounded-2xl, width content/full, caption | server |
| gallery-block.tsx | `GalleryBlock` | generic: 2/3/4 col grid, aspect-[4/3] | server |
| button-link-block.tsx | `ButtonLinkBlock` | generic: primary/outline/navy button styles (hero identity) | server |
| columns-block.tsx | `ColumnsBlock` | generic: 1–4 responsive columns | server |
| simple-table-block.tsx | `SimpleTableBlock` | generic: shadcn Table in rounded-2xl card | server |
| divider-block.tsx | `DividerBlock` | generic: `<hr className="border-border">` | server |
| spacer-block.tsx | `SpacerBlock` | generic: h-8/h-16/h-28 | server |
| block-link.tsx | `BlockLink` + isExternalHref/isAbsoluteHref/localizeHref | shared link helper | server-safe |
| block-container.tsx | `BlockContainer` | shared container (max-w-7xl px-4/6/8 + pad) | server |

## Dispatcher contract (page-renderer.tsx)

```tsx
<PageRenderer blocks={Block[]} locale={Locale} />
```
- Visibility CSS-only: `!mobile → "max-md:hidden"`, `!tablet → "md:max-lg:hidden"`, `!desktop → "lg:hidden"` (Tailwind 4 max-* variants).
- `block.style` present AND not (background default + paddingY md) → wrap `<section id={anchorId} className={bg+py+visibility}>` where bg ∈ {"", bg-white, bg-accent/50, bg-navy, bg-brand-soft/30} and py ∈ {py-0, py-6, py-12, py-20}. Otherwise render bare (original Section padding preserved) with optional bare `<section id anchor + visibility>` wrapper.
- Props cast: `block.props as XBlockProps`.

## Typing pattern

```ts
import { type z } from "zod";
import type { blockSchemas } from "@/lib/blocks/types";
export type XBlockProps = z.input<typeof blockSchemas.x>["props"];
```
z.input (not output) so defaulted fields are optional — each renderer applies the same default as the zod schema (`?? value`). Type-only imports → zero runtime zod in renderers.

## i18n / strings rule

All user-visible strings come from props. Fallback UI labels resolve to `@/content/ar` / `@/content/en` (actions, works.disclaimer, form.services names, contact privacy/nextSteps, home.finalCta.title for processFull changes CTA). No hardcoded Arabic/English in components (only an aria-hidden arrow glyph `←/→` in servicesDetail, copied from the original).

## Link rules
- Internal site links: `localePath(locale, route)` or BlockLink which prefixes `/${locale}` for editor hrefs starting with "/" (unless already locale-prefixed).
- External http(s): `<a target="_blank" rel="noopener noreferrer">`; mailto:/tel: plain `<a>`; `#anchors` pass through.

## Verification
- `bunx tsc --noEmit` → 0 errors under src/components/blocks (repo has 1 pre-existing unrelated error in .next/dev/types/validator.ts).
- `bunx eslint src/components/blocks` → 0 problems.
- dev.log clean; dev server unaffected (blocks not yet imported by routes).

## Notes for next agents (5-b seed + [slug] route)
- Import `PageRenderer` from `@/components/blocks/page-renderer`; pass `page.blocks` (JSON-parsed array) + locale.
- Blocks stored through `validateBlocks` have zod defaults materialized (support, items, intro, quickLinks, channels, variant, align/level/size/rounded/width/columns, showPrivacy/showNextSteps).
- worksFull/processFull include optional `intro` (renders as lead paragraph at top of the section) — page kicker/title/intro should normally live in a separate `pageHeader` block.
- processFull `changes` card reproduces the original's closing CTA row (discuss/quote) from content translations; don't stack another ctaSection right after it unless desired.
- requestForm `preselectService` works via URL param injection (router.replace, no page scroll) — visible `?service=` in URL is intentional.
