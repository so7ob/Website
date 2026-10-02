/**
 * GET /api/media/[id] — تقديم وسائط الموقع العامة (صور CMS) عبر API بصلاحية عامة.
 * الملفات نفسها خارج المجلد العام — لا وصول مباشر من المسار.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { MEDIA_MIME } from "@/lib/upload-validation";
import { readFileBuffer } from "@/lib/file-storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]{1,40}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const item = await db.mediaItem.findUnique({ where: { id } });
  if (!item || !Object.hasOwn(MEDIA_MIME, item.mimeType)) return new NextResponse("Not found", { status: 404 });

  const buffer = readFileBuffer(item.storedName);
  if (!buffer) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": item.mimeType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "Content-Disposition": `inline; filename="${encodeURIComponent(item.filename)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
