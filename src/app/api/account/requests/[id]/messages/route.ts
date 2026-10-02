/**
 * POST /api/account/requests/[id]/messages — رد على محادثة طلب.
 * العميل يرسل رسائل؛ الطاقم رسائل أو ملاحظات داخلية — التمييز يتحقق منه الخادم.
 */
import { type NextRequest } from "next/server";
import { guardApi, json } from "@/lib/auth/session";
import { sendRequestMessage } from "@/lib/requests-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: { body?: unknown; kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ ok: false, code: "invalid" }, 400);
  }

  const text = String(body.body ?? "");
  const kind = body.kind === "internal_note" ? "internal_note" : "message";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const result = await sendRequestMessage({
    requestId: id,
    author: guard.user,
    kind,
    body: text,
    ip,
  });

  if (!result.ok) return json({ ok: false, code: result.code }, result.status);
  return json({ ok: true, message: result.message }, 201);
}
