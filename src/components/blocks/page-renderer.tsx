"use client";

/**
 * عارض شجرة المحتوى — يرسم مغلف v1 (أبناء الجذر) مع دعم الحاويات المتداخلة:
 * section (قسم بعرض الموقع) → container (صندوق عام) → row (شبكة أعمدة) →
 * column (كومة رأسية) → كتل ورقية.
 *
 * الأنماط المدركة للأجهزة تأتي من nodeStyleClasses (قاعدة + تجاوزات
 * mobile/tablet/desktop بأصناف md:/lg:) فتتطابق المعاينة مع العرض الفعلي.
 *
 * أوضاع العرض (RenderModeContext):
 * - live: الموقع العام، تفاعل حقيقي.
 * - edit: لوحة الرسم — الغلاف الشفاف يمنع التفاعل.
 * - test: اختبار تفاعل صريح — النماذج تُحاكى بلا طلبات حقيقية.
 *
 * الكتلة الورقية داخل حاوية تُرسم عاريًا عبر NestedBlockContext — الحاوية
 * تملك التباعد والخلفية فلا تتضاعف الحشوة.
 */
import { useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import type { ContentNode, ContainerType } from "@/lib/blocks/tree";
import { isContainerType } from "@/lib/blocks/tree";
import { nodeStyleClasses, nodeAlignClasses } from "@/lib/blocks/style";
import { NestedBlockContext, RenderModeContext, type RenderMode } from "./nested-context";
import { InlineEditNodeContext, InlineEditSessionContext } from "./inline-edit-context";

import { HeroBlock, type HeroBlockProps } from "./hero-block";
import { ServicesGridBlock, type ServicesGridBlockProps } from "./services-grid-block";
import { FeatureGridBlock, type FeatureGridBlockProps } from "./feature-grid-block";
import { WorksShowcaseBlock, type WorksShowcaseBlockProps } from "./works-showcase-block";
import { ProcessStepsBlock, type ProcessStepsBlockProps } from "./process-steps-block";
import { FaqSectionBlock, type FaqSectionBlockProps } from "./faq-section-block";
import { CtaSectionBlock, type CtaSectionBlockProps } from "./cta-section-block";
import { PageHeaderBlock, type PageHeaderBlockProps } from "./page-header-block";
import { RichTextBlock, type RichTextBlockProps } from "./rich-text-block";
import { VisionMissionBlock, type VisionMissionBlockProps } from "./vision-mission-block";
import { NumberedValuesBlock, type NumberedValuesBlockProps } from "./numbered-values-block";
import { NumberedListBlock, type NumberedListBlockProps } from "./numbered-list-block";
import { NavCtaBannerBlock, type NavCtaBannerBlockProps } from "./nav-cta-banner";
import { ServicesDetailBlock, type ServicesDetailBlockProps } from "./services-detail-block";
import { WorksFullBlock, type WorksFullBlockProps } from "./works-full-block";
import { ProcessFullBlock, type ProcessFullBlockProps } from "./process-full-block";
import { RequestFormBlock, type RequestFormBlockProps } from "./request-form-block";
import { ContactInfoBlock, type ContactInfoBlockProps } from "./contact-info-block";
import { HeadingBlock, type HeadingBlockProps } from "./heading-block";
import { TextBlock, type TextBlockProps } from "./text-block";
import { ImageBlock, type ImageBlockProps } from "./image-block";
import { GalleryBlock, type GalleryBlockProps } from "./gallery-block";
import { ButtonLinkBlock, type ButtonLinkBlockProps } from "./button-link-block";
import { ColumnsBlock, type ColumnsBlockProps } from "./columns-block";
import { SimpleTableBlock, type SimpleTableBlockProps } from "./simple-table-block";
import { DividerBlock, type DividerBlockProps } from "./divider-block";
import { SpacerBlock, type SpacerBlockProps } from "./spacer-block";

interface PageRendererProps {
  nodes: ContentNode[];
  locale: Locale;
  mode?: RenderMode;
}

export function PageRenderer({ nodes, locale, mode = "live" }: PageRendererProps) {
  return (
    <RenderModeContext.Provider value={mode}>
      {nodes.map((node) => (
        <NodeView key={node.id} node={node} locale={locale} nested={false} />
      ))}
    </RenderModeContext.Provider>
  );
}

// ─── أدوات مشتركة ───

function visibilityClasses(visibility: ContentNode["visibility"]): string {
  return [
    visibility?.mobile === false ? "max-md:hidden" : "",
    visibility?.tablet === false ? "md:max-lg:hidden" : "",
    visibility?.desktop === false ? "lg:hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const LEGACY_BACKGROUND: Record<string, string> = {
  default: "",
  white: "bg-white",
  accent: "bg-accent/50",
  navy: "bg-navy",
  soft: "bg-brand-soft/30",
};

const LEGACY_PADDING: Record<string, string> = {
  none: "py-0",
  sm: "py-6",
  md: "py-12",
  lg: "py-20",
};

// ─── عرض العقدة (حاوية أو ورقية) ───

function NodeView({ node, locale, nested }: { node: ContentNode; locale: Locale; nested: boolean }) {
  const visClass = visibilityClasses(node.visibility);
  const id = node.anchorId || undefined;

  if (isContainerType(node.type)) {
    return (
      <ContainerView node={node} id={id} visClass={visClass} locale={locale} />
    );
  }

  const content = <BlockContent node={node} locale={locale} />;

  if (nested) return content;

  // كتلة ورقية في الجذر — غلاف التوافق: خلفية/حشوة من النمط (بشكله الجديد أو القديم)
  const style = (node.style ?? {}) as {
    base?: { background?: string; paddingY?: string };
    background?: string;
    paddingY?: string;
  };
  const backgroundToken = style.base?.background ?? style.background ?? "default";
  const paddingToken = style.base?.paddingY ?? style.paddingY ?? "md";
  const background = LEGACY_BACKGROUND[backgroundToken] ?? "";
  const padding = LEGACY_PADDING[paddingToken] ?? "py-12";
  const hasStyle = Boolean(node.style) && (backgroundToken !== "default" || paddingToken !== "md");

  if (!hasStyle && !visClass && !id) return content;

  const sectionClass = [background, padding, visClass].filter(Boolean).join(" ");

  return (
    <section id={id} className={sectionClass || undefined}>
      {content}
    </section>
  );
}

// ─── عرض الحاويات ───

const ROW_GRID_DESKTOP: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const ROW_GRID_TABLET: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const COLUMN_SPAN: Record<string, string> = {
  "1": "lg:col-span-1",
  "2": "lg:col-span-2",
  "3": "lg:col-span-3",
  "4": "lg:col-span-4",
};

const GAP_CLASS: Record<string, string> = {
  xs: "gap-2",
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-10",
};

function asStringProp(props: unknown, key: string, fallback: string): string {
  if (typeof props !== "object" || props === null) return fallback;
  const v = (props as Record<string, unknown>)[key];
  return typeof v === "string" ? v : fallback;
}

function ContainerView({ node, id, visClass, locale }: { node: ContentNode; id?: string; visClass: string; locale: Locale }) {
  const type = node.type as ContainerType;
  const styleClasses = nodeStyleClasses(node.style);
  const children = (node.children ?? []).map((child) => (
    <NodeView key={child.id} node={child} locale={locale} nested={true} />
  ));

  if (type === "section") {
    return (
      <section id={id} className={`${styleClasses} ${visClass}`.trim() || undefined}>
        {/* عرض موقع داخلي مطابق لأغلفة الكتل — الحاوية تملك الخلفية والتباعد */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
      </section>
    );
  }

  if (type === "row") {
    const count = (node.children ?? []).length;
    const declared = typeof (node.props as Record<string, unknown> | undefined)?.columns === "number"
      ? ((node.props as Record<string, unknown>).columns as number)
      : null;
    const desktopCount = Math.min(6, Math.max(1, declared ?? count));
    const tabletCount = Math.min(4, Math.max(1, Math.ceil(desktopCount / 2)));
    const gap = GAP_CLASS[asStringProp(node.props, "gap", "md")] ?? "gap-6";
    return (
      <div
        id={id}
        className={`grid grid-cols-1 ${ROW_GRID_TABLET[tabletCount]} ${ROW_GRID_DESKTOP[desktopCount]} ${gap} ${styleClasses} ${visClass}`.trim()}
      >
        {children}
      </div>
    );
  }

  if (type === "column") {
    const gap = GAP_CLASS[asStringProp(node.props, "gap", "md")] ?? "gap-6";
    const span = COLUMN_SPAN[asStringProp(node.props, "span", "auto")] ?? "";
    const align = nodeAlignClasses(node.style);
    return (
      <div
        id={id}
        className={`flex flex-col ${gap} ${align} ${span} ${styleClasses} ${visClass}`.trim()}
      >
        {children}
      </div>
    );
  }

  // container — صندوق عام بلا عرض أقصى ذاتي
  return (
    <div id={id} className={`${styleClasses} ${visClass}`.trim() || undefined}>
      {children}
    </div>
  );
}

// ─── عرض الكتل الورقية ───

function BlockContent({ node, locale }: { node: ContentNode; locale: Locale }) {
  const props = (node.props ?? {}) as Record<string, unknown>;
  // نطاق التحرير المباشر — قيمة غير null فقط حين تكون هذه العقدة في جلسة تحرير
  const session = useContext(InlineEditSessionContext);
  const nodeEdit = useMemo(
    () =>
      session && session.nodeId === node.id
        ? { onChange: session.onChange, onEnd: session.onEnd }
        : null,
    [session, node.id]
  );
  const body = renderLeaf(node.type, props, locale);
  return <InlineEditNodeContext.Provider value={nodeEdit}>{body}</InlineEditNodeContext.Provider>;
}

function renderLeaf(type: string, props: Record<string, unknown>, locale: Locale): ReactNode {
  switch (type) {
    case "hero":
      return <HeroBlock props={props as HeroBlockProps} locale={locale} />;
    case "servicesGrid":
      return <ServicesGridBlock props={props as ServicesGridBlockProps} locale={locale} />;
    case "featureGrid":
      return <FeatureGridBlock props={props as FeatureGridBlockProps} locale={locale} />;
    case "worksShowcase":
      return <WorksShowcaseBlock props={props as WorksShowcaseBlockProps} locale={locale} />;
    case "processSteps":
      return <ProcessStepsBlock props={props as ProcessStepsBlockProps} locale={locale} />;
    case "faqSection":
      return <FaqSectionBlock props={props as FaqSectionBlockProps} locale={locale} />;
    case "ctaSection":
      return <CtaSectionBlock props={props as CtaSectionBlockProps} locale={locale} />;
    case "pageHeader":
      return <PageHeaderBlock props={props as PageHeaderBlockProps} locale={locale} />;
    case "richText":
      return <RichTextBlock props={props as RichTextBlockProps} locale={locale} />;
    case "visionMission":
      return <VisionMissionBlock props={props as VisionMissionBlockProps} locale={locale} />;
    case "numberedValues":
      return <NumberedValuesBlock props={props as NumberedValuesBlockProps} locale={locale} />;
    case "numberedList":
      return <NumberedListBlock props={props as NumberedListBlockProps} locale={locale} />;
    case "navCtaBanner":
      return <NavCtaBannerBlock props={props as NavCtaBannerBlockProps} locale={locale} />;
    case "servicesDetail":
      return <ServicesDetailBlock props={props as ServicesDetailBlockProps} locale={locale} />;
    case "worksFull":
      return <WorksFullBlock props={props as WorksFullBlockProps} locale={locale} />;
    case "processFull":
      return <ProcessFullBlock props={props as ProcessFullBlockProps} locale={locale} />;
    case "requestForm":
      return <RequestFormBlock props={props as RequestFormBlockProps} locale={locale} />;
    case "contactInfo":
      return <ContactInfoBlock props={props as ContactInfoBlockProps} locale={locale} />;
    case "heading":
      return <HeadingBlock props={props as HeadingBlockProps} locale={locale} />;
    case "text":
      return <TextBlock props={props as TextBlockProps} locale={locale} />;
    case "image":
      return <ImageBlock props={props as ImageBlockProps} locale={locale} />;
    case "gallery":
      return <GalleryBlock props={props as GalleryBlockProps} locale={locale} />;
    case "buttonLink":
      return <ButtonLinkBlock props={props as ButtonLinkBlockProps} locale={locale} />;
    case "columns":
      return <ColumnsBlock props={props as ColumnsBlockProps} locale={locale} />;
    case "simpleTable":
      return <SimpleTableBlock props={props as SimpleTableBlockProps} locale={locale} />;
    case "divider":
      return <DividerBlock props={props as DividerBlockProps} locale={locale} />;
    case "spacer":
      return <SpacerBlock props={props as SpacerBlockProps} locale={locale} />;
    default:
      return null;
  }
}
