import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ find: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { mediaItem: { findUnique: fake.find } } }));
vi.mock("@/lib/file-storage", () => ({ readFileBuffer: fake.read }));
import { GET } from "@/app/api/media/[id]/route";
it("blocks legacy stored SVG before any file read", async () => {
  fake.find.mockResolvedValue({ mimeType: "image/svg+xml", storedName: "synthetic.svg" });
  const response = await GET(new NextRequest("http://localhost/api/media/abc"), { params: Promise.resolve({ id: "abc" }) });
  expect(response.status).toBe(404); expect(fake.read).not.toHaveBeenCalled();
});
