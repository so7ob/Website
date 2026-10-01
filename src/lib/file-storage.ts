/**
 * تخزين المرفقات والوسائط — أسماء تخزين عشوائية خارج المجلد العام.
 * المرفقات الخاصة تُخدم عبر API بصلاحية؛ الوسائط العامة عبر /api/media/[id].
 */
import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync } from "fs";
import { join, extname } from "path";

const UPLOADS_DIR = join(process.cwd(), "db", "uploads");

/** أنواع مسموحة للمرفقات الخاصة — ترفض التنفيذي والمضغوط الخطير */
const ATTACHMENT_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/zip": ".zip",
};

/** الوسائط العامة: صور فقط */
const MEDIA_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/gif": ".gif",
};

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_MEDIA_SIZE = 8 * 1024 * 1024; // 8MB

export interface StoredFile {
  storedName: string;
  mimeType: string;
  size: number;
  filename: string;
  absolutePath: string;
}

function ensureDir(): string {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

function safeOriginal(name: string): string {
  return name.replace(/[^\w\s.\-()\u0600-\u06FF]/g, "_").slice(0, 120) || "file";
}

/** يتحقق من الملف ويحفظه باسم عشوائي */
export async function storeUpload(file: File, kind: "attachment" | "media"): Promise<StoredFile | { error: string }> {
  const allow = kind === "media" ? MEDIA_MIME : ATTACHMENT_MIME;
  const maxSize = kind === "media" ? MAX_MEDIA_SIZE : MAX_ATTACHMENT_SIZE;
  const mime = file.type || "";
  const ext = allow[mime];
  if (!ext) return { error: "type_not_allowed" };
  if (file.size <= 0) return { error: "empty" };
  if (file.size > maxSize) return { error: "too_large" };

  // امتداد الاسم الأصلي يجب أن يطابق النوع المعلن (فحص النوع الفعلي عبر الامتداد والترويسة مبسط)
  const originalExt = extname(file.name).toLowerCase();
  if (originalExt && !Object.values(allow).includes(originalExt)) return { error: "extension_mismatch" };

  const storedName = `${Date.now().toString(36)}-${randomBytes(16).toString("hex")}${ext}`;
  const absolutePath = join(ensureDir(), storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(absolutePath, buffer);

  return { storedName, mimeType: mime, size: file.size, filename: safeOriginal(file.name), absolutePath };
}

export function readFileBuffer(storedName: string): Buffer | null {
  const safe = storedName.replace(/[/\\]/g, "");
  const path = join(UPLOADS_DIR, safe);
  if (!path.startsWith(UPLOADS_DIR) || !existsSync(path)) return null;
  return readFileSync(path);
}

export function deleteStoredFile(storedName: string): void {
  try {
    const safe = storedName.replace(/[/\\]/g, "");
    const path = join(UPLOADS_DIR, safe);
    if (path.startsWith(UPLOADS_DIR) && existsSync(path)) unlinkSync(path);
  } catch {
    // تجاهل أخطاء الحذف
  }
}
