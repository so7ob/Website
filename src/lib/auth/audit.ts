/**
 * سجل التدقيق — من فعل ماذا ومتى وعلى أي سجل.
 * كل عملية حساسة في المنصة تمر من هنا.
 */
import { db } from "@/lib/db";
import { sha256 } from "./tokens";

export interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** يسجل حدثًا — لا يرفع الأخطاء أبدًا حتى لا يعطل العملية الأساسية */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: input.details ? JSON.stringify(input.details).slice(0, 2000) : null,
        ipHash: input.ip ? sha256(`ip:${input.ip}`) : null,
      },
    });
  } catch (error) {
    console.error("[audit] فشل تسجيل الحدث:", error);
  }
}

/** رموز الأفعاء المعتمدة — تُستخدم كمرجع موحد */
export const AUDIT_ACTIONS = {
  // الحسابات
  userRegister: "user.register",
  userLogin: "user.login",
  userLoginFailed: "user.login_failed",
  userLogout: "user.logout",
  userEmailVerified: "user.email_verified",
  userPasswordReset: "user.password_reset",
  userPasswordChanged: "user.password_changed",
  userProfileUpdated: "user.profile_updated",
  userSuspended: "user.suspended",
  userReactivated: "user.reactivated",
  userRoleChanged: "user.role_changed",
  userUpdated: "user.updated",
  userInvited: "user.invited",
  sessionRevoked: "session.revoked",
  sessionsRevokedAll: "sessions.revoked_all",
  // الطلبات
  requestSubmitted: "request.submitted",
  requestDraftSaved: "request.draft_saved",
  requestAssigned: "request.assigned",
  requestStatusChanged: "request.status_changed",
  requestReplied: "request.replied",
  requestInternalNote: "request.internal_note",
  requestArchived: "request.archived",
  requestRestored: "request.restored",
  requestClaimed: "request.claimed",
  requestsExported: "requests.exported",
  // الردود المحفوظة
  savedReplyCreated: "saved_reply.created",
  savedReplyUpdated: "saved_reply.updated",
  savedReplyDeleted: "saved_reply.deleted",
  // الاستفسارات
  inquirySubmitted: "inquiry.submitted",
  inquiryReplied: "inquiry.replied",
  inquiriesExported: "inquiries.exported",
  inquiryArchived: "inquiry.archived",
  inquiryRestored: "inquiry.restored",
  // المحتوى
  pageCreated: "page.created",
  pageDraftSaved: "page.draft_saved",
  pagePublished: "page.published",
  pageRestored: "page.version_restored",
  pageArchived: "page.archived",
  pageDuplicated: "page.duplicated",
  menuUpdated: "menu.updated",
  settingsUpdated: "settings.updated",
  mediaUploaded: "media.uploaded",
  mediaDeleted: "media.deleted",
} as const;
