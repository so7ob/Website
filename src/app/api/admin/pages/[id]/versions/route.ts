/**
 * GET  /api/admin/pages/[id]/versions — تاريخ إصدارات الصفحة.
 * كل صف يتضمن بصمة خفيفة (summary) لأنواع الكتل ومستخلصها النصي —
 * تغذي مقارنة الإصدارات في الواجهة دون نقل محتوى كامل (خارطة الطريق 1.4).
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";
import { versionFingerprint } from "@/lib/blocks/version-diff";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(req, "pages.view");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const versions = await db.pageVersion.findMany({
    where: { pageId: id },
    orderBy: { version: "desc" },
    include: { author: { select: { name: true } } },
  });

  return json({
    ok: true,
    versions: versions.map((v) => ({
      id: v.id,
      locale: v.locale,
      version: v.version,
      note: v.note,
      author: v.author?.name ?? "—",
      createdAt: v.createdAt,
      blockCount: countBlocks(v.blocks),
      summary: versionFingerprint(v.blocks),
    })),
  });
}

function countBlocks(blocksJson: string): number {
  try {
    const parsed = JSON.parse(blocksJson) as unknown;
    // مغلف v1 أو مصفوفة v0
    if (Array.isArray(parsed)) return parsed.length;
    if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
      return countTreeNodes((parsed as { blocks: unknown[] }).blocks);
    }
    return 0;
  } catch {
    return 0;
  }
}

/** عدد عقد الشجرة كليًا (حاويات + كتل) */
function countTreeNodes(nodes: unknown[]): number {
  let n = 0;
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    n += 1;
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) n += countTreeNodes(children);
  }
  return n;
}
