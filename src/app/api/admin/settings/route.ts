/**
 * GET   /api/admin/settings — الإعدادات الحالية.
 * PATCH /api/admin/settings — تحديث مفاتيح معتمدة (تواصل + روابط اجتماعية + شريط الإعلان).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";

const ALLOWED_KEYS = [
  "contact.email",
  "contact.phone",
  "contact.address",
  "social.github",
  "site.nameAr",
  "site.nameEn",
  "announcement.enabled",
  "announcement.messageAr",
  "announcement.messageEn",
  "announcement.ctaLabelAr",
  "announcement.ctaLabelEn",
  "announcement.ctaUrl",
  "announcement.variant",
  "announcement.startAt",
  "announcement.endAt",
];

const ANNOUNCEMENT_VARIANTS = ["info", "warning", "success", "brand"];

/** تاريخ مجدول: YYYY-MM-DD أو ISO كامل (فارغ = بلا جدولة) */
const SCHEDULE_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export async function GET(req: NextRequest) {
  const guard = await guardApi(req, "settings.manage");
  if (!guard.ok) return guard.response;
  const rows = await db.siteSetting.findMany();
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return json({ ok: true, settings });
}

export async function PATCH(req: NextRequest) {
  const guard = await guardApi(req, "settings.manage");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const updates: { key: string; value: string }[] = [];
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      let value = String(body[key] ?? "").slice(0, 300);
      // تحقق مبسط من صيغ التواصل
      if (key === "contact.email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        return json({ ok: false, code: "invalid_email" }, 400);
      }
      if (key === "social.github" && value && !/^https?:\/\//.test(value)) {
        return json({ ok: false, code: "invalid_url" }, 400);
      }
      if (key === "contact.phone" && value && !/^[+]?[\d\s\-()]{7,20}$/.test(value)) {
        return json({ ok: false, code: "invalid_phone" }, 400);
      }
      // تحقق شريط الإعلان: الأطوال والصيغ
      if ((key === "announcement.messageAr" || key === "announcement.messageEn") && value.length > 280) {
        return json({ ok: false, code: "invalid" }, 400);
      }
      if ((key === "announcement.ctaLabelAr" || key === "announcement.ctaLabelEn") && value.length > 60) {
        return json({ ok: false, code: "invalid" }, 400);
      }
      if (key === "announcement.ctaUrl" && (value.length > 200 || (value && !/^(\/|https?:\/\/)/.test(value)))) {
        return json({ ok: false, code: "invalid_url" }, 400);
      }
      if (key === "announcement.variant" && !ANNOUNCEMENT_VARIANTS.includes(value)) {
        return json({ ok: false, code: "invalid" }, 400);
      }
      if (key === "announcement.enabled" && value !== "true" && value !== "false") {
        return json({ ok: false, code: "invalid" }, 400);
      }
      // جدولة الشريط: تاريخ صالح أو فارغ (بلا جدولة)
      if (
        (key === "announcement.startAt" || key === "announcement.endAt") &&
        value && !SCHEDULE_DATE_RE.test(value)
      ) {
        return json({ ok: false, code: "invalid" }, 400);
      }
      updates.push({ key, value });
    }
  }
  if (!updates.length) return json({ ok: false, code: "invalid" }, 400);

  // أي تغيير في مفاتيح الإعلان يرفع رقم المراجعة — يعيد إظهار الشريط لمن أخفاه
  if (updates.some((u) => u.key.startsWith("announcement."))) {
    updates.push({ key: "announcement.revision", value: String(Date.now()) });
  }

  for (const update of updates) {
    await db.siteSetting.upsert({
      where: { key: update.key },
      create: { key: update.key, value: update.value, updatedById: guard.user.id },
      update: { value: update.value, updatedById: guard.user.id },
    });
  }

  await audit({
    actorId: guard.user.id, actorEmail: guard.user.email, action: AUDIT_ACTIONS.settingsUpdated,
    entityType: "settings", details: { keys: updates.map((u) => u.key) },
  });

  return json({ ok: true });
}
