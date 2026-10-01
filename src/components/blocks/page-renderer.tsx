"use client";

import type { Block } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n";

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

/** خلفيات الأقسام حسب block.style.background */
const BACKGROUND_CLASSES: Record<string, string> = {
  default: "",
  white: "bg-white",
  accent: "bg-accent/50",
  navy: "bg-navy",
  soft: "bg-brand-soft/30",
};

/** الحشوة الرأسية حسب block.style.paddingY */
const PADDING_CLASSES: Record<string, string> = {
  none: "py-0",
  sm: "py-6",
  md: "py-12",
  lg: "py-20",
};

/**
 * يرسم شجرة بلوكات الصفحة. الإخفاء على الأجهزة يتم عبر أصناف CSS فقط
 * (وليس شرطًا شرطيًا) حتى تبقى البنية متطابقة بين اللغتين والأجهزة.
 */
export function PageRenderer({ blocks, locale }: { blocks: Block[]; locale: Locale }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} locale={locale} />
      ))}
    </>
  );
}

function BlockView({ block, locale }: { block: Block; locale: Locale }) {
  const visibility = block.visibility;
  const visibilityClasses = [
    visibility?.mobile === false ? "max-md:hidden" : "",
    visibility?.tablet === false ? "md:max-lg:hidden" : "",
    visibility?.desktop === false ? "lg:hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // style غائب أو بقيم افتراضية → بدون غلاف إضافي (المكونات تحمل حشوتها الأصلية)
  const style = block.style;
  const isDefaultStyle =
    !style || ((style.background ?? "default") === "default" && (style.paddingY ?? "md") === "md");

  const content = <BlockContent block={block} locale={locale} />;

  if (isDefaultStyle && !visibilityClasses && !block.anchorId) {
    return content;
  }

  if (isDefaultStyle) {
    return (
      <section id={block.anchorId} className={visibilityClasses || undefined}>
        {content}
      </section>
    );
  }

  const background = BACKGROUND_CLASSES[style?.background ?? "default"] ?? "";
  const padding = PADDING_CLASSES[style?.paddingY ?? "md"] ?? "py-12";
  const sectionClass = [background, padding, visibilityClasses].filter(Boolean).join(" ");

  return (
    <section id={block.anchorId} className={sectionClass}>
      {content}
    </section>
  );
}

function BlockContent({ block, locale }: { block: Block; locale: Locale }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock props={block.props as HeroBlockProps} locale={locale} />;
    case "servicesGrid":
      return <ServicesGridBlock props={block.props as ServicesGridBlockProps} locale={locale} />;
    case "featureGrid":
      return <FeatureGridBlock props={block.props as FeatureGridBlockProps} locale={locale} />;
    case "worksShowcase":
      return <WorksShowcaseBlock props={block.props as WorksShowcaseBlockProps} locale={locale} />;
    case "processSteps":
      return <ProcessStepsBlock props={block.props as ProcessStepsBlockProps} locale={locale} />;
    case "faqSection":
      return <FaqSectionBlock props={block.props as FaqSectionBlockProps} locale={locale} />;
    case "ctaSection":
      return <CtaSectionBlock props={block.props as CtaSectionBlockProps} locale={locale} />;
    case "pageHeader":
      return <PageHeaderBlock props={block.props as PageHeaderBlockProps} locale={locale} />;
    case "richText":
      return <RichTextBlock props={block.props as RichTextBlockProps} locale={locale} />;
    case "visionMission":
      return <VisionMissionBlock props={block.props as VisionMissionBlockProps} locale={locale} />;
    case "numberedValues":
      return <NumberedValuesBlock props={block.props as NumberedValuesBlockProps} locale={locale} />;
    case "numberedList":
      return <NumberedListBlock props={block.props as NumberedListBlockProps} locale={locale} />;
    case "navCtaBanner":
      return <NavCtaBannerBlock props={block.props as NavCtaBannerBlockProps} locale={locale} />;
    case "servicesDetail":
      return <ServicesDetailBlock props={block.props as ServicesDetailBlockProps} locale={locale} />;
    case "worksFull":
      return <WorksFullBlock props={block.props as WorksFullBlockProps} locale={locale} />;
    case "processFull":
      return <ProcessFullBlock props={block.props as ProcessFullBlockProps} locale={locale} />;
    case "requestForm":
      return <RequestFormBlock props={block.props as RequestFormBlockProps} locale={locale} />;
    case "contactInfo":
      return <ContactInfoBlock props={block.props as ContactInfoBlockProps} locale={locale} />;
    case "heading":
      return <HeadingBlock props={block.props as HeadingBlockProps} locale={locale} />;
    case "text":
      return <TextBlock props={block.props as TextBlockProps} locale={locale} />;
    case "image":
      return <ImageBlock props={block.props as ImageBlockProps} locale={locale} />;
    case "gallery":
      return <GalleryBlock props={block.props as GalleryBlockProps} locale={locale} />;
    case "buttonLink":
      return <ButtonLinkBlock props={block.props as ButtonLinkBlockProps} locale={locale} />;
    case "columns":
      return <ColumnsBlock props={block.props as ColumnsBlockProps} locale={locale} />;
    case "simpleTable":
      return <SimpleTableBlock props={block.props as SimpleTableBlockProps} locale={locale} />;
    case "divider":
      return <DividerBlock props={block.props as DividerBlockProps} locale={locale} />;
    case "spacer":
      return <SpacerBlock props={block.props as SpacerBlockProps} locale={locale} />;
    default:
      return null;
  }
}
