import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync, chmodSync, openSync, readSync, closeSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { dataDirectory, isWithin, sqlitePath, validateProductionPaths } from "../../src/lib/data-paths";

type Entry = { name: string; size: number; sha256: string };
type Manifest = { version: 1; createdAt: string; database: Entry; uploads: Entry[]; tables: Record<string, number> };
const safeName = (name: string) => Boolean(name) && basename(name) === name && !/[\\\0]/.test(name) && name !== "." && name !== "..";

function entry(path: string, name: string): Entry {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Snapshot contains a non-regular file");
  const hash = createHash("sha256");
  const descriptor = openSync(path, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let count: number;
    while ((count = readSync(descriptor, buffer)) > 0) hash.update(buffer.subarray(0, count));
  } finally { closeSync(descriptor); }
  return { name, size: stat.size, sha256: hash.digest("hex") };
}

function inspect(path: string): { tables: Record<string, number>; references: string[] } {
  const db = new Database(path, { readonly: true });
  try {
    const integrity = db.query("PRAGMA integrity_check").all() as { integrity_check: string }[];
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" || db.query("PRAGMA foreign_key_check").all().length) throw new Error("Database integrity validation failed");
    const names = (db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(row => row.name);
    const tables: Record<string, number> = Object.create(null);
    for (const name of names) {
      tables[name] = (db.query(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`).get() as { n: number }).n;
    }
    const references = ["Attachment", "MediaItem"].filter(name => names.includes(name)).flatMap(name =>
      (db.query(`SELECT storedName FROM "${name}"`).all() as { storedName: string }[]).map(row => row.storedName));
    return { tables, references };
  } finally { db.close(); }
}

/** Writers must be stopped: SQLite snapshot consistency alone cannot freeze filesystem changes. */
export function createBackup(target: string, env: Readonly<Record<string, string | undefined>> = process.env, root = process.cwd()): string {
  if (env.BACKUP_WRITES_PAUSED !== "true") throw new Error("Stop every writer and set BACKUP_WRITES_PAUSED=true");
  validateProductionPaths(env, root);
  const data = dataDirectory(env, root);
  const source = sqlitePath(env.DATABASE_URL, root);
  if (!existsSync(source)) throw new Error("Source database does not exist");
  if (!isAbsolute(target) || existsSync(target) || isWithin(join(data, "uploads"), target)) throw new Error("Backup destination must be new, absolute and outside uploads");
  const temporary = `${target}.partial-${randomUUID()}`;
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  mkdirSync(temporary, { mode: 0o700 });
  try {
    const snapshot = join(temporary, "database.db");
    const live = new Database(source, { readonly: true });
    try { live.query("VACUUM INTO ?").run(snapshot); } finally { live.close(); }
    chmodSync(snapshot, 0o600);
    const checked = inspect(snapshot);
    const uploadsPath = join(data, "uploads");
    mkdirSync(join(temporary, "uploads"), { mode: 0o700 });
    const files = existsSync(uploadsPath) ? readdirSync(uploadsPath).sort() : [];
    const uploads = files.map(name => {
      if (!safeName(name)) throw new Error("Invalid storage filename");
      const before = entry(join(uploadsPath, name), name);
      const destination = join(temporary, "uploads", name);
      copyFileSync(join(uploadsPath, name), destination);
      chmodSync(destination, 0o600);
      const after = entry(destination, name);
      if (before.sha256 !== after.sha256 || before.size !== after.size) throw new Error("Upload changed while copying; stop writers");
      return after;
    });
    if (checked.references.some(name => !uploads.some(file => file.name === name))) throw new Error("Database references a missing upload");
    const manifest: Manifest = { version: 1, createdAt: new Date().toISOString(), database: entry(snapshot, "database.db"), uploads, tables: checked.tables };
    writeFileSync(join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
    verifyBackup(temporary);
    renameSync(temporary, target);
    return target;
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
}

export function verifyBackup(directory: string): Manifest {
  if (lstatSync(directory).isSymbolicLink() || lstatSync(join(directory, "uploads")).isSymbolicLink()) throw new Error("Snapshot directories must not be symlinks");
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")) as Manifest;
  if (manifest.version !== 1 || manifest.database?.name !== "database.db" || !Array.isArray(manifest.uploads)) throw new Error("Invalid snapshot manifest");
  const names = new Set<string>();
  for (const item of [manifest.database, ...manifest.uploads]) {
    if (typeof item.name !== "string" || !safeName(item.name) || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256) || !Number.isSafeInteger(item.size) || item.size < 0) throw new Error("Invalid snapshot entry");
    const key = item === manifest.database ? item.name : `uploads/${item.name}`;
    if (names.has(key)) throw new Error("Duplicate snapshot entry");
    names.add(key);
    const actual = entry(join(directory, key), item.name);
    if (actual.sha256 !== item.sha256 || actual.size !== item.size) throw new Error("Snapshot checksum mismatch");
  }
  if (readdirSync(join(directory, "uploads")).length !== manifest.uploads.length) throw new Error("Unlisted snapshot upload");
  const checked = inspect(join(directory, "database.db"));
  if (JSON.stringify(checked.tables) !== JSON.stringify(manifest.tables)) throw new Error("Snapshot table counts mismatch");
  if (checked.references.some(name => !manifest.uploads.some(file => file.name === name))) throw new Error("Missing referenced upload");
  return manifest;
}

/** A restore never overwrites a directory or starts the application. */
export function restoreBackup(source: string, target: string): void {
  if (!isAbsolute(target) || existsSync(target) || isWithin(source, target)) throw new Error("Restore target must be new, absolute and outside the backup");
  const manifest = verifyBackup(source);
  const temporary = `${target}.partial-${randomUUID()}`;
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  mkdirSync(temporary, { mode: 0o700 });
  try {
    mkdirSync(join(temporary, "uploads"), { mode: 0o700 });
    for (const file of ["database.db", ...manifest.uploads.map(item => `uploads/${item.name}`)]) {
      copyFileSync(join(source, file), join(temporary, file));
      chmodSync(join(temporary, file), 0o600);
    }
    copyFileSync(join(source, "manifest.json"), join(temporary, "manifest.json"));
    chmodSync(join(temporary, "manifest.json"), 0o600);
    verifyBackup(temporary);
    renameSync(temporary, target);
  } catch (error) { rmSync(temporary, { recursive: true, force: true }); throw error; }
}
