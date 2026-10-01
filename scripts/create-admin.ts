/**
 * إنشاء أول مدير نظام — أداة إعداد آمنة موثقة (لا كلمة مرور افتراضية في المستودع).
 *
 * الاستخدام:
 *   bun run scripts/create-admin.ts --email admin@example.com --password "StrongPass123" [--name "المدير"] [--locale ar]
 *   أو عبر متغيرات البيئة: ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
 *
 * يرفض العمل إن وُجد مدير نظام نشط بالفعل (التحقق قبل أي تغيير).
 */
import bcrypt from "bcryptjs";

interface Args {
  email: string;
  password: string;
  name: string;
  locale: string;
}

function parseArgs(argv: string[]): Partial<Args> {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email") out.email = argv[++i];
    else if (argv[i] === "--password") out.password = argv[++i];
    else if (argv[i] === "--name") out.name = argv[++i];
    else if (argv[i] === "--locale") out.locale = argv[++i];
  }
  return out;
}

async function main() {
  const args = {
    email: (parseArgs(process.argv.slice(2)).email ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
    password: parseArgs(process.argv.slice(2)).password ?? process.env.ADMIN_PASSWORD ?? "",
    name: (parseArgs(process.argv.slice(2)).name ?? process.env.ADMIN_NAME ?? "مدير النظام").trim(),
    locale: (parseArgs(process.argv.slice(2)).locale ?? "ar").trim(),
  };

  if (!args.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(args.email)) {
    console.error("✗ بريد إلكتروني غير صالح. الاستخدام: --email admin@example.com --password ...");
    process.exit(1);
  }
  if (!args.password || args.password.length < 8 || !/[A-Za-z]/.test(args.password) || !/\d/.test(args.password)) {
    console.error("✗ كلمة المرور ضعيفة: 8 محارف فأكثر مع حروف وأرقام.");
    process.exit(1);
  }

  // تحميل Prisma (سكربت مستقل)
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();

  try {
    // بذرة الأدوار أولًا (idempotent)
    const { SYSTEM_ROLES } = await import("../src/lib/auth/permissions");
    for (const role of SYSTEM_ROLES) {
      await db.role.upsert({
        where: { key: role.key },
        create: {
          key: role.key,
          nameAr: role.nameAr,
          nameEn: role.nameEn,
          descriptionAr: role.descriptionAr,
          descriptionEn: role.descriptionEn,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
        },
        update: {},
      });
    }

    const existingAdmin = await db.user.findFirst({
      where: { roleKey: "super_admin", status: "active" },
      select: { email: true },
    });
    if (existingAdmin) {
      console.error(`✗ يوجد مدير نظام نشط بالفعل (${existingAdmin.email}). لا يُنشأ مدير ثانٍ بهذه الأداة — عدّل الأدوار من لوحة الإدارة.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(args.password, 12);
    const user = await db.user.upsert({
      where: { email: args.email },
      create: {
        email: args.email,
        name: args.name,
        passwordHash,
        locale: args.locale === "en" ? "en" : "ar",
        roleKey: "super_admin",
        status: "active",
        emailVerifiedAt: new Date(),
      },
      update: {
        passwordHash,
        roleKey: "super_admin",
        status: "active",
        emailVerifiedAt: new Date(),
      },
    });

    await db.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "admin.bootstrap_created",
        entityType: "user",
        entityId: user.id,
        details: JSON.stringify({ tool: "scripts/create-admin.ts" }),
      },
    });

    console.log(`✓ أُنشئ مدير النظام: ${args.email}`);
    console.log("  سجّل الدخول ثم غيّر كلمة المرور فورًا — هذه القيمة لن تُخزن في أي مكان آخر.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
