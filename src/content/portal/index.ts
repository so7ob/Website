import type { PortalContent } from "./types";
import { portalAr } from "./ar";
import { portalEn } from "./en";
import type { Locale } from "@/lib/i18n";

export function getPortalContent(locale: Locale): PortalContent {
  return locale === "en" ? portalEn : portalAr;
}

export type { PortalContent };
