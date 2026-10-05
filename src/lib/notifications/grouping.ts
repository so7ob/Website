/**
 * تجميع الإشعارات زمنيًا — مكتبة نقية بلا I/O قابلة للاختبار.
 * الأقسام: اليوم / أمس / أقدم — الترتيب داخل كل قسم كما ورد (الأحدث أولًا من الخادم).
 * التواريخ الفاسدة تُدرج في «أقدم» بدل إسقاطها (قراءة دفاعية — لا يفقد المستخدم إشعارًا).
 */

export interface GroupableNotification {
  createdAt: string;
}

export interface DateGroup<T extends GroupableNotification> {
  key: "today" | "yesterday" | "older";
  items: T[];
}

/** بداية اليوم المحلي (منتصف الليل) لتاريخ معين — نسخة دفاعية تعيد null للتاريخ الفاسد */
function startOfLocalDay(date: Date): number | null {
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * يجمّع الإشعارات في ثلاثة أقسام زمنية وفق اليوم المحلي.
 * - تاريخ اليوم → today
 * - تاريخ أمس → yesterday
 * - كل ما قبله أو تاريخ فاسد → older
 * لا يعيد أقسامًا فارغة، ويحافظ على ترتيب العناصر داخل القسم.
 */
export function groupNotificationsByDate<T extends GroupableNotification>(
  items: T[],
  now: Date = new Date()
): Array<DateGroup<T>> {
  const todayStart = startOfLocalDay(now);
  if (todayStart === null) return items.length ? [{ key: "older", items: [...items] }] : [];
  const yesterdayStart = todayStart - 86_400_000;

  const buckets: Record<DateGroup<T>["key"], T[]> = { today: [], yesterday: [], older: [] };
  for (const item of items) {
    const start = startOfLocalDay(new Date(item.createdAt));
    if (start !== null && start >= todayStart) buckets.today.push(item);
    else if (start !== null && start >= yesterdayStart) buckets.yesterday.push(item);
    else buckets.older.push(item);
  }

  const groups: Array<DateGroup<T>> = [];
  if (buckets.today.length) groups.push({ key: "today", items: buckets.today });
  if (buckets.yesterday.length) groups.push({ key: "yesterday", items: buckets.yesterday });
  if (buckets.older.length) groups.push({ key: "older", items: buckets.older });
  return groups;
}

/**
 * مفاتيح الأقسام بترتيبها الثابت — يفيد الواجهة والاختبار.
 */
export function dateGroupKeys(): Array<DateGroup<never>["key"]> {
  return ["today", "yesterday", "older"];
}
