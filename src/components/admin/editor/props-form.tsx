"use client";

/**
 * نموذج الخصائص العام — يرسم قائمة FieldDef (سجل prop-fields) على كائن props:
 * نصوص، أرقام، تعدادات، مفاتيح، حقول وسائط، قوائم نصوص، مصفوفات كائنات
 * قابلة للإضافة/الحذف/الترتيب، مجموعات مضمنة، وصفوف جدول.
 * كل تغيير يبني كائن props جديدًا كاملًا (تحديث غير قابل للتغيير) ويرفعه للأعلى.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getPortalContent } from "@/content/portal";
import { ar as siteAr } from "@/content/ar";
import { en as siteEn } from "@/content/en";
import type { Locale } from "@/lib/i18n";
import type { Me } from "@/components/admin/types";
import { bi } from "./types";
import { MediaField, MediaPicker } from "./media-picker";
import type { FieldDef } from "./prop-fields";
import { cn } from "@/lib/utils";

interface PropFieldsFormProps {
  fields: FieldDef[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  locale: Locale; // لغة واجهة المحرر
  me: Me;
}

// ——— قراءة قيم غير معروفة بأمان ———

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asBool = (v: unknown): boolean => v === true;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** عنصر جديد افتراضي لمصفوفة وفق حقولها */
function defaultItemValue(fields: FieldDef[]): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const f of fields) {
    switch (f.type) {
      case "text":
      case "textarea":
      case "media":
        item[f.key] = "";
        break;
      case "number":
        item[f.key] = 1;
        break;
      case "select":
        item[f.key] = f.options?.[0]?.value ?? "";
        break;
      case "switch":
        item[f.key] = false;
        break;
      case "stringlist":
      case "rows":
      case "array":
        item[f.key] = [];
        break;
      case "group":
        item[f.key] = defaultItemValue(f.itemFields ?? []);
        break;
    }
  }
  return item;
}

export function PropFieldsForm({ fields, value, onChange, locale, me }: PropFieldsFormProps) {
  const t = getPortalContent(locale).admin.editor;

  const setKey = (key: string, next: unknown) => {
    const clone = { ...value };
    if (next === undefined) delete clone[key];
    else clone[key] = next;
    onChange(clone);
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <FieldRow
          key={field.key}
          field={field}
          raw={value[field.key]}
          onSet={(next) => setKey(field.key, next)}
          locale={locale}
          me={me}
          te={t}
        />
      ))}
    </div>
  );
}

interface FieldRowProps {
  field: FieldDef;
  raw: unknown;
  onSet: (next: unknown) => void;
  locale: Locale;
  me: Me;
  te: ReturnType<typeof getPortalContent>["admin"]["editor"];
}

function FieldRow({ field, raw, onSet, locale, me, te }: FieldRowProps) {
  const label = bi(field.label, locale);
  const optionalLabel = locale === "en" ? siteEn.form.optional : siteAr.form.optional;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`pf-${field.key}`} className="text-xs font-semibold text-navy">
        {label}
        {field.optional && <span className="ms-1 font-normal text-muted-foreground">({optionalLabel})</span>}
      </Label>
      <FieldControl field={field} raw={raw} onSet={onSet} locale={locale} me={me} te={te} />
    </div>
  );
}

function FieldControl({ field, raw, onSet, locale, me, te }: FieldRowProps) {
  switch (field.type) {
    case "text":
      return (
        <Input
          id={`pf-${field.key}`}
          value={asString(raw)}
          onChange={(e) => onSet(e.target.value)}
          placeholder={field.placeholder}
          className="min-h-9"
        />
      );
    case "textarea":
      return (
        <Textarea
          id={`pf-${field.key}`}
          value={asString(raw)}
          onChange={(e) => onSet(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className="min-h-9 text-sm"
        />
      );
    case "number":
      return <NumberInput raw={raw} onSet={onSet} id={`pf-${field.key}`} />;
    case "select":
      return <SelectField field={field} raw={raw} onSet={onSet} locale={locale} />;
    case "switch":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Switch id={`pf-${field.key}`} checked={asBool(raw)} onCheckedChange={(v) => onSet(v)} />
        </div>
      );
    case "media":
      return <MediaInput raw={asString(raw)} onSet={onSet} locale={locale} me={me} id={`pf-${field.key}`} />;
    case "stringlist":
      return <StringListField raw={asArray(raw)} onSet={onSet} te={te} locale={locale} />;
    case "array":
      return <ArrayField field={field} raw={asArray(raw)} onSet={onSet} locale={locale} me={me} te={te} />;
    case "group":
      return <GroupField field={field} raw={asRecord(raw)} onSet={onSet} locale={locale} me={me} te={te} />;
    case "rows":
      return <RowsField label={bi(field.label, locale)} raw={asArray(raw)} onSet={onSet} te={te} locale={locale} />;
  }
}

// ——— رقم صحيح ———

function NumberInput({ raw, onSet, id }: { raw: unknown; onSet: (v: unknown) => void; id: string }) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      value={typeof raw === "number" ? raw : ""}
      onChange={(e) => {
        const v = e.target.value;
        onSet(v === "" ? undefined : Math.trunc(Number(v)));
      }}
      className="min-h-9"
    />
  );
}

// ——— اختيار ———

function SelectField({ field, raw, onSet, locale }: { field: FieldDef; raw: unknown; onSet: (v: unknown) => void; locale: Locale }) {
  const rawValue = field.numeric ? String(raw ?? "") : asString(raw);
  const current = rawValue || (field.optional ? "" : field.options?.[0]?.value ?? "");
  return (
    <Select value={current || "__empty__"} onValueChange={(v) => onSet(v === "__empty__" ? undefined : field.numeric ? Number(v) : v)}>
      <SelectTrigger id={`pf-${field.key}`} className="min-h-9 w-full">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {field.optional && (
          <SelectItem value="__empty__">
            <span className="text-muted-foreground">— {bi({ ar: "بدون", en: "none" }, locale)} —</span>
          </SelectItem>
        )}
        {(field.options ?? []).map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {bi(opt.label, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ——— حقل وسائط ———

function MediaInput({ raw, onSet, locale, me, id }: { raw: string; onSet: (v: unknown) => void; locale: Locale; me: Me; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MediaField
        id={id}
        value={raw}
        onChange={(v) => onSet(v)}
        onOpenPicker={() => setOpen(true)}
        locale={locale}
      />
      <MediaPicker open={open} onOpenChange={setOpen} me={me} locale={locale} onSelect={(url) => onSet(url)} />
    </>
  );
}

// ——— قائمة نصوص ———

function StringListField({ raw, onSet, te, locale }: { raw: unknown[]; onSet: (v: unknown) => void; te: FieldRowProps["te"]; locale: Locale }) {
  const items = raw.map(asString);
  const update = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onSet(next);
  };
  const add = () => onSet([...items, ""]);
  const remove = (index: number) => onSet(items.filter((_, i) => i !== index));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onSet(next);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <Textarea
            value={item}
            onChange={(e) => update(i, e.target.value)}
            rows={2}
            className="min-h-9 flex-1 text-sm"
            dir="auto"
            aria-label={`${te.items} ${i + 1}`}
          />
          <div className="flex flex-col gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={te.moveUp}>
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={te.moveDown}>
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => remove(i)} aria-label={te.removeItem}>
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="min-h-8 w-full text-xs" onClick={add}>
        <Plus className="size-3.5" aria-hidden="true" />
        {te.addItem}
      </Button>
    </div>
  );
}

// ——— مصفوفة كائنات ———

function ArrayField({ field, raw, onSet, locale, me, te }: { field: FieldDef; raw: unknown[]; onSet: (v: unknown) => void; locale: Locale; me: Me; te: FieldRowProps["te"] }) {
  const items = raw.map(asRecord);
  const itemFields = field.itemFields ?? [];
  const label = bi(field.label, locale);

  const updateItem = (index: number, next: Record<string, unknown>) => {
    const clone = [...items];
    clone[index] = next;
    onSet(clone);
  };
  const addItem = () => onSet([...items, defaultItemValue(itemFields)]);
  const removeItem = (index: number) => onSet(items.filter((_, i) => i !== index));
  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onSet(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-navy">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {label} {i + 1}
            </p>
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label={te.moveUp}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} aria-label={te.moveDown}>
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeItem(i)} aria-label={te.removeItem}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <PropFieldsForm fields={itemFields} value={item} onChange={(next) => updateItem(i, next)} locale={locale} me={me} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="min-h-8 w-full text-xs" onClick={addItem}>
        <Plus className="size-3.5" aria-hidden="true" />
        {te.addItem}
      </Button>
    </div>
  );
}

// ——— مجموعة مضمنة ———

function GroupField({ field, raw, onSet, locale, me, te }: { field: FieldDef; raw: Record<string, unknown>; onSet: (v: unknown) => void; locale: Locale; me: Me; te: FieldRowProps["te"] }) {
  const label = bi(field.label, locale);
  const empty = Object.keys(raw).length === 0;
  return (
    <div className={cn("rounded-xl border p-3", empty ? "border-dashed border-border" : "border-border bg-muted/20")}>
      <p className="mb-2 text-xs font-semibold text-navy">{label}</p>
      {empty && field.optional && (
        <Button type="button" variant="outline" size="sm" className="min-h-8 w-full text-xs" onClick={() => onSet(defaultItemValue(field.itemFields ?? []))}>
          <Plus className="size-3.5" aria-hidden="true" />
          {te.addItem}
        </Button>
      )}
      {!empty && (
        <PropFieldsForm fields={field.itemFields ?? []} value={raw} onChange={(next) => onSet(next)} locale={locale} me={me} />
      )}
    </div>
  );
}

// ——— صفوف جدول (مصفوفة مصفوفات نصوص) ———

function RowsField({ label, raw, onSet, te, locale }: { label: string; raw: unknown[]; onSet: (v: unknown) => void; te: FieldRowProps["te"]; locale: Locale }) {
  const rows = raw.map((r) => asArray(r).map(asString));

  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    const next = rows.map((r) => [...r]);
    next[rowIndex][cellIndex] = value;
    onSet(next);
  };
  const addRow = () => onSet([...rows, [""]]);
  const removeRow = (index: number) => onSet(rows.filter((_, i) => i !== index));
  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onSet(next);
  };
  const addCell = (rowIndex: number) => {
    const next = rows.map((r) => [...r]);
    next[rowIndex].push("");
    onSet(next);
  };
  const removeCell = (rowIndex: number, cellIndex: number) => {
    const next = rows.map((r) => [...r]);
    if (next[rowIndex].length <= 1) return;
    next[rowIndex].splice(cellIndex, 1);
    onSet(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-navy">{label}</p>
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-border bg-muted/30 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {label} {i + 1}
            </p>
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label={te.moveUp}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} aria-label={te.moveDown}>
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeRow(i)} aria-label={te.removeItem}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            {row.map((cell, c) => (
              <div key={c} className="flex items-center gap-1.5">
                <Input
                  value={cell}
                  onChange={(e) => updateCell(i, c, e.target.value)}
                  className="min-h-8 flex-1 text-sm"
                  dir="auto"
                  aria-label={`${label} ${i + 1} — ${c + 1}`}
                />
                <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeCell(i, c)} aria-label={te.removeItem}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="min-h-7 w-full text-xs text-muted-foreground" onClick={() => addCell(i)}>
              <Plus className="size-3" aria-hidden="true" />
              {te.addItem}
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="min-h-8 w-full text-xs" onClick={addRow}>
        <Plus className="size-3.5" aria-hidden="true" />
        {te.addItem}
      </Button>
    </div>
  );
}
