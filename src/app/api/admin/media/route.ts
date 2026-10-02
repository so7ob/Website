/**
 * GET  /api/admin/media — مكتبة الوسائط: بحث، تصفية بمجلد، تصفية بحالة الاستخدام
 *      (usage=in_use|unused)، عدّاد استخدام لكل عنصر، إجمالي غير المستخدم،
 *      وقائمة المجلدات المتاحة. الفلترة والبحث في الذاكرة (جدول صغير) لضمان
 *      ترتيب متسق وعدّاد استخدام دقيق في نفس الطلب.
 * POST /api/admin/media — رفع صورة عامة (فحص النوع والحجم، اسم تخزين عشوائي، مجلد اختياري).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { storeUpload } from "@/lib/file-storage";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { mediaUsageCounts, normalizeMediaFolder } from "@/lib/media-usage";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "media.manage");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = 24;
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100).toLowerCase();
  const folderRaw = url.searchParams.get("folder");
  // "" تعني «كل المجلدات» — معرف صريح مطلوب لأن الغياب والفراغ قد يصلهما العميل
  const folder = folderRaw && folderRaw !== "" ? folderRaw.slice(0, 60) : null;
  // حالة الاستخدام: all (افتراضي) | in_use | unused — أي قيمة أخرى تُسقط إلى all (لا 400)
  const usageRaw = url.searchParams.get("usage");
  const usage = usageRaw === "in_use" || usageRaw === "unused" ? usageRaw : "all";

  // فحص واحد لكل الوسائط + عدّاد استخدام واحد للصفحات والقوالب
  const [all, counts] = await Promise.all([
    db.mediaItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    }),
    mediaUsageCounts(),
  ]);

  const folders = Array.from(new Set(all.map((m) => m.folder))).sort((a, b) => a.localeCompare(b));

  let filtered = all;
  if (folder) filtered = filtered.filter((m) => m.folder === folder);
  if (search) {
    filtered = filtered.filter((m) =>
      m.filename.toLowerCase().includes(search) ||
      (m.altText ?? "").toLowerCase().includes(search) ||
      (m.title ?? "").toLowerCase().includes(search)
    );
  }

  // إجمالي غير المستخدم قبل فلترة الحالة (يغذي شارة التصفية) — على كل المجلدات
  const unusedTotal = all.reduce((acc, m) => acc + ((counts.get(m.id) ?? 0) === 0 ? 1 : 0), 0);

  if (usage === "in_use") filtered = filtered.filter((m) => (counts.get(m.id) ?? 0) > 0);
  if (usage === "unused") filtered = filtered.filter((m) => (counts.get(m.id) ?? 0) === 0);

  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return json({
    ok: true,
    total,
    unusedTotal,
    page,
    pageSize,
    folders,
    media: items.map((m) => ({
      id: m.id,
      filename: m.filename,
      url: `/api/media/${m.id}`,
      mimeType: m.mimeType,
      size: m.size,
      altText: m.altText,
      title: m.title,
      folder: m.folder,
      uploadedBy: m.uploadedBy?.name ?? "—",
      createdAt: m.createdAt,
      usageCount: counts.get(m.id) ?? 0,
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

  const folder = normalizeMediaFolder(form.get("folder"));
  if (folder === null) return json({ ok: false, code: "invalid_folder" }, 400);

  const stored = await storeUpload(file, "media");
  if ("error" in stored) return json({ ok: false, code: stored.error }, 400);

  const item = await db.mediaItem.create({
    data: {
      filename: stored.filename,
      storedName: stored.storedName,
      mimeType: stored.mimeType,
      size: stored.size,
      altText: altText || null,
      folder,
      uploadedById: guard.user.id,
    },
  });

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.mediaUploaded,
    entityType: "media", entityId: item.id, details: { filename: stored.filename, size: stored.size, folder },
  });

  return json({ ok: true, media: { id: item.id, url: `/api/media/${item.id}`, filename: item.filename, folder } }, 201);
}
