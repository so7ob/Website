/**
 * GET /api/admin/menus — القوائم الحالية.
 * PUT /api/admin/menus — حفظ قائمة كاملة (location + items) بإعادة بناء مرتبة.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "menus.manage");
  if (!guard.ok) return guard.response;

  const [header, footer] = await Promise.all([
    db.menuItem.findMany({ where: { location: "header" }, orderBy: { order: "asc" } }),
    db.menuItem.findMany({ where: { location: "footer" }, orderBy: { order: "asc" } }),
  ]);
  const pages = await db.page.findMany({
    where: { status: { not: "archived" } },
    select: { slug: true, titleAr: true, titleEn: true },
    orderBy: { order: "asc" },
  });

  return json({ ok: true, header, footer, pages });
}

interface IncomingItem {
  labelAr?: unknown;
  labelEn?: unknown;
  url?: unknown;
  pageSlug?: unknown;
  enabled?: unknown;
}

export async function PUT(req: NextRequest) {
  const guard = await guardApi(req, "menus.manage");
  if (!guard.ok) return guard.response;

  let body: { location?: unknown; items?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const location = String(body.location ?? "");
  if (!["header", "footer"].includes(location)) return json({ ok: false, code: "invalid" }, 400);
  const items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];
  if (items.length > 12) return json({ ok: false, code: "too_many" }, 400);

  const clean = items
    .map((item, index) => ({
      labelAr: String(item.labelAr ?? "").slice(0, 120),
      labelEn: String(item.labelEn ?? "").slice(0, 120),
      url: typeof item.url === "string" && item.url.startsWith("/") ? item.url.slice(0, 200) : (typeof item.url === "string" && /^https?:\/\//.test(item.url) ? item.url.slice(0, 200) : null),
      // "/" = الصفحة الرئيسية في الواجهة → تُخزَّن بslug فارغ (متوافق مع العرض العام)
      pageSlug: typeof item.pageSlug === "string"
        ? (item.pageSlug === "/" ? "" : item.pageSlug.slice(0, 60) || null)
        : null,
      enabled: item.enabled !== false,
      order: index,
    }))
    .filter((item) => item.labelAr || item.labelEn);

  if (clean.length === 0) return json({ ok: false, code: "empty" }, 400);

  // استبدال ذري: حذف ثم إنشاء مرتب (داخل معاملة)
  await db.$transaction([
    db.menuItem.deleteMany({ where: { location } }),
    db.menuItem.createMany({ data: clean.map((item) => ({ ...item, location })) }),
  ]);

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.menuUpdated,
    entityType: "menu", entityId: location, details: { count: clean.length },
  });

  return json({ ok: true });
}
