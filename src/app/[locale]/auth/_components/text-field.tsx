"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** حقل نصي لصفحات المصادقة — تسمية + إدخال + خطأ مضمّن */
export function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
  dir,
  required = true,
  disabled = false,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete?: string;
  dir?: "ltr" | "rtl";
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold text-navy">
        {label}
        {required && <span className="ms-0.5 text-rose-600" aria-hidden="true">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        dir={dir}
        disabled={disabled}
        maxLength={maxLength}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "min-h-11 focus-visible:ring-2 focus-visible:ring-ring/40",
          dir === "ltr" && "text-start ltr-isolate",
          error && "border-rose-400 focus-visible:ring-rose-300"
        )}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs leading-6 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium leading-6 text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
