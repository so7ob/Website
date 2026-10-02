"use client";

/**
 * التحرير النصي المباشر داخل لوحة الرسم (inline text editing):
 *
 * - InlineEditSessionContext: مستوى اللوحة — أي عقدة في جلسة تحرير وماذا يحدث
 *   عند التغيير/الإنهاء. يوفره المحرر حول PageRenderer لكل ورقية.
 * - InlineEditNodeContext: مستوى العقدة — قيمته غير null فقط حين تكون العقدة
 *   موضوع الجلسة، فيتحول نصها إلى contentEditable عبر EditableText.
 *
 * EditableText:
 * - خارج الجلسة يرسم النص عاديًا (لا فرق عن العرض الحي).
 * - داخل الجلسة: contentEditable يملك النص عبر المرجع (لا أبناء React) حتى لا
 *   يقفز المؤشر عند إعادة الرسم أثناء الكتابة؛ الإدخال يبث القيمة حية والمسودة
 *   تُحفظ تلقائيًا عبر آلية الحالة القائمة.
 * - Enter ينهي الحقل (التزام)، Esc يرجع قيمة بدء الجلسة ويختم، اللصق يُنزع
 *   تنسيقه إلى نص صرف، والحد الأقصى مطابق لمخطط الحفظ.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";

export interface InlineEditSession {
  nodeId: string;
  /** تغيير حي أثناء الكتابة — القيمة تُطبَّق على props المسودة */
  onChange: (field: string, value: string) => void;
  /** إنهاء الجلسة كاملة (بعد الالتزام أو الإلغاء) */
  onEnd: () => void;
}

export const InlineEditSessionContext = createContext<InlineEditSession | null>(null);

export interface NodeInlineEdit {
  onChange: (field: string, value: string) => void;
  onEnd: () => void;
}

export const InlineEditNodeContext = createContext<NodeInlineEdit | null>(null);

interface EditableTextProps {
  /** معرف الحقل — "text" أو "paragraphs:0" مثلًا */
  field: string;
  value: string;
  as?: "h2" | "h3" | "h4" | "p" | "span";
  className?: string;
  /** الحقل الأساسي — يتلقى التركيز تلقائيًا عند بدء الجلسة */
  primary?: boolean;
  placeholder?: string;
}

export function EditableText({
  field,
  value,
  as = "p",
  className,
  primary = false,
  placeholder = "…",
}: EditableTextProps) {
  const edit = useContext(InlineEditNodeContext);
  const Tag = as;
  const editing = edit !== null;
  const ref = useRef<HTMLElement | null>(null);
  // قيمة بدء الجلسة — مرجع Esc للإرجاع
  const originalRef = useRef(value);

  useEffect(() => {
    if (!edit) return;
    // عند بدء الجلسة: اعمل نسخة القيمة الحالية وركّز الحقل الأساسي بمؤشر في النهاية
    originalRef.current = value;
    if (primary && ref.current) {
      const el = ref.current;
      // React يزيل الأبناء عند التحول لفرع contentEditable — ملء النص هنا أولًا
      if (el.textContent !== value) el.textContent = value;
      el.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false); // نهاية النص
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    // القيمة عند بدء الجلسة فقط — تغييرات الكتابة اللاحقة لا تعيد التركيز
    // (الاعتماد على هوية edit ثابتة عبر الجلسة)
  }, [edit]);

  useEffect(() => {
    if (edit && ref.current && ref.current.textContent !== value) {
      // مزامنة من الخارج (تراجع أثناء الجلسة مثلًا) — بلا مساس بموضع المؤشر
      // إن كان العنصر غير مركز عليه
      if (document.activeElement !== ref.current) {
        ref.current.textContent = value;
      }
    }
  });

  /**
   * مرجع فرع التحرير: يملأ النص عند التركيب (لا أبناء React حتى لا يقفز
   * المؤشر عند إعادة الرسم أثناء الكتابة — القيمة الحية تُدار في DOM).
   */
  const editableRef = (el: HTMLElement | null) => {
    ref.current = el;
    if (el && editing && el.textContent !== value) el.textContent = value;
  };

  if (!editing) {
    return <Tag className={className}>{value}</Tag>;
  }

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    edit.onChange(field, el.textContent ?? "");
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      // التزام الحقل والخروج منه — الجلسة تبقى للحقول الأخرى حتى مغادرة العقدة
      e.preventDefault();
      ref.current?.blur();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      const el = ref.current;
      if (el) el.textContent = originalRef.current;
      edit.onChange(field, originalRef.current);
      edit.onEnd();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    // إدراج نص صرف بلا أي HTML من الحافظة
    document.execCommand("insertText", false, text.replace(/[\r\n]+/g, " "));
  };

  return (
    <Tag
      ref={editableRef as never}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-editable-field={field}
      data-placeholder={placeholder}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onBlur={handleInput}
      onPaste={handlePaste}
      className={cn(
        className,
        "cursor-text rounded-md px-1 -mx-1 outline-none ring-2 ring-brand/60 bg-brand/[0.04] caret-brand",
        "transition-colors focus-visible:ring-brand",
        "empty:before:content-[attr(data-placeholder)] empty:before:italic empty:before:text-muted-foreground/50"
      )}
    />
  );
}
