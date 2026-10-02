/**
 * اختبار دخان لدورة الحفظ/النشر الجديدة — يعمل محليًا فقط:
 * 1) دخول admin 2) قراءة مراجعة المسودة 3) حفظ بمراجعة صحيحة
 * 4) حفظ بمراجعة قديمة → 409 5) نشر بمراجعة صحيحة 6) فحص ظهور الزائر
 */
const BASE = "http://localhost:3000";

let cookieJar = "";

async function req(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookieJar ? { Cookie: cookieJar } : {}),
      ...(init.body ? { Origin: BASE } : {}),
      ...(init.headers ?? {}),
    },
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const [name] = pair.split("=");
    if (name === "next-auth.session-token" || name === "csrf-token" || name === "next-auth.csrf-token") {
      // نستبدل القيمة لنفس الاسم
      cookieJar = cookieJar
        .split("; ")
        .filter((p) => !p.startsWith(name + "="))
        .concat([pair])
        .join("; ");
    }
  }
  return res;
}

async function main() {
  // CSRF
  const csrfRes = await fetch(BASE + "/api/auth/csrf");
  const csrf = await csrfRes.json();
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  cookieJar = csrfCookie;

  // Login
  const login = await req("/api/auth/callback/credentials", {
    method: "POST",
    body: JSON.stringify({ email: "admin@so7ob.local", password: "Admin#2026!", csrfToken: csrf.csrfToken, json: true }),
  });
  console.log("login:", login.status);

  // Pages list
  const list = await req("/api/admin/pages");
  const listJson = await list.json();
  console.log("list:", list.status, "count:", listJson.pages?.length);
  const about = listJson.pages.find((p) => p.slug === "about");
  if (!about) throw new Error("about page missing");

  // Detail
  const detail = await req(`/api/admin/pages/${about.id}`);
  const detailJson = await detail.json();
  const rev = detailJson.page.draftRevision;
  console.log("detail:", detail.status, "revision:", rev, "draftSettings.slug:", detailJson.page.draftSettings?.slug);

  // Save with correct revision
  const blocks = JSON.stringify([{ id: "b-test-001", type: "spacer", props: { size: "md" } }]);
  const save1 = await req(`/api/admin/pages/${about.id}`, {
    method: "PATCH",
    body: JSON.stringify({ draftBlocksAr: blocks, draftBlocksEn: blocks, baseRevision: rev }),
  });
  const save1j = await save1.json();
  console.log("save(ok):", save1.status, "newRevision:", save1j.page?.draftRevision);

  // Save with stale revision → 409
  const save2 = await req(`/api/admin/pages/${about.id}`, {
    method: "PATCH",
    body: JSON.stringify({ draftBlocksAr: blocks, draftBlocksEn: blocks, baseRevision: rev }),
  });
  console.log("save(stale) →", save2.status, "(expected 409)");

  // Save without revision → 409 revision_required
  const save3 = await req(`/api/admin/pages/${about.id}`, {
    method: "PATCH",
    body: JSON.stringify({ draftBlocksAr: blocks, draftBlocksEn: blocks }),
  });
  console.log("save(no-rev) →", save3.status, "(expected 409)");

  // Publish with stale revision → 409
  const pub0 = await req(`/api/admin/pages/${about.id}/publish`, {
    method: "POST",
    body: JSON.stringify({ baseRevision: rev }),
  });
  console.log("publish(stale) →", pub0.status, "(expected 409)");

  // Publish correct
  const pub = await req(`/api/admin/pages/${about.id}/publish`, {
    method: "POST",
    body: JSON.stringify({ baseRevision: save1j.page.draftRevision }),
  });
  const pubj = await pub.json();
  console.log("publish(ok):", pub.status, "publishedRevision:", pubj.page?.publishedRevision);

  // Public still renders
  const public1 = await fetch(BASE + "/ar/about");
  console.log("public /ar/about:", public1.status);

  // Publish Arabic only
  const pub2 = await req(`/api/admin/pages/${about.id}/publish`, {
    method: "POST",
    body: JSON.stringify({ baseRevision: save1j.page.draftRevision, locales: ["ar"] }),
  });
  console.log("publish(ar-only):", pub2.status, "(expected 409 — نفس المراجعة نُشرت للتو)");

  // Restore a non-existent version → 404
  const rest404 = await req(`/api/admin/pages/${about.id}/versions/9999/restore`, {
    method: "POST",
    body: JSON.stringify({ locales: ["ar"], baseRevision: save1j.page.draftRevision }),
  });
  console.log("restore(missing) →", rest404.status, "(expected 404)");

  // Home assignment safety: try setting about as home then revert is NOT possible via API only; skip revert.
  console.log("SMOKE DONE");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e.message);
  process.exit(1);
});
