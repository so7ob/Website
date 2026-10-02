/**
 * GET   /api/admin/settings — الإعدادات الحالية.
 * PATCH /api/admin/settings — تحديث مفاتيح معتمدة (تواصل + روابط اجتماعية).
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
];

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
      updates.push({ key, value });
    }
  }
  if (!updates.length) return json({ ok: false, code: "invalid" }, 400);

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
