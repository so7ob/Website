import Link from "next/link";
import { Github } from "lucide-react";
import { Logo } from "./logo";
import { localePath, type Locale, type RouteName } from "@/lib/i18n";
import { siteConfig } from "@/config/site";
import type { SiteContent } from "@/content/types";

const NAV_ROUTES: RouteName[] = ["about", "works", "process", "faq", "contact"];
const SERVICE_ROUTES = ["web", "mobile", "systems", "ux", "automation", "maintenance"] as const;

/** التذييل: خلفية كحلية بنسخة الشعار البيضاء — يلتصق بأسفل الشاشة دائمًا */
export function SiteFooter({ locale, content }: { locale: Locale; content: SiteContent }) {
  const year = new Date().getFullYear();
  const channels: { label: string; value: string; href: string }[] = [];
  if (siteConfig.contact.email) {
    channels.push({ label: content.form.emailLabel, value: siteConfig.contact.email, href: `mailto:${siteConfig.contact.email}` });
  }
  if (siteConfig.contact.phone) {
    channels.push({ label: content.form.phoneLabel, value: siteConfig.contact.phone, href: `tel:${siteConfig.contact.phone.replace(/\s+/g, "")}` });
  }

  return (
    <footer className="mt-auto bg-navy text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <Logo variant="light" size="md" nameLang={locale === "ar" ? "ar" : "en"} />
            <p className="max-w-sm text-sm leading-7 text-white/70">{content.footer.about}</p>
            {channels.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {channels.map((c) => (
                  <li key={c.label}>
                    <span className="text-white/50">{c.label}: </span>
                    <a href={c.href} className="ltr-isolate font-medium text-skydrop hover:underline">
                      {c.value}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav aria-label={content.footer.pagesTitle}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">{content.footer.pagesTitle}</h2>
            <ul className="mt-4 space-y-2.5">
              {NAV_ROUTES.map((route) => (
                <li key={route}>
                  <Link href={localePath(locale, route)} className="text-sm text-white/80 transition-colors hover:text-skydrop">
                    {content.nav[route]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={content.footer.servicesTitle}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">{content.footer.servicesTitle}</h2>
            <ul className="mt-4 space-y-2.5">
              {SERVICE_ROUTES.map((key) => {
                const item = content.services.items.find((s) => s.service === key);
                return (
                  <li key={key}>
                    <Link
                      href={`${localePath(locale, "services")}#${key}`}
                      className="text-sm text-white/80 transition-colors hover:text-skydrop"
                    >
                      {item?.name ?? key}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {content.meta.siteName} — {content.footer.rights}
          </p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-5">
            <span>{content.footer.illustrativeNote}</span>
            <a
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-white/70 transition-colors hover:text-skydrop"
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              {content.footer.repoLink}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
