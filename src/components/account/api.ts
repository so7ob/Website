/**
 * جلب واجهات API من المتصفح — مسارات نسبية فقط، JSON افتراضيًا،
 * ولا يرمي الاستثناءات: النتيجة تُقرأ من {ok,status,data}.
 */
import type {
  CreateInquiryResponse,
  InquiryDetailResponse,
  InquiryListResponse,
  InquiryReplyResponse,
} from "./types";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export async function apiFetch<T = Record<string, unknown>>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    const res = await fetch(url, { ...init, headers });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}

// ——— الاستفسارات ———

export interface FetchInquiriesParams {
  /** حالة استفسار أو المركّبة "open" — بلا قيمة تعني الكل */
  status?: string;
  /** بحث نصي — يُفعّل من حرفين (شرط الواجهة الخادمية) */
  q?: string;
  page?: number;
}

/** جلب استفسارات العميل — GET /api/account/inquiries */
export async function fetchInquiries(params: FetchInquiriesParams = {}): Promise<ApiResult<InquiryListResponse>> {
  const query = new URLSearchParams({ page: String(params.page ?? 1) });
  if (params.status) query.set("status", params.status);
  if (params.q) query.set("q", params.q);
  return apiFetch<InquiryListResponse>(`/api/account/inquiries?${query.toString()}`);
}

/** جلب تفاصيل استفسار واحد — GET /api/account/inquiries/[id] */
export async function fetchInquiryDetail(id: string): Promise<ApiResult<InquiryDetailResponse>> {
  return apiFetch<InquiryDetailResponse>(`/api/account/inquiries/${encodeURIComponent(id)}`);
}

/** إنشاء استفسار — POST /api/account/inquiries */
export async function createInquiry(payload: {
  subject: string;
  message: string;
  category: string;
  locale: string;
}): Promise<ApiResult<CreateInquiryResponse>> {
  return apiFetch<CreateInquiryResponse>("/api/account/inquiries", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** رد على استفسار — POST /api/account/inquiries/[id]/messages */
export async function sendInquiryReply(id: string, body: string): Promise<ApiResult<InquiryReplyResponse>> {
  return apiFetch<InquiryReplyResponse>(`/api/account/inquiries/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
