/**
 * استعادة حسابات العرض المحلية (مدير + موظف + عميل) بعد إفراغ قاعدة البيانات
 * أو تغيّر كلمات مرورها — حسابات تنتهي بـ .local وهي مخصصة للتطوير فقط.
 *
 * Idempotent:
 *   الافتراضي — يُنشئ ما ينقص فقط، ولا يكتب فوق تعديلات لاحقة من لوحة الإدارة.
 *   مع --reset-passwords — يعيد ضبط كلمة المرور والحالة لكل الحسابات المعروفة
 *   (لحالة قاعدة معاد تزويدها بكلمة مرور مجهولة) ويزيل أي قفل محاولات دخول.
 *
 * الاستخدام:
 *   bun run scripts/restore-demo-users.ts
 *   bun run scripts/restore-demo-users.ts --reset-passwords
 *
 * ⚠️ حسابات تجريبية لبيئة التطوير المحلي فقط — لا تُستخدم في الإنتاج مطلقًا.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const RESET_PASSWORDS = process.argv.includes("--reset-passwords");

const DEMO_USERS: {
  email: string;
  name: string;
  password: string;
  roleKey: string;
}[] = [
  { email: "admin@so7ob.local", name: "مدير النظام", password: "AdminS7ob2026!", roleKey: "super_admin" },
  { email: "support@so7ob.local", name: "سلمى الدعم", password: "SupportS7ob2026!", roleKey: "support" },
  { email: "client@so7ob.local", name: "عميل العرض", password: "ClientS7ob2026!", roleKey: "client" },
];

async function main() {
  for (const u of DEMO_USERS) {
    const existing = await db.user.findUnique({
      where: { email: u.email },
      select: { id: true, status: true, failedLoginCount: true, lockedUntil: true },
    });

    const passwordHash = await bcrypt.hash(u.password, 12);

    if (!existing) {
      await db.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash,
          roleKey: u.roleKey,
          status: "active",
          locale: "ar",
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`✓ أُنشئ: ${u.email} (${u.roleKey})`);
      continue;
    }

    if (RESET_PASSWORDS) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: "active",
          emailVerifiedAt: existing.status === "active" ? undefined : new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      console.log(`↻ أُعيدت كلمة المرور: ${u.email} (${u.roleKey})`);
      continue;
    }

    console.log(`↷ موجود مسبقًا: ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
