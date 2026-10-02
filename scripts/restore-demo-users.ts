/**
 * استعادة حسابات العرض المحلية (موظف + عميل) بعد إفراغ قاعدة البيانات.
 * Idempotent: يُنشئ ما ينقص فقط — التعديلات اللاحقة من لوحة الإدارة لا تُكتب فوقها.
 * الاستخدام: bun run scripts/restore-demo-users.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEMO_USERS: {
  email: string;
  name: string;
  password: string;
  roleKey: string;
}[] = [
  { email: "support@so7ob.local", name: "سلمى الدعم", password: "SupportS7ob2026!", roleKey: "support" },
  { email: "client@so7ob.local", name: "عميل العرض", password: "ClientS7ob2026!", roleKey: "client" },
];

async function main() {
  for (const u of DEMO_USERS) {
    const existing = await db.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (existing) {
      console.log(`↷ موجود مسبقًا: ${u.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 12);
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
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
