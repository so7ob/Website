import Link from "next/link";
import { localePath, type Locale } from "@/lib/i18n";
import type { SiteContent } from "@/content/types";

/** الدعوة الختامية «ما الذي تريد إنجازه؟» — شريط كحلي برسمة سحابية خفيفة */
export function FinalCta({ locale, content }: { locale: Locale; content: SiteContent }) {
  const c = content.home.finalCta;
  return (
    <section className="relative overflow-hidden bg-navy py-16 sm:py-20 lg:py-24">
      {/* زخارف خفيفة */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-20 start-[10%] h-64 w-64 rounded-full bg-skydrop/10 blur-3xl" />
        <div className="absolute bottom-0 end-[5%] h-72 w-72 rounded-full bg-digital/20 blur-3xl opacity-60" />
        <span className="absolute top-10 end-[8%] hidden select-none font-mono text-7xl font-bold text-white/5 lg:block">{"{"}</span>
        <span className="absolute bottom-8 start-[6%] hidden select-none font-mono text-7xl font-bold text-white/5 lg:block">{"}"}</span>
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-balance text-3xl font-bold leading-snug text-white sm:text-4xl">{c.title}</h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-8 text-white/70">{c.body}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`${localePath(locale, "contact")}?type=discussion`}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-skydrop px-7 text-base font-bold text-navy transition-colors hover:bg-sky-300 sm:w-auto"
          >
            {content.actions.discuss}
          </Link>
          <Link
            href={`${localePath(locale, "contact")}?type=quote`}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-white/25 px-7 text-base font-semibold text-white transition-colors hover:border-skydrop hover:text-skydrop sm:w-auto"
          >
            {content.actions.quote}
          </Link>
        </div>
        <p className="mt-6 text-xs leading-6 text-white/50">
          {c.discussNote} · {c.quoteNote}
        </p>
      </div>
    </section>
  );
}
