import { describe, it, expect } from "vitest";
import { can, isStaff, SYSTEM_ROLES, PERMISSIONS } from "@/lib/auth/permissions";
import { canTransition, REQUEST_STATUSES } from "@/lib/requests-service";

/** الصلاحيات وانتقالات الحالات — منطق خالص قابل للاختبار */

describe("can — مصفوفة الصلاحيات", () => {
  it("مدير النظام يملك كل الصلاحيات", () => {
    const admin = { roleKey: "super_admin", permissions: [] as never[] };
    for (const key of Object.keys(PERMISSIONS)) {
      expect(can(admin, key as never)).toBe(true);
    }
  });

  it("العميل لا يملك صلاحيات إدارية", () => {
    const client = { roleKey: "client", permissions: [] as never[] };
    expect(can(client, "users.view")).toBe(false);
    expect(can(client, "requests.view.all")).toBe(false);
    expect(can(client, "pages.publish")).toBe(false);
  });

  it("موظف الدعم يرد ويغير الحالة ولا يعين ولا يوقف حسابات", () => {
    const support = { roleKey: "support", permissions: SYSTEM_ROLES.find((r) => r.key === "support")!.permissions };
    expect(can(support, "requests.reply")).toBe(true);
    expect(can(support, "requests.status")).toBe(true);
    expect(can(support, "requests.assign")).toBe(false);
    expect(can(support, "users.suspend")).toBe(false);
  });

  it("محرر المحتوى يحرر ولا ينشر (النشر صلاحية مستقلة)", () => {
    const editor = { roleKey: "content_editor", permissions: SYSTEM_ROLES.find((r) => r.key === "content_editor")!.permissions };
    expect(can(editor, "pages.edit")).toBe(true);
    expect(can(editor, "pages.publish")).toBe(false);
  });

  it("مدير العمليات يدير الطلبات والمستخدمين لا الأدوار", () => {
    const ops = { roleKey: "ops_manager", permissions: SYSTEM_ROLES.find((r) => r.key === "ops_manager")!.permissions };
    expect(can(ops, "requests.assign")).toBe(true);
    expect(can(ops, "users.suspend")).toBe(false);
    expect(can(ops, "users.roles")).toBe(false);
  });

  it("isStaff يميز الطاقم عن العميل", () => {
    expect(isStaff({ roleKey: "support" })).toBe(true);
    expect(isStaff({ roleKey: "client" })).toBe(false);
  });

  it("لا جلسة = لا صلاحية", () => {
    expect(can(null, "users.view")).toBe(false);
    expect(can(undefined, "admin.dashboard")).toBe(false);
  });

  it("كل صلاحيات الأدوار النظامية معرفة في السجل", () => {
    for (const role of SYSTEM_ROLES) {
      for (const permission of role.permissions) {
        expect(PERMISSIONS).toHaveProperty(permission);
      }
    }
  });
});

describe("canTransition — قواعد انتقال الحالة", () => {
  it("الطاقم يحول الجديد إلى المراجعة", () => {
    expect(canTransition("new", "in_review", "staff")).toBe(true);
  });

  it("العميل لا يستطيع بدء المعالجة", () => {
    expect(canTransition("new", "in_progress", "client")).toBe(false);
  });

  it("العميل يلغي قبل بدء المعالجة ولا يلغي بعدها", () => {
    expect(canTransition("new", "cancelled", "client")).toBe(true);
    expect(canTransition("in_review", "cancelled", "client")).toBe(true);
    expect(canTransition("awaiting_info", "cancelled", "client")).toBe(true);
    expect(canTransition("in_progress", "cancelled", "client")).toBe(false);
  });

  it("رد العميل على «بانتظار معلومات» يعيدها للمراجعة", () => {
    expect(canTransition("awaiting_info", "in_review", "client")).toBe(true);
  });

  it("المغلق لا يعود إلا بقرار الطاقم", () => {
    expect(canTransition("closed", "in_review", "client")).toBe(false);
    expect(canTransition("closed", "in_review", "staff")).toBe(true);
  });

  it("حالات وانتقالات غير معرفة مرفوضة", () => {
    expect(canTransition("hacked", "new", "staff")).toBe(false);
    expect(canTransition("new", "hacked", "staff")).toBe(false);
    for (const status of REQUEST_STATUSES) {
      expect(canTransition(status, status, "staff")).toBe(false);
    }
  });
});
