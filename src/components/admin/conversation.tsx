"use client";

/**
 * عناصر المحادثة المشتركة بين الطلبات والاستفسارات:
 * فقاعة رسالة (عميل/طاقم/ملاحظة داخلية/نظامية) + ملحن الرد بتبويبين.
 */
import { useRef, useState } from "react";
import { Lock, Paperclip, Send, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n";
import { fmtDateTime } from "./helpers";
import type { MessageRow } from "./types";
import { cn } from "@/lib/utils";

export interface MessageLabels {
  client: string;
  staff: string;
  system: string;
  internalHint: string;
  statuses: Record<string, string>;
}

/** هل كاتب الرسالة من الطاقم؟ */
function isStaffMessage(message: Pick<MessageRow, "authorType" | "author">): boolean {
  if (message.authorType === "staff") return true;
  if (message.authorType === "system") return false;
  const role = message.author?.roleKey;
  return Boolean(role && role !== "client");
}

/** فقاعة رسالة واحدة في المحادثة */
export function MessageBubble({
  message,
  locale,
  labels,
}: {
  message: MessageRow;
  locale: Locale;
  labels: MessageLabels;
}) {
  // رسائل النظام: شريحة وسطى بحالة جديدة
  if (message.kind === "system") {
    const [, status, ...rest] = message.body.split(":");
    const note = rest.join(":").trim();
    const statusLabel = status && labels.statuses[status] ? `${labels.statuses[status]}${note ? ` — ${note}` : ""}` : message.body;
    return (
      <div className="my-2 flex justify-center">
        <span className="max-w-lg rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
          {statusLabel}
        </span>
      </div>
    );
  }

  const staff = isStaffMessage(message);
  const author = message.author?.name ?? (staff ? labels.staff : labels.client);
  const authorRole = staff ? labels.staff : labels.client;

  // ملاحظة داخلية: بطاقة كهرمانية بعرض كامل مع قفل
  if (message.kind === "internal_note") {
    return (
      <div className="flex flex-col gap-1 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
          <Lock className="size-3" aria-hidden="true" />
          <span className="truncate">{labels.internalHint}</span>
          <span className="text-amber-600/70">· {author}</span>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-amber-900">{message.body}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">{fmtDateTime(message.createdAt, locale)}</p>
      </div>
    );
  }

  // رسالة عادية: عميل يبدأ/طاقم ينتهي (ينعكس مع الاتجاه تلقائيًا)
  return (
    <div className={cn("flex flex-col gap-1 py-1.5", staff ? "items-end" : "items-start")}>
      <p className="px-1 text-[11px] font-medium text-muted-foreground">
        {author} · {authorRole}
      </p>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-3 sm:max-w-[75%]",
          staff ? "border-navy/10 bg-navy/[0.05]" : "border-border bg-white"
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{message.body}</p>
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">{fmtDateTime(message.createdAt, locale)}</p>
    </div>
  );
}

export interface ComposerLabels {
  reply: string;
  internalNote: string;
  internalHint: string;
  placeholder: string;
  send: string;
  sending: string;
  attachFile?: string;
}

interface ReplyComposerProps {
  canReply: boolean;
  canNote: boolean;
  sending: boolean;
  labels: ComposerLabels;
  onSend: (kind: "message" | "internal_note", body: string) => Promise<void>;
  onAttach?: (file: File) => Promise<void>;
}

/** ملحن الرد: تبويب رد على العميل / ملاحظة داخلية + إرفاق + إرسال */
export function ReplyComposer({ canReply, canNote, sending, labels, onSend, onAttach }: ReplyComposerProps) {
  const [tab, setTab] = useState<"message" | "internal_note">(canReply ? "message" : "internal_note");
  const [body, setBody] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [attaching, setAttaching] = useState(false);

  if (!canReply && !canNote) return null;
  const currentTab: "message" | "internal_note" = canReply ? tab : "internal_note";

  const submit = async () => {
    const text = body.trim();
    if (!text || sending) return;
    await onSend(currentTab, text);
    setBody("");
  };

  const pickFile = async (file: File | undefined) => {
    if (!file || !onAttach) return;
    setAttaching(true);
    try {
      await onAttach(file);
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <Tabs value={currentTab} onValueChange={(v) => setTab(v as "message" | "internal_note")}>
        <TabsList className="flex-wrap">
          {canReply ? (
            <TabsTrigger value="message" className="gap-1.5">
              <MessageSquareText className="size-3.5" aria-hidden="true" />
              {labels.reply}
            </TabsTrigger>
          ) : null}
          {canNote ? (
            <TabsTrigger value="internal_note" className="gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              {labels.internalNote}
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>

      {currentTab === "internal_note" ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
          <Lock className="size-3" aria-hidden="true" />
          {labels.internalHint}
        </p>
      ) : null}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={labels.placeholder}
        rows={4}
        maxLength={8000}
        className="mt-3 min-h-24 resize-y"
        aria-label={currentTab === "internal_note" ? labels.internalNote : labels.reply}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onAttach ? (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => void pickFile(e.target.files?.[0])}
              accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip,.rar"
            />
            <Button
              type="button"
              variant="outline"
              disabled={attaching || sending}
              onClick={() => fileRef.current?.click()}
              className="min-h-11 rounded-full"
            >
              {attaching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Paperclip className="size-4" aria-hidden="true" />
              )}
              {labels.attachFile}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={sending || body.trim().length === 0}
          className="ms-auto min-h-11 rounded-full px-6"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          {sending ? labels.sending : labels.send}
        </Button>
      </div>
    </div>
  );
}
