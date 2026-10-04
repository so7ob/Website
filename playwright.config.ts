/**
 * إعداد حزمة القبول E2E (خارطة الطريق 3.1 — G8).
 *
 * المبادئ:
 * - الخادم الحي يُعاد استخدامه إن كان يعمل (تطوير محلي) — وإلا يُشغَّل تلقائيًا (CI).
 * - worker واحد: بيئة dev واحدة وقاعدة واحدة — الاختبارات متسلسلة حتميًا.
 * - أزمنة سخية: تجميع Next.js عند أول طلب بطيء في dev.
 * - E2E_PORT يسمح بتشغيل الحزمة على خادم معزول (worktrees) دون مساس 3000.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "./test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT: String(PORT),
      NEXT_TELEMETRY_DISABLED: "1",
    } as Record<string, string>,
  },
});
