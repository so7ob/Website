/**
 * أنواع استجابات واجهات صفحات الإدارة — خاصة بمحرر الصفحات وقائمتها.
 * كل التواريخ نصوص ISO من JSON كما تصل من الخادم.
 */

import type { Block } from "@/lib/blocks/types";

// ——— قائمة الصفحات ———

export interface PageRow {
  id: string;
  slug: string;
  isHome: boolean;
  order: number;
  status: string; // draft | in_review | published | archived
  visibility: string; // public | authenticated | role
  titleAr: string;
  titleEn: string;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
  versionCount: number;
  sourceKey: string | null;
  editorTouchedAt: string | null;
}

export interface PagesResponse {
  ok: boolean;
  pages: PageRow[];
}

export interface CreatePageResponse {
  ok: boolean;
  page: { id: string; slug: string };
}

// ——— تفاصيل الصفحة (المحرر) ———

export interface VersionBrief {
  id: string;
  locale: string;
  version: number;
  note: string | null;
  createdAt: string;
  author: { name: string } | null;
}

export interface PageDetail {
  id: string;
  slug: string;
  isHome: boolean;
  order: number;
  status: string;
  visibility: string;
  allowedRoles: string[];
  titleAr: string;
  titleEn: string;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescAr: string | null;
  seoDescEn: string | null;
  draftBlocksAr: string;
  draftBlocksEn: string;
  publishedBlocksAr: string | null;
  publishedBlocksEn: string | null;
  draftUpdatedAt: string | null;
  draftUpdatedById: string | null;
  publishedAt: string | null;
  sourceKey: string | null;
  editorTouchedAt: string | null;
  versions: VersionBrief[];
}

export interface PageDetailResponse {
  ok: boolean;
  page: PageDetail;
}

export interface PatchPageResponse {
  ok: boolean;
  page: { id: string; slug: string; draftUpdatedAt: string | null; status: string };
}

export interface ConflictBody {
  ok: false;
  code: "conflict";
  serverDraftUpdatedAt: string;
}

export interface PublishResponse {
  ok: boolean;
  publishedAt: string;
}

// ——— الإصدارات ———

export interface VersionRow {
  id: string;
  locale: string;
  version: number;
  note: string | null;
  author: string;
  createdAt: string;
  blockCount: number;
}

export interface VersionsResponse {
  ok: boolean;
  versions: VersionRow[];
}

export interface RestoreResponse {
  ok: boolean;
  restoredVersion: number;
}

// ——— الوسائط (أشكال مشتركة مع مكتبة الوسائط) ———

export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  altText: string | null;
  title: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface MediaListResponse {
  ok: boolean;
  media: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MediaUploadResponse {
  ok: boolean;
  media: { id: string; url: string; filename: string };
}

// ——— مساعدات مشتركة للمحرر ———

/** تسمية ثنائية اللغة لحقول نموذج الخصائص (أداة تحرير — مسموح محليًا) */
export interface Bi {
  ar: string;
  en: string;
}

export function bi(label: Bi, locale: "ar" | "en"): string {
  return locale === "en" ? label.en : label.ar;
}

/** إحداثيات كتلة داخل مسودة لغة محددة */
export type DraftLocale = "ar" | "en";

/** حالة المسودة لكلا اللغتين — أساس التاريخ والتراجع */
export interface DraftState {
  ar: Block[];
  en: Block[];
}

/** توليد معرف كتلة فريد: b-{type}-{random6} بأحرف a-z0-9 */
export function newBlockId(type: string, existing: string[]): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 50; attempt++) {
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const id = `b-${type}-${suffix}`;
    if (!existing.includes(id)) return id;
  }
  return `b-${type}-${Date.now().toString(36)}`;
}
