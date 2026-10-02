/** Deliver full mail, persist delivery metadata only. Never store account links. */
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

export type MailStatus = "sent" | "dev_logged" | "failed";
export interface SendMailInput { to: string; subject: string; text: string; html?: string }
export interface SendMailResult { status: MailStatus; error?: string; outboxId?: string }

export function emailDevMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.EMAIL_DEV_MODE === "true";
}
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  let status: MailStatus;
  let error: string | undefined;
  if (emailDevMode()) {
    status = "dev_logged";
  } else if (!smtpConfigured()) {
    status = "failed";
    error = "smtp_not_configured";
  } else {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD },
    });
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: input.to, subject: input.subject, text: input.text, html: input.html,
      });
      status = "sent";
    } catch {
      // Provider exceptions may contain credentials, recipient data or message content.
      status = "failed";
      error = "smtp_delivery_failed";
    } finally { transport.close(); }
  }
  // Keep DB logging outside the delivery try/catch: a log failure must not be
  // misreported as a failed delivery (which could trigger duplicate sending).
  const row = await db.emailLog.create({ data: {
    to: input.to, subject: input.subject, bodyText: "", bodyHtml: null,
    status, error: error ?? null,
  } });
  return { status, error, outboxId: row.id };
}

export function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
