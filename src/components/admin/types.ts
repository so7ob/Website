/**
 * أنواع استجابات واجهات لوحة الإدارة — مشتركة بين الخادم والعميل.
 * كل التواريخ تصل كنصوص ISO من JSON.
 */
import type { Permission } from "@/lib/auth/permissions";

/** هوية المستخدم الحالي كما تمررها صفحات الخادم لمكونات العميل */
export interface Me {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  locale: string;
  permissions: Permission[];
}

// ——— المستخدمون ———
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  roleKey: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  requestsCount: number;
  assignedCount: number;
}
export interface UsersResponse {
  ok: boolean;
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

// ——— ملف المستخدم الموسّع ———
export interface UserDetailInfo {
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
  updatedAt: string;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  lastSeen: string | null;
}
export interface UserDetailRequestRow {
  id: string;
  refCode: string;
  status: string;
  serviceType: string;
  createdAt: string;
  lastActivityAt: string;
  assigneeName: string | null;
}
export interface UserSessionRow {
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  ipHash: string | null;
}
export interface UserAuditRow {
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}
export interface UserDetailResponse {
  ok: boolean;
  user: UserDetailInfo;
  stats: { totalRequests: number; openRequests: number };
  requests: UserDetailRequestRow[];
  sessions: { activeCount: number; last5: UserSessionRow[] };
  auditLog: UserAuditRow[];
}

// ——— الردود المحفوظة ———
export interface SavedReplyRow {
  id: string;
  name: string;
  content: string;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SavedRepliesResponse {
  ok: boolean;
  replies: SavedReplyRow[];
}

// ——— الطلبات ———
export interface StaffOption {
  id: string;
  name: string;
}
export interface RequestRow {
  id: string;
  refCode: string;
  requestType: string;
  serviceType: string;
  status: string;
  priority: string;
  name: string;
  email: string;
  clientId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  lastClientReplyAt: string | null;
  lastStaffReplyAt: string | null;
  archivedAt: string | null;
  needsStaffReply: boolean;
  /** وقت آخر رسالة عميل ظاهرة والطلب ينتظر رد الفريق (null إن لم يكن بانتظار) */
  awaitingSince: string | null;
}
export interface RequestsResponse {
  ok: boolean;
  requests: RequestRow[];
  staff: StaffOption[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConversationAuthor {
  id: string;
  name: string;
  roleKey: string;
}
export interface MessageRow {
  id: string;
  authorId: string | null;
  authorType: string;
  kind: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
  author?: ConversationAuthor | null;
}
export interface StatusEventRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string | null;
  note: string | null;
  createdAt: string;
  changedBy?: { name: string } | null;
}
export interface AttachmentRow {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: string;
  createdAt: string;
}
export interface RequestClientInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
}
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
  clientId: string | null;
  assigneeId: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  messages: MessageRow[];
  statusHistory: StatusEventRow[];
  attachments: AttachmentRow[];
  client: RequestClientInfo | null;
  assignee: StaffOption | null;
}
export interface RequestDetailResponse {
  ok: boolean;
  request: RequestDetail;
}

// ——— إشعارات الفريق ———
export interface AdminNotification {
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
  notifications: AdminNotification[];
}

// ——— الاستفسارات ———
export interface InquiryRow {
  id: string;
  refCode: string;
  subject: string;
  category: string;
  status: string;
  name: string;
  email: string;
  clientId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  /** وقت آخر رسالة عميل ظاهرة والاستفسار ينتظر رد الفريق (null إن لم يكن بانتظار) */
  awaitingSince: string | null;
}
export interface InquiriesResponse {
  ok: boolean;
  inquiries: InquiryRow[];
  total: number;
  page: number;
  pageSize: number;
}
export interface InquiryDetail {
  id: string;
  refCode: string;
  subject: string;
  name: string;
  email: string;
  category: string;
  status: string;
  priority: string;
  locale: string;
  clientId: string | null;
  assigneeId: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  messages: MessageRow[];
  client: { id: string; name: string; email: string } | null;
  assignee: StaffOption | null;
}
export interface InquiryDetailResponse {
  ok: boolean;
  inquiry: InquiryDetail;
}

// ——— التدقيق والبريد ———
export interface AuditRow {
  id: string;
  actor: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}
export interface AuditResponse {
  ok: boolean;
  logs: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}
export interface OutboxEmail {
  id: string;
  to: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
}
export interface OutboxResponse {
  ok: boolean;
  emails: OutboxEmail[];
  total: number;
  page: number;
  pageSize: number;
}

// ——— القوائم والإعدادات والوسائط ———
export interface MenuItemRow {
  id: string;
  location: string;
  labelAr: string;
  labelEn: string;
  url: string | null;
  pageSlug: string | null;
  enabled: boolean;
  order: number;
}
export interface PageOption {
  slug: string;
  titleAr: string;
  titleEn: string;
}
export interface MenusResponse {
  ok: boolean;
  header: MenuItemRow[];
  footer: MenuItemRow[];
  pages: PageOption[];
}
export interface MediaRow {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  altText: string | null;
  title: string | null;
  folder: string;
  uploadedBy: string;
  createdAt: string;
  usageCount: number;
}
export interface MediaResponse {
  ok: boolean;
  media: MediaRow[];
  total: number;
  /** إجمالي الوسائط غير المستخدمة عبر كل المجلدات — يغذي شارة التصفية */
  unusedTotal: number;
  page: number;
  pageSize: number;
  folders: string[];
}
/** موضع استخدام وسيلة — يرد من حاجز الحذف (409) */
export interface MediaUsageLocationView {
  kind: "page_published" | "page_draft" | "page_og" | "template";
  entityId: string;
  titleAr: string;
  titleEn: string;
  locale: "ar" | "en" | null;
  state: "draft" | "published" | null;
  archived?: boolean;
}
export interface SettingsResponse {
  ok: boolean;
  settings: Record<string, string>;
}
