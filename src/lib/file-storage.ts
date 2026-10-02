/**
 * تخزين المرفقات والوسائط — أسماء تخزين عشوائية خارج المجلد العام.
 * المرفقات الخاصة تُخدم عبر API بصلاحية؛ الوسائط العامة عبر /api/media/[id].
 */
import { randomBytes } from "crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync } from "fs";
import { join, extname } from "path";

const UPLOADS_DIR = join(process.cwd(), "db", "uploads");

import { validateUpload } from "./upload-validation";
export { MAX_ATTACHMENT_SIZE, MAX_MEDIA_SIZE } from "./upload-validation";

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
  const checked = await validateUpload(file, kind);
  if ("error" in checked) return { error: checked.error! };
  const { mimeType: mime, extension: ext, buffer } = checked;

  const storedName = `${Date.now().toString(36)}-${randomBytes(16).toString("hex")}${ext}`;
  const absolutePath = join(ensureDir(), storedName);
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
