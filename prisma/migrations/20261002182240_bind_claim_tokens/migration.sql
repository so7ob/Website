-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN "resourceId" TEXT;

-- Legacy claim tokens cannot prove a resource. Invalidate them; reset/email tokens remain valid.
UPDATE "AuthToken" SET "usedAt" = CURRENT_TIMESTAMP
WHERE "type" = 'request_claim' AND "resourceId" IS NULL AND "usedAt" IS NULL;
