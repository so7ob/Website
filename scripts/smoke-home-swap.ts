/** اختبار تبديل الرئيسية: لا تصادم ولا لحظة بلا رئيسية، ثم التراجع والتنظيف */
const BASE = "http://localhost:3000";
let cookieJar = "";

async function req(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(cookieJar ? { Cookie: cookieJar } : {}), ...(init.body ? { Origin: BASE } : {}) },
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const [name] = pair.split("=");
    if (name === "next-auth.session-token") {
      cookieJar = cookieJar.split("; ").filter((p) => !p.startsWith(name + "=")).concat([pair]).join("; ");
    }
  }
  return res;
}

async function main() {
  const csrfRes = await fetch(BASE + "/api/auth/csrf");
  const csrf = await csrfRes.json();
  cookieJar = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  await req("/api/auth/callback/credentials", { method: "POST", body: JSON.stringify({ email: "admin@so7ob.local", password: "Admin#2026!", csrfToken: csrf.csrfToken, json: true }) });

  // إنشاء صفحة اختبار
  const created = await req("/api/admin/pages", { method: "POST", body: JSON.stringify({ slug: "home-swap-tmp", titleAr: "تبديل تجربة", titleEn: "Swap Test" }) });
  const createdJ = await created.json();
  console.log("create:", created.status, createdJ.page?.id);
  const tmpId = createdJ.page.id;

  const list = async () => (await (await req("/api/admin/pages")).json()).pages;
  const homeBefore = (await list()).find((p) => p.isHome);
  console.log("home before:", homeBefore.slug || "(empty)");

  // تعيين صفحة الاختبار رئيسية — يجب أن ينجح دون P2002
  const swap1 = await req(`/api/admin/pages/${tmpId}`, { method: "PATCH", body: JSON.stringify({ isHome: true }) });
  console.log("set-home(tmp):", swap1.status, "(expected 200)");

  const after1 = await list();
  const tmp = after1.find((p) => p.id === tmpId);
  const oldHome = after1.find((p) => p.id === homeBefore.id);
  console.log("tmp now: isHome=", tmp.isHome, "slug=", JSON.stringify(tmp.slug));
  console.log("old home now: isHome=", oldHome.isHome, "slug=", JSON.stringify(oldHome.slug));

  // الزائر يصل للرئيسية الجديدة عبر /ar والقديمة عبر /ar/<slug الجديد>
  const r1 = await fetch(BASE + "/ar");
  const r2 = await fetch(BASE + `/ar/${oldHome.slug}`);
  console.log("GET /ar:", r1.status, "— GET /ar/" + oldHome.slug + ":", r2.status);

  // التراجع: الرئيسية الأصلية تعود
  const swap2 = await req(`/api/admin/pages/${homeBefore.id}`, { method: "PATCH", body: JSON.stringify({ isHome: true }) });
  console.log("set-home(revert):", swap2.status);
  const after2 = await list();
  const revertedHome = after2.find((p) => p.id === homeBefore.id);
  const revertedTmp = after2.find((p) => p.id === tmpId);
  console.log("home back: isHome=", revertedHome.isHome, "slug=", JSON.stringify(revertedHome.slug));
  console.log("tmp back: isHome=", revertedTmp.isHome, "slug=", JSON.stringify(revertedTmp.slug));

  // تنظيف: أرشفة صفحة الاختبار
  const archive = await req(`/api/admin/pages/${tmpId}`, { method: "DELETE" });
  console.log("archive(tmp):", archive.status);
  console.log("HOME SWAP SMOKE DONE");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
