import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** Resolve symlinks even when the final directory has not been created yet. */
export function canonicalPath(value: string): string {
  const path = resolve(value);
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return join(canonicalPath(parent), path.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
}

export function isWithin(parent: string, child: string): boolean {
  const part = relative(canonicalPath(parent), canonicalPath(child));
  return part === "" || (!part.startsWith(`..${sep}`) && part !== ".." && !isAbsolute(part));
}

export function dataDirectory(env: Readonly<Record<string, string | undefined>> = process.env, root = process.cwd()): string {
  const configured = env.DATA_DIR?.trim();
  if (configured && !isAbsolute(configured)) throw new Error("DATA_DIR must be absolute");
  if (env.NODE_ENV === "production" && !configured) throw new Error("DATA_DIR is required in production");
  const directory = canonicalPath(configured || join(root, "db"));
  if (env.NODE_ENV === "production" && isWithin(root, directory)) {
    throw new Error("DATA_DIR must be outside the application release");
  }
  return directory;
}

/** Prisma SQLite relative URLs are relative to prisma/schema.prisma, not cwd. */
export function sqlitePath(url: string | undefined, root = process.cwd()): string {
  if (!url?.startsWith("file:")) throw new Error("DATABASE_URL must be a SQLite file URL");
  const path = url.slice(5);
  if (!path || path === ":memory:" || /[?#\0]/.test(path)) throw new Error("Unsupported SQLite file URL");
  return canonicalPath(isAbsolute(path) ? path : resolve(root, "prisma", path));
}

export function validateProductionPaths(env: Readonly<Record<string, string | undefined>> = process.env, root = process.cwd()): void {
  const data = dataDirectory(env, root);
  const database = sqlitePath(env.DATABASE_URL, root);
  if (env.NODE_ENV === "production") {
    if (!isAbsolute(env.DATABASE_URL!.slice(5))) throw new Error("Production DATABASE_URL must be absolute");
    if (!isWithin(data, database) || database === data || isWithin(join(data, "uploads"), database) || isWithin(join(data, "backups"), database)) {
      throw new Error("Production database must be inside DATA_DIR, outside uploads and backups");
    }
  }
}
