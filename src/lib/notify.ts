/**
 * إشعار المسؤول عند وصول طلب جديد — اختياري بالكامل.
 *
 * عند ضبط NOTIFY_WEBHOOK_URL يُرسل POST JSON إلى الرابط المحدد
 * (يتوافق مع أنظمة مثل Slack/Discord webhook أو أي مستقبل بسيط).
 * غياب المتغير = لا إشعار، والحفظ الدائم في القاعدة يستمر كالمعتاد.
 * لا يُحاكى أي نجاح: نتيجة الإشعار تُسجل ولا تُعاد للمستخدم.
 */

import type { ProjectRequestInput } from "./validation";

export interface NotifyPayload {
  refCode: string;
  requestType: string;
  serviceType: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  budget: string;
  currency?: string;
  timeline: string;
  locale: string;
  descriptionPreview: string;
}

export function buildNotifyPayload(data: ProjectRequestInput, refCode: string): NotifyPayload {
  return {
    refCode,
    requestType: data.requestType,
    serviceType: data.serviceType,
    name: data.name,
    company: data.company || undefined,
    email: data.email,
    phone: data.phone || undefined,
    budget: data.budget,
    currency: data.currency || undefined,
    timeline: data.timeline,
    locale: data.locale,
    descriptionPreview: data.description.slice(0, 280),
  };
}

/**
 * يحاول الإرسال ويعيد وقت النجاح أو null.
 * لا يرمي استثناءات: فشل الإشعار لا يفشل الطلب.
 */
export async function sendNotify(payload: NotifyPayload, webhookUrl: string | undefined): Promise<Date | null> {
  if (!webhookUrl) return null;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `طلب جديد ${payload.refCode} — ${payload.serviceType} — ${payload.email}`, payload }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? new Date() : null;
  } catch {
    return null;
  }
}
