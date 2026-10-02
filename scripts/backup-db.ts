/**
 * نسخة احتياطية لقاعدة البيانات قبل أي ترحيل — الوقت باسم الملف.
 * الاستخدام: bun run scripts/backup-db.ts [وصف اختياري]
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const dbPath = process.env.DATABASE_URL?.replace("file:", "");
const desc = process.argv.slice(2).join("-").replace(/[^\w-]/g, "") || "manual";

if (!dbPath || !existsSync(dbPath)) {
  console.error("✗ لم يُعثر على قاعدة البيانات — تحقق من DATABASE_URL");
  process.exit(1);
}

const backupDir = join(process.cwd(), "db", "backups");
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `custom-${stamp}-${desc}.db`);
copyFileSync(dbPath, target);
console.log(`✓ نسخة احتياطية: ${target}`);
