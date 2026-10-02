/**
 * نظام الصلاحيات — المصدر الوحيد للحقيقة للتحقق الخادمي.
 * الواجهة تستخدم نفس المكتبة لتحسين التجربة فقط؛ القرار دائمًا في الخادم.
 */

export const PERMISSIONS = {
  // لوحة الإدارة
  "admin.dashboard": "عرض لوحة الإدارة ومؤشراتها",
  // المستخدمون
  "users.view": "عرض قائمة المستخدمين",
  "users.create": "إنشاء/دعوة مستخدمين",
  "users.update": "تعديل بيانات المستخدمين",
  "users.suspend": "إيقاف/إعادة تفعيل الحسابات",
  "users.roles": "تعديل أدوار المستخدمين وصلاحياتهم",
  // الطلبات
  "requests.view.all": "عرض جميع الطلبات",
  "requests.reply": "الرد على الطلبات",
  "requests.internal_notes": "إضافة ملاحظات داخلية",
  "requests.assign": "تعيين/إعادة تعيين المسؤول",
  "requests.status": "تغيير حالة الطلب",
  "requests.archive": "أرشفة الطلبات واستعادتها",
  "requests.export": "تصدير الطلبات",
  // الاستفسارات
  "inquiries.view.all": "عرض جميع الاستفسارات",
  "inquiries.reply": "الرد على الاستفسارات",
  "inquiries.assign": "تعيين مسؤول للاستفسار",
  "inquiries.status": "تغيير حالة الاستفسار",
  "inquiries.archive": "أرشفة الاستفسارات",
  "inquiries.export": "تصدير الاستفسارات",
  // المحتوى
  "pages.view": "عرض الصفحات في لوحة الإدارة",
  "pages.edit": "تحرير مسودات الصفحات",
  "pages.publish": "نشر الصفحات",
  "pages.restore": "استعادة إصدارات سابقة",
  "pages.delete": "حذف/أرشفة صفحات نهائيًا",
  "media.upload": "رفع الوسائط",
  "media.manage": "إدارة مكتبة الوسائط",
  "menus.manage": "إدارة القوائم",
  "settings.manage": "إدارة إعدادات الموقع",
  // الإشعارات والبريد والتدقيق
  "notifications.send": "إرسال إشعارات بريدية",
  "email.outbox": "عرض صندوق صادر البريد",
  "audit.view": "عرض سجل التدقيق",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export type PermissionList = Permission[];

/** الأدوار النظامية وأذونها الافتراضية — قابلة للتعديل من لوحة الإدارة */
export const SYSTEM_ROLES: {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  permissions: PermissionList;
}[] = [
  {
    key: "super_admin",
    nameAr: "مدير النظام",
    nameEn: "System Admin",
    descriptionAr: "إدارة المنصة والمستخدمين والأدوار والإعدادات",
    descriptionEn: "Full platform, users, roles and settings management",
    permissions: Object.keys(PERMISSIONS) as PermissionList,
  },
  {
    key: "ops_manager",
    nameAr: "مدير العمليات",
    nameEn: "Operations Manager",
    descriptionAr: "متابعة العملاء والطلبات والاستفسارات وتوزيع العمل",
    descriptionEn: "Oversee clients, requests, inquiries and work assignment",
    permissions: [
      "admin.dashboard",
      "users.view",
      "users.update",
      "requests.view.all",
      "requests.reply",
      "requests.internal_notes",
      "requests.assign",
      "requests.status",
      "requests.archive",
      "requests.export",
      "inquiries.view.all",
      "inquiries.reply",
      "inquiries.assign",
      "inquiries.status",
      "inquiries.archive",
      "inquiries.export",
      "notifications.send",
      "email.outbox",
      "audit.view",
    ],
  },
  {
    key: "support",
    nameAr: "موظف الدعم",
    nameEn: "Support Agent",
    descriptionAr: "معالجة الطلبات والاستفسارات والمحادثات المسندة إليه",
    descriptionEn: "Handle requests, inquiries and assigned conversations",
    permissions: [
      "admin.dashboard",
      "requests.view.all",
      "requests.reply",
      "requests.internal_notes",
      "requests.status",
      "inquiries.view.all",
      "inquiries.reply",
      "inquiries.status",
    ],
  },
  {
    key: "content_editor",
    nameAr: "محرر المحتوى",
    nameEn: "Content Editor",
    descriptionAr: "إدارة مسودات الصفحات والوسائط؛ النشر بصلاحية مستقلة",
    descriptionEn: "Manage page drafts and media; publishing is a separate permission",
    permissions: [
      "admin.dashboard",
      "pages.view",
      "pages.edit",
      "media.upload",
      "media.manage",
      "menus.manage",
    ],
  },
  {
    key: "client",
    nameAr: "العميل",
    nameEn: "Client",
    descriptionAr: "إدارة حسابه وطلباته ومحادثاته ومرفقاته فقط",
    descriptionEn: "Manage own account, requests, conversations and attachments",
    permissions: [],
  },
];

export const ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key);

/** أدوار لها حق دخول لوحة الإدارة */
export function isStaffRole(roleKey: string): boolean {
  return roleKey !== "client";
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  status: string;
  locale: string;
  emailVerified: boolean;
  permissions: PermissionList;
}

/** تحقق الصلاحية — يستدعى في الخادم دائمًا */
export function can(
  user: Pick<AuthUser, "permissions" | "roleKey"> | null | undefined,
  permission: Permission
): boolean {
  if (!user) return false;
  if (user.roleKey === "super_admin") return true;
  return user.permissions.includes(permission);
}

/** هل المستخدم من الطاقم (غير العميل)؟ */
export function isStaff(user: Pick<AuthUser, "roleKey"> | null | undefined): boolean {
  return !!user && isStaffRole(user.roleKey);
}
