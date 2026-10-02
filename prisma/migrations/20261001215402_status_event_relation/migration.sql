-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RequestStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestStatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProjectRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequestStatusEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RequestStatusEvent" ("changedById", "createdAt", "fromStatus", "id", "note", "requestId", "toStatus") SELECT "changedById", "createdAt", "fromStatus", "id", "note", "requestId", "toStatus" FROM "RequestStatusEvent";
DROP TABLE "RequestStatusEvent";
ALTER TABLE "new_RequestStatusEvent" RENAME TO "RequestStatusEvent";
CREATE INDEX "RequestStatusEvent_requestId_createdAt_idx" ON "RequestStatusEvent"("requestId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
