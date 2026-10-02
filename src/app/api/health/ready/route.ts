import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dataDirectory, validateProductionPaths } from "@/lib/data-paths";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    validateProductionPaths();
    await db.$queryRaw`SELECT 1`;
    await access(join(dataDirectory(), "uploads"), constants.R_OK | constants.W_OK);
    return NextResponse.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
