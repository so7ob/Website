import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBackup, restoreBackup, verifyBackup } from "../lib/backup";

const roots: string[] = [];
const databases: Database[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "so7ob-backup-")); roots.push(root);
  const data = join(root, "data"); mkdirSync(join(data, "uploads"), { recursive: true });
  const database = join(data, "custom.db");
  const db = new Database(database); databases.push(db);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE Attachment (id TEXT PRIMARY KEY, storedName TEXT); INSERT INTO Attachment VALUES ('synthetic', 'sample.txt');");
  writeFileSync(join(data, "uploads/sample.txt"), "synthetic attachment");
  return { root, data, database, db, target: join(root, "snapshot"), env: { NODE_ENV: "production", DATA_DIR: data, DATABASE_URL: `file:${database}`, BACKUP_WRITES_PAUSED: "true" } };
}

describe("database and upload snapshots", () => {
  test("captures uncheckpointed WAL and restores exact files and rows", () => {
    const f = fixture();
    expect(existsSync(f.database + "-wal")).toBe(true);
    createBackup(f.target, f.env, join(f.root, "release"));
    expect(verifyBackup(f.target).tables.Attachment).toBe(1);
    const restored = join(f.root, "restore"); restoreBackup(f.target, restored);
    const db = new Database(join(restored, "database.db"), { readonly: true }); databases.push(db);
    expect(db.query("SELECT id FROM Attachment").get()).toEqual({ id: "synthetic" });
    expect(readFileSync(join(restored, "uploads/sample.txt"), "utf8")).toBe("synthetic attachment");
    expect(() => restoreBackup(f.target, restored)).toThrow();
  });
  test("rejects copying without paused writers and missing source database", () => {
    const f = fixture();
    expect(() => createBackup(f.target, { ...f.env, BACKUP_WRITES_PAUSED: "false" }, join(f.root, "release"))).toThrow();
    expect(() => createBackup(f.target, { ...f.env, DATABASE_URL: `file:${f.data}/missing.db` }, join(f.root, "release"))).toThrow();
    expect(existsSync(f.target)).toBe(false);
  });
  test("rejects missing uploads, corruption and symlink files", () => {
    const f = fixture();
    rmSync(join(f.data, "uploads/sample.txt"));
    expect(() => createBackup(f.target, f.env, join(f.root, "release"))).toThrow();
    expect(existsSync(f.target)).toBe(false);
    writeFileSync(join(f.data, "uploads/sample.txt"), "synthetic");
    createBackup(f.target, f.env, join(f.root, "release"));
    writeFileSync(join(f.target, "uploads/sample.txt"), "corrupt");
    expect(() => restoreBackup(f.target, join(f.root, "restored"))).toThrow();
    expect(existsSync(join(f.root, "restored"))).toBe(false);
    rmSync(join(f.target, "uploads/sample.txt"));
    symlinkSync(join(f.data, "uploads/sample.txt"), join(f.target, "uploads/sample.txt"));
    expect(() => verifyBackup(f.target)).toThrow();
  });
  test("refuses a destination on a read-only filesystem without touching source", () => {
    const f = fixture();
    expect(() => createBackup("/sys/so7ob-synthetic-backup", f.env, join(f.root, "release"))).toThrow();
    expect(f.db.query("SELECT count(*) AS n FROM Attachment").get()).toEqual({ n: 1 });
  });
  test("handles the legacy schema-relative development URL", () => {
    const f = fixture();
    createBackup(f.target, { NODE_ENV: "test", DATA_DIR: f.data, DATABASE_URL: "file:../data/custom.db", BACKUP_WRITES_PAUSED: "true" }, f.root);
    expect(verifyBackup(f.target).tables.Attachment).toBe(1);
  });
});
