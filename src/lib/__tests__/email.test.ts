import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fake = vi.hoisted(() => ({ create: vi.fn(), send: vi.fn(), close: vi.fn(), findMany: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { emailLog: { create: fake.create, findMany: fake.findMany, count: vi.fn().mockResolvedValue(1) } } }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: fake.send, close: fake.close }) } }));
vi.mock("@/lib/auth/session", () => ({ guardApi: fake.guard, json: (data: unknown, status = 200) => Response.json(data, { status }) }));
import { emailDevMode, sendMail } from "../auth/email";
import { GET } from "@/app/api/admin/outbox/route";
const message = { to: "synthetic@example.invalid", subject: "Synthetic verification", text: "https://example.invalid/verify?token=SYNTHETIC_SECRET", html: "<a href='https://example.invalid/?token=SYNTHETIC_SECRET'>Verify</a>" };
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("mail secrets", () => {
  it.each(["development", "test", "production"])("restricts development links in %s", mode => {
    vi.stubEnv("NODE_ENV", mode); vi.stubEnv("EMAIL_DEV_MODE", "true");
    expect(emailDevMode()).toBe(mode !== "production");
  });
  it.each(["dev", "missing", "sent", "failure"])("stores metadata only for %s", async mode => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("EMAIL_DEV_MODE", "true");
    vi.stubEnv("SMTP_HOST", mode === "missing" ? "" : "smtp.example.invalid"); vi.stubEnv("SMTP_USER", "synthetic");
    if (mode === "dev") vi.stubEnv("NODE_ENV", "development");
    fake.create.mockResolvedValue({ id: "synthetic" });
    fake.send.mockReset();
    if (mode === "failure") fake.send.mockRejectedValue(new Error(message.text)); else fake.send.mockResolvedValue({});
    const result = await sendMail(message);
    expect(result.status).toBe(mode === "dev" ? "dev_logged" : mode === "sent" ? "sent" : "failed");
    expect(JSON.stringify(fake.create.mock.calls)).not.toContain("SYNTHETIC_SECRET");
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_SECRET");
    expect(fake.create.mock.calls[0][0].data).toMatchObject({ bodyText: "", bodyHtml: null });
    if (mode === "sent" || mode === "failure") expect(fake.send).toHaveBeenCalledWith(expect.objectContaining({ text: message.text, html: message.html }));
    else expect(fake.send).not.toHaveBeenCalled();
  });
  it("never selects legacy bodies or provider error text", async () => {
    fake.guard.mockResolvedValue({ ok: true }); fake.findMany.mockResolvedValue([{ id: "synthetic", status: "sent" }]);
    const response = await GET(new NextRequest("http://localhost/api/admin/outbox?page=invalid"));
    expect(response.status).toBe(200);
    const select = fake.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("bodyText"); expect(select).not.toHaveProperty("bodyHtml"); expect(select).not.toHaveProperty("error");
    expect((await response.json()).emails[0]).toMatchObject({ bodyText: "", bodyHtml: null, error: null });
  });
  it.each([401, 403])("does not query mail for a rejected user (%s)", async status => {
    fake.guard.mockResolvedValue({ ok: false, response: Response.json({ ok: false }, { status }) });
    const response = await GET(new NextRequest("http://localhost/api/admin/outbox"));
    expect(response.status).toBe(status); expect(fake.findMany).not.toHaveBeenCalled();
    expect(fake.guard).toHaveBeenCalledWith(expect.anything(), "email.outbox");
  });
});
