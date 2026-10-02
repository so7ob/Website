-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "roleKey" TEXT NOT NULL DEFAULT 'client',
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "emailVerifiedAt" DATETIME,
    "sessionsRevokedAt" DATETIME,
    "lastLoginAt" DATETIME,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleKey_fkey" FOREIGN KEY ("roleKey") REFERENCES "Role" ("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("company", "createdAt", "email", "emailVerifiedAt", "id", "lastLoginAt", "locale", "name", "passwordHash", "phone", "roleKey", "sessionsRevokedAt", "status", "updatedAt") SELECT "company", "createdAt", "email", "emailVerifiedAt", "id", "lastLoginAt", "locale", "name", "passwordHash", "phone", "roleKey", "sessionsRevokedAt", "status", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_roleKey_status_idx" ON "User"("roleKey", "status");
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
