/**
 * بذرة الأدوار النظامية — قابلة لإعادة التشغيل دون تكرار (upsert).
 * الأدوار المخصصة/المعدلة من لوحة الإدارة لن تُكتب فوقها هذه البذرة
 * إلا للأدوار النظامية التي لم تُعدَّل يدويًا (editorTouchedAt = null).
 */
import { db } from "@/lib/db";
import { SYSTEM_ROLES } from "@/lib/auth/permissions";

async function main() {
  for (const role of SYSTEM_ROLES) {
    const existing = await db.role.findUnique({ where: { key: role.key } });
    if (existing && existing.isSystem) {
      // تحديث الأسماء والوصف فقط — الصلاحيات تُدار من لوحة الإدارة بعد أول تعديل
      await db.role.update({
        where: { key: role.key },
        data: {
          nameAr: role.nameAr,
          nameEn: role.nameEn,
          descriptionAr: role.descriptionAr,
          descriptionEn: role.descriptionEn,
        },
      });
    } else if (!existing) {
      await db.role.create({
        data: {
          key: role.key,
          nameAr: role.nameAr,
          nameEn: role.nameEn,
          descriptionAr: role.descriptionAr,
          descriptionEn: role.descriptionEn,
          permissions: JSON.stringify(role.permissions),
          isSystem: true,
        },
      });
    }
  }
  console.log("✓ الأدوار النظامية جاهزة");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
