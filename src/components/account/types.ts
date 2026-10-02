/**
 * أنواع استجابات بوابة العميل — التواريخ نصوص ISO (JSON).
 */

/** صف طلب في القائمة — GET /api/account/requests */
export interface AccountRequestRow {
  id: string;
  refCode: string;
  serviceType: string;
  requestType: string;
  status: string;
  priority: string;
  createdAt: string;
  lastActivityAt: string;
  lastClientReplyAt: string | null;
  lastStaffReplyAt: string | null;
  archivedAt: string | null;
  assignee: { name: string } | null;
  messageCount: number;
  awaitingClientReply: boolean;
}

export interface RequestListResponse {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  requests: AccountRequestRow[];
}

/** رسالة محادثة (client-visible فقط) */
export interface RequestMessage {
  id: string;
  requestId: string;
  authorId: string | null;
  authorType: "client" | "staff" | "system";
  kind: "message" | "system";
  body: string;
  editedAt: string | null;
  createdAt: string;
}

export interface RequestAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export interface RequestStatusEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  changedBy: { name: string } | null;
}

/** تفاصيل الطلب الكاملة — GET /api/account/requests/[id] */
export interface RequestDetail {
  id: string;
  refCode: string;
  requestType: string;
  serviceType: string;
  description: string;
  budget: string;
  currency: string | null;
  timeline: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  preferredContact: string;
  referenceUrl: string | null;
  locale: string;
  status: string;
  priority: string;
  resolutionNote: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  clientId: string | null;
  assignee: { id: string; name: string } | null;
  messages: RequestMessage[];
  attachments: RequestAttachment[];
  statusHistory: RequestStatusEvent[];
  claim: { status: string } | null;
}

export interface RequestDetailResponse {
  ok: boolean;
  code?: string;
  request?: RequestDetail;
}

/** إشعار */
export interface AccountNotification {
  id: string;
  type: string;
  payload: Record<string, string>;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  ok: boolean;
  total: number;
  unread: number;
  page: number;
  pageSize: number;
  notifications: AccountNotification[];
}

/** جلسة نشطة — GET /api/auth/sessions */
export interface AuthSessionRow {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

/** الملف الشخصي — GET /api/account/profile */
export interface AccountProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  company: string | null;
  locale: string;
  roleKey: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ——— الاستفسارات ———

/** صف استفسار في القائمة — GET /api/account/inquiries */
export interface InquiryRow {
  id: string;
  refCode: string;
  subject: string;
  category: string;
  status: string;
  locale: string;
  createdAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  assigneeName: string | null;
  messageCount: number;
}

export interface InquiryListResponse {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  inquiries: InquiryRow[];
}

/** رسالة محادثة الاستفسار — الملاحظات الداخلية مستبعدة خادميًا */
export interface InquiryMessage {
  id: string;
  authorType: "client" | "staff" | "system";
  kind: "message" | "system";
  body: string;
  createdAt: string;
  author: { name: string; roleKey: string } | null;
}

/** مرفق استفسار — filename هو حقل النموذج؛ name/url احتياطيان لتوافق الاستجابة */
export interface InquiryAttachment {
  id: string;
  filename: string;
  size?: number;
  mimeType?: string;
  createdAt?: string;
  name?: string;
  url?: string | null;
}

/** تفاصيل الاستفسار الكاملة — GET /api/account/inquiries/[id] */
export interface InquiryDetail {
  id: string;
  refCode: string;
  subject: string;
  category: string;
  status: string;
  locale: string;
  createdAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  archivedAt: string | null;
  name: string;
  email: string;
  assignee: { id: string; name: string } | null;
  attachments: InquiryAttachment[];
  messages: InquiryMessage[];
}

export interface InquiryDetailResponse {
  ok: boolean;
  code?: string;
  inquiry?: InquiryDetail;
}

/** إنشاء استفسار — POST /api/account/inquiries (201 {ok,ref,id} — 429 rate_limited) */
export interface CreateInquiryResponse {
  ok: boolean;
  ref?: string;
  id?: string;
  code?: string;
  retryAfterSec?: number;
}

/** رد على استفسار — POST /api/account/inquiries/[id]/messages (400 code "closed"|"empty") */
export interface InquiryReplyResponse {
  ok: boolean;
  code?: string;
  message?: InquiryMessage;
}

/** مسودة طلب الخادم — GET /api/account/drafts */
export interface RequestDraftPayload {
  ok?: boolean;
  updatedAt?: string;
  draft: Partial<{
    requestType: string;
    serviceType: string;
    description: string;
    budget: string;
    currency: string;
    timeline: string;
    name: string;
    company: string;
    phone: string;
    preferredContact: string;
    referenceUrl: string;
    locale: string;
  }> | null;
}
