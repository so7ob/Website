/**
 * جلب واجهات API من المتصفح — مسارات نسبية فقط، JSON افتراضيًا،
 * ولا يرمي الاستثناءات: النتيجة تُقرأ من {ok,status,data}.
 */
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
