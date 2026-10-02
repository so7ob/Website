import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalPath, dataDirectory, sqlitePath, validateProductionPaths } from "../data-paths";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function fixture() { const root = mkdtempSync(join(tmpdir(), "so7ob-paths-")); roots.push(root); return root; }

describe("persistent data configuration", () => {
  it("matches Prisma schema-relative SQLite URLs", () => {
    const root = fixture();
    expect(sqlitePath("file:../db/custom.db", root)).toBe(join(root, "db/custom.db"));
    expect(sqlitePath("file:./custom.db", root)).toBe(join(root, "prisma/custom.db"));
  });
  it("uses the same absolute directory across releases", () => {
    const root = fixture();
    const env = { NODE_ENV: "production", DATA_DIR: join(root, "data"), DATABASE_URL: `file:${root}/data/custom.db` };
    for (const release of ["release-a", "release-b/.next/standalone"]) {
      expect(dataDirectory(env, join(root, release))).toBe(join(root, "data"));
      expect(() => validateProductionPaths(env, join(root, release))).not.toThrow();
    }
  });
  it("rejects missing, relative, release-contained and misplaced production data", () => {
    const root = fixture();
    expect(() => dataDirectory({ NODE_ENV: "production" }, root)).toThrow();
    expect(() => dataDirectory({ DATA_DIR: "db" }, root)).toThrow();
    expect(() => dataDirectory({ NODE_ENV: "production", DATA_DIR: join(root, "db") }, root)).toThrow();
    const env = { NODE_ENV: "production", DATA_DIR: join(root, "data") };
    for (const url of ["file:../db/custom.db", `file:${root}/elsewhere.db`, `file:${root}/data/uploads/custom.db`, `file:${root}/data/backups/custom.db`]) {
      expect(() => validateProductionPaths({ ...env, DATABASE_URL: url }, join(root, "release"))).toThrow();
    }
  });
  it("resolves symlinks before checking the release boundary", () => {
    const root = fixture();
    mkdirSync(join(root, "release"));
    symlinkSync(join(root, "release"), join(root, "linked"));
    expect(canonicalPath(join(root, "linked/new/db"))).toBe(join(root, "release/new/db"));
    expect(() => dataDirectory({ NODE_ENV: "production", DATA_DIR: join(root, "linked/data") }, join(root, "release"))).toThrow();
  });
  it.each([undefined, "postgres://x", "file:", "file::memory:", "file:a?mode=memory"])("rejects unsupported URL %s", url => expect(() => sqlitePath(url)).toThrow());
});
