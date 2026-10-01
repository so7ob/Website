/**
 * GET  /api/admin/pages — قائمة الصفحات (لإدارة المحتوى).
 * POST /api/admin/pages — إنشاء صفحة (فارغة أو من قالب) مع فحص المسار المحجوز والتعارض.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { isValidSlug } from "@/lib/blocks/types";
import { validateBlocks } from "@/lib/blocks/types";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "pages.view");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);

  const pages = await db.page.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query ? { OR: [{ titleAr: { contains: query } }, { titleEn: { contains: query } }, { slug: { contains: query } }] } : {}),
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, slug: true, isHome: true, order: true, status: true, visibility: true,
      titleAr: true, titleEn: true,
      draftUpdatedAt: true, publishedAt: true, updatedAt: true,
      editorTouchedAt: true, sourceKey: true,
      _count: { select: { versions: true } },
    },
  });

  return json({
    ok: true,
    pages: pages.map((p) => ({
      ...p,
      hasUnpublishedChanges:
        p.status === "published" && p.draftUpdatedAt !== null && p.publishedAt !== null && p.draftUpdatedAt > p.publishedAt,
      versionCount: p._count.versions,
      _count: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await guardApi(req, "pages.edit");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const slug = String(body.slug ?? "").toLowerCase().trim();
  const titleAr = String(body.titleAr ?? "").trim().slice(0, 200);
  const titleEn = String(body.titleEn ?? "").trim().slice(0, 200);

  if (!isValidSlug(slug)) return json({ ok: false, code: "invalid_slug" }, 400);
  if (!titleAr && !titleEn) return json({ ok: false, code: "invalid_title" }, 400);

  const existing = await db.page.findUnique({ where: { slug } });
  if (existing) return json({ ok: false, code: "slug_taken" }, 409);

  // قوالب البدء — كتل صالحة وفق مخططات التحقق
  let blocksAr = "[]";
  let blocksEn = "[]";
  if (body.template === "blank-section") {
    const stamp = Date.now().toString(36);
    const make = (kicker: string, title: string, intro: string) =>
      JSON.stringify([
        {
          id: `b-ph-${stamp}`,
          type: "pageHeader",
          props: { kicker, title, intro: intro ? [intro] : [], quickLinks: [] },
        },
        {
          id: `b-rt-${stamp}`,
          type: "richText",
          props: { paragraphs: [intro || title], align: "start" },
        },
      ]);
    blocksAr = make(titleAr || titleEn, titleAr || titleEn, "");
    blocksEn = make(titleEn || titleAr, titleEn || titleAr, "");
  }

  // تحقق مبدئي للقالب
  const check = validateBlocks(blocksAr);
  if (!check.ok) return json({ ok: false, code: "invalid_blocks", error: check.error }, 400);

  const maxOrder = await db.page.aggregate({ _max: { order: true } });
  const page = await db.page.create({
    data: {
      slug,
      titleAr: titleAr || titleEn,
      titleEn: titleEn || titleAr,
      status: "draft",
      order: (maxOrder._max.order ?? 0) + 1,
      draftBlocksAr: blocksAr,
      draftBlocksEn: blocksEn,
      draftUpdatedAt: new Date(),
      editorTouchedAt: new Date(), // صفحة منشأة يدويًا — البذرة لا تلمسها
      seoTitleAr: titleAr || titleEn,
      seoTitleEn: titleEn || titleAr,
    },
  });

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.pageCreated,
    entityType: "page", entityId: page.id, details: { slug, template: String(body.template ?? "empty") },
  });

  return json({ ok: true, page: { id: page.id, slug: page.slug } }, 201);
}
