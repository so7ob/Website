/**
 * GET /api/account/inquiries/[id] — تفاصيل استفسار ومحادثته.
 * الملاحظات الداخلية شأن الطاقم وحده: تُحجب عن العميل بعد الجلب،
 * ويبقى مسار الطاقم المسند كاملًا كما في بوابة الإدارة.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req);
  if (!guard.ok) return guard.response;
  const { user } = guard;
  const { id } = await params;

  const inquiry = await db.inquiry.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, roleKey: true } } } },
      attachments: true,
      assignee: { select: { id: true, name: true } },
    },
  });

  // 404 لا 403 — حتى لا نكشف وجود السجل لغير أصحابه
  if (!inquiry) return json({ ok: false, code: "not_found" }, 404);
  const owns = user.roleKey === "client" ? inquiry.clientId === user.id : inquiry.assigneeId === user.id;
  if (!owns) return json({ ok: false, code: "not_found" }, 404);

  // العميل لا يرى الملاحظات الداخلية — تُرشَّح بعد الجلب (الطاقم المسند يراها كاملة)
  const visible =
    user.roleKey === "client"
      ? { ...inquiry, messages: inquiry.messages.filter((m) => m.kind !== "internal_note") }
      : inquiry;

  return json({ ok: true, inquiry: visible });
}
