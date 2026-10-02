/**
 * GET /api/attachments/[id] — تنزيل مرفق خاص بعد فحص الصلاحية في الخادم.
 * المالك (عميل الطلب) أو الطاقم بصلاحية عرض الطلبات فقط.
 */
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/session";
import { canAccessRequest } from "@/lib/requests-service";
import { canAccessInquiry } from "@/lib/auth/resource-access";
import { readFileBuffer } from "@/lib/file-storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]{1,40}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const user = await getAuthUser();
  if (!user || user.status === "suspended") return new NextResponse("Unauthorized", { status: 401 });

  const attachment = await db.attachment.findUnique({ where: { id }, include: { request: true, inquiry: true } });
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  // فحص الملكية/الصلاحية حسب سياق المرفق
  if (attachment.request) {
    if (!canAccessRequest(user, attachment.request)) return new NextResponse("Forbidden", { status: 403 });
  } else if (attachment.inquiry) {
    if (!canAccessInquiry(user, attachment.inquiry)) return new NextResponse("Forbidden", { status: 403 });
  } else if (attachment.uploaderId !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const buffer = readFileBuffer(attachment.storedName);
  if (!buffer) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
