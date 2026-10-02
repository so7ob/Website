import { restoreBackup } from "./lib/backup";

try {
  const [source, target, ...extra] = process.argv.slice(2);
  if (!source || !target || extra.length) throw new Error("Usage: bun run db:restore <snapshot> <new-absolute-data-directory>");
  restoreBackup(source, target);
  console.log("Verified restore completed. Database filename: database.db. Configure DATA_DIR and DATABASE_URL before starting an isolated smoke test.");
} catch (error) {
  console.error("Restore failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
}
