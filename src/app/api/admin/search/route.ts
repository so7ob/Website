/**
 * GET /api/admin/search — البحث الشامل للوحة الإدارة (لوحة الأوامر Ctrl+K):
 * يبحث دفعة واحدة في المستخدمين والطلبات والاستفسارات والصفحات،
 * وكل مجموعة تُعاد فقط إذا كان للمستخدم الحالي صلاحية رؤيتها —
 * الحارس الأساسي admin.dashboard يمرر أي دور إداري، والتصفية الدقيقة لكل مجموعة.
 * الطلبات والاستفسارات المؤرشفة مستثناة (خارج نطاق العمل اليومي)،
 * وكذلك صفحات الحالة «archived». البحث يحتّم حرفين على الأقل.
 * ملاحظة على المخطط: ProjectRequest لا يملك حقل subject — الوصف (description)
 * هو النص القابل للبحث، وعناوين الصفحة نصّان مستقلان (titleAr/titleEn) لا JSON.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json, can } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  // حارس أساسي: أي دور إداري يملك لوحة الإدارة يمر (التصفية لكل مجموعة أدناه)
  const guard = await guardApi(req, "admin.dashboard");
  if (!guard.ok) return guard.response;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  if (q.length < 2) {
    return json({ ok: true, users: [], requests: [], inquiries: [], pages: [] });
  }

  const [users, requests, inquiries, pages] = await Promise.all([
    // المستخدمون — لمن يملك users.view (بلا استثناء حالة؛ الحالة تُعرض في النتيجة)
    can(guard.user, "users.view")
      ? db.user.findMany({
          where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, email: true, status: true, roleKey: true },
        })
      : [],
    // الطلبات — لمن يملك requests.view.all؛ المؤرشفة مستثناة والترتيب بآخر نشاط
    can(guard.user, "requests.view.all")
      ? db.projectRequest.findMany({
          where: {
            archivedAt: null,
            OR: [{ refCode: { contains: q } }, { name: { contains: q } }, { description: { contains: q } }],
          },
          orderBy: { lastActivityAt: "desc" },
          take: 5,
          select: { id: true, refCode: true, name: true, status: true },
        })
      : [],
    // الاستفسارات — لمن يملك inquiries.view.all؛ المؤرشفة مستثناة
    can(guard.user, "inquiries.view.all")
      ? db.inquiry.findMany({
          where: {
            archivedAt: null,
            OR: [{ refCode: { contains: q } }, { email: { contains: q } }, { subject: { contains: q } }],
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, refCode: true, email: true, subject: true, status: true },
        })
      : [],
    // الصفحات — لمن يملك pages.view؛ المؤرشفة مستثناة والبحث في المعرّف والعنوانين
    can(guard.user, "pages.view")
      ? db.page.findMany({
          where: {
            status: { not: "archived" },
            OR: [{ slug: { contains: q } }, { titleAr: { contains: q } }, { titleEn: { contains: q } }],
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, slug: true, titleAr: true, titleEn: true, status: true },
        })
      : [],
  ]);

  return json({ ok: true, users, requests, inquiries, pages });
}
