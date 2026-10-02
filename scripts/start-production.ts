import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDirectory, sqlitePath, validateProductionPaths } from "../src/lib/data-paths";

try {
  Object.assign(process.env, { NODE_ENV: "production" });
  validateProductionPaths();
  const directory = dataDirectory();
  const database = sqlitePath(process.env.DATABASE_URL);
  if (!existsSync(database)) throw new Error("Database missing; provision and migrate before startup");
  accessSync(database, constants.R_OK | constants.W_OK);
  mkdirSync(join(directory, "uploads"), { recursive: true, mode: 0o700 });
  accessSync(directory, constants.R_OK | constants.W_OK);
  accessSync(join(directory, "uploads"), constants.R_OK | constants.W_OK);
  const child = Bun.spawn([process.execPath, ".next/standalone/server.js"], {
    env: process.env, stdin: "inherit", stdout: "inherit", stderr: "inherit",
  });
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => child.kill(signal));
  process.exit(await child.exited);
} catch (error) {
  console.error("Startup refused:", error instanceof Error ? error.message : "invalid runtime configuration");
  process.exit(1);
}
