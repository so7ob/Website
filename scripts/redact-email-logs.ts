/** Explicit one-way maintenance operation. Back up privately before running. */
import { PrismaClient } from "@prisma/client";

if (process.argv[2] !== "--confirm-backup-and-redact") {
  console.error("Take and verify a protected backup first, then pass --confirm-backup-and-redact. This removes all stored mail bodies and provider error text.");
  process.exit(1);
}
const db = new PrismaClient();
try {
  const result = await db.emailLog.updateMany({ data: { bodyText: "", bodyHtml: null, error: null } });
  console.log(`Redacted ${result.count} mail log rows. No message content printed.`);
} finally { await db.$disconnect(); }
