/**
 * أنواع استجابات واجهات صفحات الإدارة — خاصة بمحرر الصفحات وقائمتها.
 * كل التواريخ نصوص ISO من JSON كما تصل من الخادم.
 */

import type { ContentNode } from "@/lib/blocks/tree";

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
  scheduledPublishAt: string | null;
  draftRevision: number;
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

export interface PageSettingsView {
  slug: string;
  visibility: string;
  allowedRoles: string[];
  titleAr: string;
  titleEn: string;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescAr: string | null;
  seoDescEn: string | null;
  order: number;
}

export interface PageDetail {
  id: string;
  slug: string;
  isHome: boolean;
  status: string;
  visibility: string;
  allowedRoles: string[];
  titleAr: string;
  titleEn: string;
  draftSlug: string;
  draftTitleAr: string;
  draftTitleEn: string;
  draftSettings: PageSettingsView;
  publishedSettings: PageSettingsView | null;
  order: number;
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
  draftUpdatedByName: string | null;
  draftRevision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  scheduledRevision: number | null;
  hasUnpublishedChanges: boolean;
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
  page: {
    id: string;
    slug: string;
    status: string;
    draftUpdatedAt: string | null;
    draftRevision: number;
    isHome?: boolean;
    draftSettings?: PageSettingsView;
  };
}

export interface ConflictBody {
  ok: false;
  code: "conflict" | "revision_required";
  serverRevision?: number;
  serverDraftUpdatedAt?: string;
}

export interface PublishResponse {
  ok: boolean;
  publishedAt: string;
  page: {
    slug: string;
    status: string;
    draftRevision: number;
    publishedRevision: number | null;
    hasUnpublishedChanges: boolean;
  };
}

/** إرسال للمراجعة — نفس شكل استجابة الحفظ (الحالة تصير in_review) */
export interface SubmitReviewResponse {
  ok: boolean;
  page: {
    id: string;
    slug: string;
    status: string;
    draftRevision: number;
  };
}

/** قرار المراجعة — موافقة (نشر عبر نواة publishPageCore) أو رفض (عودة لمسودة) */
export interface ReviewDecisionResponse {
  ok: boolean;
  decision: "approved" | "rejected";
  publishedAt?: string;
  page: {
    slug: string;
    status: string;
    draftRevision: number;
    publishedRevision?: number | null;
    hasUnpublishedChanges?: boolean;
  };
}

/** استبعاد التعديلات غير المنشورة — المسودة تعود حرفيًا لآخر نسخة منشورة */
export interface DiscardResponse {
  ok: boolean;
  page: {
    slug: string;
    draftRevision: number;
    publishedRevision: number | null;
    hasUnpublishedChanges: boolean;
    draftUpdatedAt: string;
  };
}

/** جدولة/إلغاء نشر — الموعد يرتبط بمراجعة المسودة الحالية */
export interface ScheduleResponse {
  ok: boolean;
  scheduledPublishAt: string | null;
  scheduledRevision?: number;
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
  locales: string[];
  draftRevision: number;
  draftUpdatedAt: string;
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

/** حالة المسودة لكلا اللغتين — شجرة المحتوى v1 (أبناء الجذر)، أساس التاريخ والتراجع */
export interface DraftState {
  ar: ContentNode[];
  en: ContentNode[];
}

/** تغليف v1 جاهز للإرسال/الحفظ من شجرة المسودة — نفس شكل validateContent().json */
export function envelopeJson(nodes: ContentNode[]): string {
  return JSON.stringify({ schemaVersion: 1, blocks: nodes });
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
