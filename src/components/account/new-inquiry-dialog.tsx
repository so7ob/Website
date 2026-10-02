"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Locale } from "@/lib/i18n";
import type { PortalContent } from "@/content/portal/types";
import { createInquiry } from "./api";

/** تصنيفات الاستفسار الخمسة — القيم مفاتيح خام بلا قيمة فارغة (شرط Radix Select) */
const CATEGORY_KEYS = ["general", "services", "pricing", "support", "other"] as const;

/**
 * حوار «استفسار جديد» — نموذج قصير (موضوع/تصنيف/سؤال) يتحول عند النجاح
 * إلى بطاقة تأكيد بالرقم المرجعي وزر متابعة المحادثة.
 */
export function NewInquiryDialog({
  locale,
  t,
  authErrors,
  open,
  onOpenChange,
}: {
  locale: Locale;
  t: PortalContent["account"]["inquiries"];
  authErrors: PortalContent["auth"]["errors"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{ ref: string; id?: string } | null>(null);

  // تحقق مطابق للواجهة الخادمية — الموضوع ≥ ٣ والرسالة ≥ ١٠ محارف
  const subjectValid = subject.trim().length >= 3;
  const messageValid = message.trim().length >= 10;
  const canSubmit = subjectValid && messageValid && !sending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      // إعادة الحوار إلى حالة النموذج للفتحة القادمة
      setSubject("");
      setCategory("general");
      setMessage("");
      setSending(false);
      setCreated(null);
    }
    onOpenChange(next);
  }

  function openConversation() {
    if (created?.id) router.push(`/${locale}/account/inquiries/${created.id}`);
    else router.push(`/${locale}/account/inquiries`);
  }

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canSubmit) {
      toast.error(authErrors.required);
      return;
    }
    setSending(true);
    const result = await createInquiry({
      subject: subject.trim(),
      message: message.trim(),
      category,
      locale,
    });
    setSending(false);

    if (result.ok && result.data.ok && result.data.ref) {
      setCreated({ ref: result.data.ref, id: result.data.id });
      // تحديث عدادات لوحة الحساب خلف الحوار
      router.refresh();
      return;
    }
    if (result.status === 429) {
      toast.error(authErrors.rateLimited);
      return;
    }
    if (result.status === 0) {
      toast.error(authErrors.generic);
      return;
    }
    toast.error(authErrors.invalid);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6">
        {created ? (
          <div className="space-y-4 text-center">
            <DialogHeader>
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="size-7" aria-hidden="true" />
              </span>
              <DialogTitle className="text-lg font-bold text-navy">{t.createdOk}</DialogTitle>
              <DialogDescription className="leading-7 text-muted-foreground">{t.createdOkBody}</DialogDescription>
            </DialogHeader>
            <p
              className="mx-auto inline-flex max-w-full items-center rounded-xl bg-emerald-50 px-5 py-3 font-mono text-lg font-bold tracking-wide text-emerald-900 ltr-isolate select-all"
              dir="ltr"
            >
              {created.ref}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={openConversation}
                className="h-11 min-w-40 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {t.createdOkOpen}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="h-11 min-w-32 rounded-full px-6 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {t.formCancel}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-navy">{t.formTitle}</DialogTitle>
              <DialogDescription className="leading-7 text-muted-foreground">{t.formIntro}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="inquiry-subject" className="text-sm font-semibold text-navy">
                {t.formSubject}
              </Label>
              <Input
                id="inquiry-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t.formSubjectPlaceholder}
                maxLength={200}
                autoComplete="off"
                aria-invalid={subject.length > 0 && !subjectValid}
                className="min-h-11 text-start focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {subject.length > 0 && !subjectValid && <p className="text-xs font-medium text-destructive">{authErrors.required}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inquiry-category" className="text-sm font-semibold text-navy">
                {t.formCategory}
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger
                  id="inquiry-category"
                  className="min-h-11 w-full focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t.categories[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inquiry-message" className="text-sm font-semibold text-navy">
                {t.formMessage}
              </Label>
              <Textarea
                id="inquiry-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.formMessagePlaceholder}
                rows={5}
                maxLength={5000}
                aria-invalid={message.length > 0 && !messageValid}
                className="min-h-28 resize-y text-start leading-7 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {message.length > 0 && !messageValid && <p className="text-xs font-medium text-destructive">{authErrors.required}</p>}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="h-11 rounded-full px-6 font-semibold focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {t.formCancel}
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-11 rounded-full bg-primary px-6 font-bold text-primary-foreground shadow-md shadow-brand/20 transition-all hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {t.formSubmit}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
