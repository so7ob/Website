-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "allowedRoles" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "seoTitleAr" TEXT,
    "seoTitleEn" TEXT,
    "seoDescAr" TEXT,
    "seoDescEn" TEXT,
    "ogMediaId" TEXT,
    "draftBlocksAr" TEXT NOT NULL DEFAULT '[]',
    "draftBlocksEn" TEXT NOT NULL DEFAULT '[]',
    "draftUpdatedAt" DATETIME,
    "draftUpdatedById" TEXT,
    "draftSettings" TEXT NOT NULL DEFAULT '{}',
    "draftRevision" INTEGER NOT NULL DEFAULT 0,
    "publishedRevision" INTEGER,
    "publishedSettings" TEXT,
    "publishedBlocksAr" TEXT,
    "publishedBlocksEn" TEXT,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "sourceKey" TEXT,
    "seedVersion" INTEGER NOT NULL DEFAULT 0,
    "editorTouchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Page" ("allowedRoles", "createdAt", "draftBlocksAr", "draftBlocksEn", "draftUpdatedAt", "draftUpdatedById", "editorTouchedAt", "id", "isHome", "ogMediaId", "order", "publishedAt", "publishedBlocksAr", "publishedBlocksEn", "publishedById", "seedVersion", "seoDescAr", "seoDescEn", "seoTitleAr", "seoTitleEn", "slug", "sourceKey", "status", "titleAr", "titleEn", "updatedAt", "visibility") SELECT "allowedRoles", "createdAt", "draftBlocksAr", "draftBlocksEn", "draftUpdatedAt", "draftUpdatedById", "editorTouchedAt", "id", "isHome", "ogMediaId", "order", "publishedAt", "publishedBlocksAr", "publishedBlocksEn", "publishedById", "seedVersion", "seoDescAr", "seoDescEn", "seoTitleAr", "seoTitleEn", "slug", "sourceKey", "status", "titleAr", "titleEn", "updatedAt", "visibility" FROM "Page";
DROP TABLE "Page";
ALTER TABLE "new_Page" RENAME TO "Page";
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");
CREATE INDEX "Page_status_order_idx" ON "Page"("status", "order");

-- ترحيل البيانات القائمة: بناء إعدادات المسودة من الأعمدة الحالية (الحالة قبل الفصل)
-- وsnapshot الإعدادات المنشورة للصفحات المنشورة حتى يظل ما يراه الزوار كما هو بعد النشر الأول.
UPDATE "Page" SET "draftSettings" = json_object(
  'slug', "slug",
  'visibility', "visibility",
  'allowedRoles', "allowedRoles",
  'titleAr', "titleAr",
  'titleEn', "titleEn",
  'seoTitleAr', "seoTitleAr",
  'seoTitleEn', "seoTitleEn",
  'seoDescAr', "seoDescAr",
  'seoDescEn', "seoDescEn",
  'order', "order"
);
UPDATE "Page" SET "publishedSettings" = "draftSettings"
WHERE "status" = 'published' AND "publishedBlocksAr" IS NOT NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
