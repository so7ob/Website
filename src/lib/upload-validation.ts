import sharp from "sharp";
import { extname } from "node:path";

export const ATTACHMENT_MIME: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "application/pdf": ".pdf", "text/plain": ".txt", "text/csv": ".csv",
  "application/msword": ".doc", "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx", "application/zip": ".zip",
};
export const MEDIA_MIME: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
};
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const MAX_MEDIA_SIZE = 8 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;

/** Read only central-directory names; never expand archives during validation. */
function zipEntries(buffer: Buffer): string[] | null {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) return null;
  const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16);
  if (count > 1000 || offset + size !== end || buffer.readUInt16LE(end + 8) !== count) return null;
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const length = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const next = offset + 46 + length + extra + comment;
    if (next > end) return null;
    names.push(buffer.subarray(offset + 46, offset + 46 + length).toString("utf8"));
    offset = next;
  }
  return offset === end ? names : null;
}

export async function validateUpload(file: File, kind: "attachment" | "media") {
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const allow = kind === "media" ? MEDIA_MIME : ATTACHMENT_MIME;
  const extension = Object.hasOwn(allow, mime) ? allow[mime] : undefined;
  if (!extension) return { error: "type_not_allowed" } as const;
  if (file.size <= 0) return { error: "empty" } as const;
  if (file.size > (kind === "media" ? MAX_MEDIA_SIZE : MAX_ATTACHMENT_SIZE)) return { error: "too_large" } as const;
  const original = extname(file.name).toLowerCase();
  if (original !== extension && !(mime === "image/jpeg" && original === ".jpeg")) return { error: "extension_mismatch" } as const;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size) return { error: "type_not_allowed" } as const;
  let valid = false;
  if (mime.startsWith("image/")) {
    const signature = mime === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      : mime === "image/jpeg" ? buffer.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
      : mime === "image/webp" ? buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
      : ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
    if (!signature) return { error: "type_not_allowed" } as const;
    try {
      const image = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
      const meta = await image.metadata();
      const expected = mime.slice(6);
      valid = (meta.pages ?? 1) <= 100 && meta.format === expected && Boolean(meta.width && meta.height && meta.width * meta.height <= MAX_PIXELS);
      if (valid) await image.stats(); // Decode raster data, not only the container header.
    } catch { valid = false; }
  } else if (mime === "application/pdf") {
    valid = buffer.subarray(0, 5).equals(Buffer.from("%PDF-")) && /%%EOF\s*$/.test(buffer.subarray(-1024).toString("ascii"));
  } else if (mime.startsWith("text/")) {
    try { const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text); } catch { valid = false; }
  } else if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
    valid = buffer.length >= 512 && buffer.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"));
  } else {
    const entries = zipEntries(buffer);
    valid = entries !== null;
    if (extension === ".docx") valid = Boolean(entries?.includes("[Content_Types].xml") && entries.includes("word/document.xml"));
    if (extension === ".xlsx") valid = Boolean(entries?.includes("[Content_Types].xml") && entries.includes("xl/workbook.xml"));
  }
  return valid ? { mimeType: mime, extension, buffer } : { error: "type_not_allowed" } as const;
}
