import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

test("an upload survives a fresh process with a different standalone working directory", async () => {
  const root = mkdtempSync(join(tmpdir(), "so7ob-storage-"));
  try {
    const data = join(root, "data");
    const releaseA = join(root, "a/.next/standalone");
    const releaseB = join(root, "b/.next/standalone");
    mkdirSync(releaseA, { recursive: true }); mkdirSync(releaseB, { recursive: true });
    const storageModule = resolve("src/lib/file-storage.ts");
    const env = { ...process.env, NODE_ENV: "production", DATA_DIR: data };
    const content = "%PDF-1.4\nsynthetic persistent data\n%%EOF";
    const upload = Bun.spawn([process.execPath, "--eval", `import { storeUpload } from ${JSON.stringify(storageModule)}; const result = await storeUpload(new File([${JSON.stringify(content)}], 'sample.pdf', {type:'application/pdf'}), 'attachment'); if ('error' in result) process.exit(1); console.log(result.storedName);`], { cwd: releaseA, env, stdout: "pipe", stderr: "pipe" });
    const storedName = (await new Response(upload.stdout).text()).trim();
    expect(await new Response(upload.stderr).text()).toBe("");
    expect(await upload.exited).toBe(0);
    const read = Bun.spawn([process.execPath, "--eval", `import { readFileBuffer } from ${JSON.stringify(storageModule)}; const bytes = readFileBuffer(${JSON.stringify(storedName)}); if (!bytes) process.exit(1); console.log(bytes.toString());`], { cwd: releaseB, env, stdout: "pipe", stderr: "pipe" });
    expect((await new Response(read.stdout).text()).trim()).toBe(content);
    expect(await read.exited).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
