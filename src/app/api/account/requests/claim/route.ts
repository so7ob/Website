/**
 * POST /api/account/requests/claim — طلب ربط طلب قديم بحساب.
 * لا يكفي تطابق البريد: يُرسل رابط تأكيد بالبريد المسجل في الطلب.
 */
import { type NextRequest } from "next/server";
import { guardApi, json } from "@/lib/auth/session";
import { checkRateLimit, memoryStore } from "@/lib/ratelimit";
import { beginClaim } from "@/lib/auth/claims";
import { sendMail, absoluteUrl, emailDevMode } from "@/lib/auth/email";
import { claimRequestMail } from "@/lib/auth/email-templates";
import { audit, AUDIT_ACTIONS } from "@/lib/auth/audit";
import { notify } from "@/lib/auth/notifications";

const rateStore = memoryStore();

export async function POST(req: NextRequest) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(rateStore, `claim:${user.id}:${ip}`, Date.now(), {
    shortMax: 3,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 10,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  });
  if (!limit.allowed) return json({ ok: false, code: "rate_limited", retryAfterSec: limit.retryAfterSec }, 429);

  let body: { refCode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }
  const refCode = String(body?.refCode ?? "").trim().toUpperCase().slice(0, 30);
  if (!refCode) return json({ ok: false, code: "invalid" }, 400);

  const generic = { ok: true, message: "claim_sent" };
  const started = await beginClaim(user.id, refCode);
  if (!started) return json(generic);
  const { request, token } = started;

  const locale = request.locale === "en" ? "en" : "ar";
  const verifyUrl = absoluteUrl(`/api/account/claim-verify?token=${token.raw}&ref=${refCode}`);
  const mail = claimRequestMail(locale, { url: verifyUrl, refCode });
  const mailResult = await sendMail({ to: request.email, subject: mail.subject, text: mail.text });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.requestClaimed,
    entityType: "request",
    entityId: request.id,
    details: { ref: refCode, stage: "requested", emailStatus: mailResult.status },
    ip,
  });
  await notify({ userId: user.id, type: "account", payload: { ref: refCode, stage: "claim_requested" } });

  return json({ ...generic, ...(emailDevMode() ? { devVerifyUrl: verifyUrl } : {}) });
}
