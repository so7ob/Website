import { describe, expect, it } from "vitest";
import { dateGroupKeys, groupNotificationsByDate, type DateGroup } from "../grouping";

interface Item {
  id: string;
  createdAt: string;
}

function item(id: string, createdAt: string): Item {
  return { id, createdAt };
}

/** مرجع ثابت: 2026-10-05T14:00:00 توقيت محلي */
const NOW = new Date(2026, 9, 5, 14, 0, 0);

function keys(groups: Array<DateGroup<Item>>): string[] {
  return groups.map((g) => g.key);
}

describe("groupNotificationsByDate", () => {
  it("مصفوفة فارغة → لا أقسام", () => {
    expect(groupNotificationsByDate([], NOW)).toEqual([]);
  });

  it("إشعار اليوم يقع في today", () => {
    const groups = groupNotificationsByDate([item("a", new Date(2026, 9, 5, 9, 30).toISOString())], NOW);
    expect(keys(groups)).toEqual(["today"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
  });

  it("إشعار أمس يقع في yesterday حتى قرب منتصف الليل", () => {
    const groups = groupNotificationsByDate(
      [item("a", new Date(2026, 9, 4, 23, 59).toISOString()), item("b", new Date(2026, 9, 4, 0, 0).toISOString())],
      NOW
    );
    expect(keys(groups)).toEqual(["yesterday"]);
    expect(groups[0].items).toHaveLength(2);
  });

  it("إشعار قبل أمس يقع في older", () => {
    const groups = groupNotificationsByDate([item("a", new Date(2026, 9, 3, 12, 0).toISOString())], NOW);
    expect(keys(groups)).toEqual(["older"]);
  });

  it("الأقسام الثلاثة بترتيبها الثابت: اليوم ثم أمس ثم أقدم", () => {
    const groups = groupNotificationsByDate(
      [
        item("old", new Date(2026, 8, 1, 8, 0).toISOString()),
        item("yest", new Date(2026, 9, 4, 10, 0).toISOString()),
        item("tod", new Date(2026, 9, 5, 8, 0).toISOString()),
      ],
      NOW
    );
    expect(keys(groups)).toEqual(["today", "yesterday", "older"]);
  });

  it("الأقسام الفارغة لا تظهر", () => {
    const groups = groupNotificationsByDate(
      [item("tod", new Date(2026, 9, 5, 8, 0).toISOString()), item("old", new Date(2026, 8, 1, 8, 0).toISOString())],
      NOW
    );
    expect(keys(groups)).toEqual(["today", "older"]);
  });

  it("حدّ اليوم: منتصف الليل نفسه يقع في today", () => {
    const groups = groupNotificationsByDate([item("a", new Date(2026, 9, 5, 0, 0, 0).toISOString())], NOW);
    expect(keys(groups)).toEqual(["today"]);
  });

  it("حدّ أمس: ثانية قبل منتصف الليل الحالي تقع في yesterday", () => {
    const edge = new Date(2026, 9, 4, 23, 59, 59).toISOString();
    const groups = groupNotificationsByDate([item("a", edge)], NOW);
    expect(keys(groups)).toEqual(["yesterday"]);
  });

  it("التاريخ الفاسد يقع في older ولا يُسقط (قراءة دفاعية)", () => {
    const groups = groupNotificationsByDate([item("bad", "not-a-date")], NOW);
    expect(keys(groups)).toEqual(["older"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["bad"]);
  });

  it("يحافظ على ترتيب العناصر داخل القسم كما وردت من الخادم", () => {
    const groups = groupNotificationsByDate(
      [
        item("newer", new Date(2026, 9, 5, 12, 0).toISOString()),
        item("older-today", new Date(2026, 9, 5, 6, 0).toISOString()),
      ],
      NOW
    );
    expect(groups[0].items.map((i) => i.id)).toEqual(["newer", "older-today"]);
  });

  it("الآن الفاسد يعامل كل العناصر كأقدم دون فقدانها", () => {
    const groups = groupNotificationsByDate(
      [item("a", new Date(2026, 9, 5, 8, 0).toISOString())],
      new Date("invalid")
    );
    expect(keys(groups)).toEqual(["older"]);
    expect(groups[0].items).toHaveLength(1);
  });

  it("dateGroupKeys بترتيب ثابت للواجهة", () => {
    expect(dateGroupKeys()).toEqual(["today", "yesterday", "older"]);
  });

  it("أعداد عناصر الأقسام تتوافق مع المدخل (لا فقد ولا تكرار)", () => {
    const input = [
      item("1", new Date(2026, 9, 5, 13, 0).toISOString()),
      item("2", new Date(2026, 9, 5, 1, 0).toISOString()),
      item("3", new Date(2026, 9, 4, 15, 0).toISOString()),
      item("4", new Date(2026, 9, 2, 15, 0).toISOString()),
      item("5", "broken"),
    ];
    const groups = groupNotificationsByDate(input, NOW);
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(5);
  });
});
