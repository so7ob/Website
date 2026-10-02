import { join } from "node:path";
import { dataDirectory } from "../src/lib/data-paths";
import { createBackup } from "./lib/backup";

try {
  const description = process.argv.slice(2).join("-").replace(/[^\w-]/g, "") || "manual";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(dataDirectory(), "backups", `${stamp}-${description}`);
  createBackup(target);
  console.log(`Verified database and uploads snapshot: ${target}`);
} catch (error) {
  console.error("Backup failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
}
