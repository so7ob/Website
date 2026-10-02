/**
 * GET  /api/admin/media — مكتبة الوسائط.
 * POST /api/admin/media — رفع صورة عامة (فحص النوع والحجم، اسم تخزين عشوائي).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { storeUpload } from "@/lib/file-storage";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "media.manage");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = 24;

  const [total, items] = await Promise.all([
    db.mediaItem.count(),
    db.mediaItem.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { uploadedBy: { select: { name: true } } },
    }),
  ]);

  return json({
    ok: true,
    total,
    page,
    pageSize,
    media: items.map((m) => ({
      id: m.id,
      filename: m.filename,
      url: `/api/media/${m.id}`,
      mimeType: m.mimeType,
      size: m.size,
      altText: m.altText,
      title: m.title,
      uploadedBy: m.uploadedBy?.name ?? "—",
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, "media.upload");
  if (!guard.ok) return guard.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, code: "no_file" }, 400);
  const altText = String(form.get("altText") ?? "").slice(0, 300);

  const stored = await storeUpload(file, "media");
  if ("error" in stored) return json({ ok: false, code: stored.error }, 400);

  const item = await db.mediaItem.create({
    data: {
      filename: stored.filename,
      storedName: stored.storedName,
      mimeType: stored.mimeType,
      size: stored.size,
      altText: altText || null,
      uploadedById: guard.user.id,
    },
  });

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.mediaUploaded,
    entityType: "media", entityId: item.id, details: { filename: stored.filename, size: stored.size },
  });

  return json({ ok: true, media: { id: item.id, url: `/api/media/${item.id}`, filename: item.filename } }, 201);
}
