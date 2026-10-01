/**
 * GET  /api/admin/pages/[id]/versions — تاريخ إصدارات الصفحة.
 */
import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { guardApi, json } from "@/lib/auth/session";

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
    })),
  });
}

function countBlocks(blocksJson: string): number {
  try {
    const arr = JSON.parse(blocksJson);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}
