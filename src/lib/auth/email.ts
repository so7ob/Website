/**
 * البريد الصادر — فصل صارم بين الحفظ والإرسال:
 * - EMAIL_DEV_MODE=true: يسجل الرسالة في صندوق صادر داخلي (EmailLog) بلا إرسال فعلي.
 * - SMTP مضبوط: إرسال حقيقي عبر nodemailer وتسجيل النتيجة.
 * - لا شيء مضبوط: تسجيل الحالة failed — ولا يُدَّعى نجاح إرسال لم يحدث.
 */
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

export type MailStatus = "sent" | "dev_logged" | "failed";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendMailResult {
  status: MailStatus;
  error?: string;
  /** رابط المعاينة في وضع التطوير (صندوق الصادر) */
  outboxId?: string;
}

export function emailDevMode(): boolean {
  return process.env.EMAIL_DEV_MODE === "true";
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const devMode = emailDevMode();

  // وضع التطوير: صندوق صادر داخلي — لا إرسال فعلي ولا ادعاء نجاح
  if (devMode || !smtpConfigured()) {
    const status: MailStatus = devMode ? "dev_logged" : "failed";
    const error = devMode ? undefined : "SMTP غير مضبوط — لم يُرسل البريد فعليًا";
    const row = await db.emailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        bodyText: input.text,
        bodyHtml: input.html ?? null,
        status,
        error: error ?? null,
      },
    });
    if (devMode) {
      console.info(`[email:dev] إلى ${input.to} — «${input.subject}» (مسجل في صندوق الصادر #${row.id.slice(0, 8)})`);
    } else {
      console.warn(`[email] فشل الإرسال إلى ${input.to}: ${error}`);
    }
    return { status, error, outboxId: row.id };
  }

  // إرسال فعلي عبر SMTP
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    await db.emailLog.create({
      data: { to: input.to, subject: input.subject, bodyText: input.text, bodyHtml: input.html ?? null, status: "sent" },
    });
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] فشل إرسال SMTP:", message);
    await db.emailLog.create({
      data: { to: input.to, subject: input.subject, bodyText: input.text, bodyHtml: input.html ?? null, status: "failed", error: message.slice(0, 500) },
    });
    return { status: "failed", error: message };
  }
}

/** يبني رابطًا كاملًا من مسار — يستخدم NEXT_PUBLIC_SITE_URL */
export function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
