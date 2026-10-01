import Link from "next/link";
import { localePath } from "@/lib/i18n";

/**
 * صفحة 404 العامة — تُستخدم لكل المسارات غير المطابقة.
 * بما أن الموقع يعتمد جذر تخطيط لكل مجموعة مسارات، توفر هذه الصفحة
 * <html> و<body> بنفسها مع توجيه ثنائي اللغة.
 */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: "#F8FAFC", fontFamily: "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <p style={{ fontFamily: "monospace", fontSize: "5rem", fontWeight: 700, color: "#0B1F3A", opacity: 0.12, margin: 0 }} aria-hidden="true">
              {"{ 404 }"}
            </p>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0B1F3A", margin: "0.5rem 0 1rem" }}>
              الصفحة غير موجودة — Page not found
            </h1>
            <p style={{ color: "#475569", lineHeight: 2, margin: "0 0 1.75rem" }}>
              الرابط الذي طلبته غير متاح أو تغيّر. يمكنك العودة إلى الموقع واختيار اللغة المناسبة.
              <br />
              The page you requested is unavailable or has moved.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href={localePath("ar")}
                style={{
                  background: "#0369A1", color: "#fff", borderRadius: "999px", padding: "0.7rem 1.6rem",
                  fontWeight: 600, textDecoration: "none", display: "inline-block",
                }}
                lang="ar"
              >
                العربية
              </Link>
              <Link
                href={localePath("en")}
                style={{
                  border: "2px solid #0B1F3A22", color: "#0B1F3A", borderRadius: "999px", padding: "0.7rem 1.6rem",
                  fontWeight: 600, textDecoration: "none", display: "inline-block",
                }}
                lang="en"
              >
                English
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
