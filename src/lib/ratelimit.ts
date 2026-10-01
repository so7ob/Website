/**
 * منع الإرسال المتكرر والرسائل المزعجة — منطق خالص قابل للاختبار.
 *
 * التنفيذ: ذاكرة داخلية بمسح زمني (sliding window) مناسبة لمثيل واحد.
 * القيد الموثق: عند التوسع لعدة مثيلات استبدل المخزن بمخزن مشترك (Redis مثلًا).
 */

import { createHash } from "crypto";

export interface RateLimitEntry {
  timestamps: number[];
}

/** مخزن قابل للحقن لأغراض الاختبار */
export interface SlidingStore {
  get(key: string): RateLimitEntry | undefined;
  set(key: string, entry: RateLimitEntry): void;
}

export function memoryStore(): SlidingStore {
  const map = new Map<string, RateLimitEntry>();
  return {
    get: (k) => map.get(k),
    set: (k, v) => map.set(k, v),
  };
}

export interface RateLimitResult {
  allowed: boolean;
  /** الثواني حتى إتاحة المحاولة التالية عند المنع */
  retryAfterSec: number;
}

/** يقرر السماح بناءً على نافذتين: قصيرة (دقيقة/رسالة) ويومية */
export function checkRateLimit(
  store: SlidingStore,
  key: string,
  now: number,
  limits: { shortMax: number; shortWindowMs: number; dailyMax: number; dailyWindowMs: number } = {
    shortMax: 3,
    shortWindowMs: 10 * 60 * 1000,
    dailyMax: 8,
    dailyWindowMs: 24 * 60 * 60 * 1000,
  }
): RateLimitResult {
  const entry = store.get(key) ?? { timestamps: [] };
  const fresh = entry.timestamps.filter((t) => now - t < limits.dailyWindowMs);
  const short = fresh.filter((t) => now - t < limits.shortWindowMs);

  if (short.length >= limits.shortMax) {
    const oldestShort = Math.min(...short);
    return { allowed: false, retryAfterSec: Math.ceil((oldestShort + limits.shortWindowMs - now) / 1000) };
  }
  if (fresh.length >= limits.dailyMax) {
    const oldest = Math.min(...fresh);
    return { allowed: false, retryAfterSec: Math.ceil((oldest + limits.dailyWindowMs - now) / 1000) };
  }

  fresh.push(now);
  store.set(key, { timestamps: fresh });
  return { allowed: true, retryAfterSec: 0 };
}

/** بصمة ثابتة لنص — تُستخدم لكشف التكرار دون تخزين النص نفسه مرتين */
export function fingerprint(text: string): string {
  return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

export interface DuplicateRecord {
  email: string;
  descriptionHash: string;
  createdAt: number;
}

/** يكشف تكرار نفس البريد + نفس الوصف خلال النافذة الزمنية */
export function isDuplicate(
  recent: DuplicateRecord[],
  email: string,
  descriptionHash: string,
  now: number,
  windowMs = 30 * 60 * 1000
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return recent.some(
    (r) =>
      r.email.trim().toLowerCase() === normalizedEmail &&
      r.descriptionHash === descriptionHash &&
      now - r.createdAt < windowMs
  );
}
