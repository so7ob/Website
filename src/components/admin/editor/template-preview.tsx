"use client";

/**
 * معاينة مصغرة تخطيطية (wireframe) لبنية القالب — جولة 37.
 *
 * المدخل بصمة أنواع الكتل العلوية بترتيبها (templatePreview في الخادم —
 * بلا نصوص ولا معرفات) والمخرج رسم تخطيطي متماثل مع كل نمط كتلة:
 * البطل تدرّج بعنوان، الشبكة بطاقات، المعرض بلاطات، الأسئلة صفوف…
 * الهدف أن يميّز المحرر القوالب بنظرة قبل التطبيق دون جلب المحتوى الكامل.
 *
 * رسم مجرد بالكامل: ألوان الهوية فقط (brand/navy/skydrop/emerald/amber)
 * ولا نصوص حقيقية — آمن RTL/LTR بطبيعته لأن الأنماط متماثلة.
 */
import { cn } from "@/lib/utils";

/** ارتفاع الإطار الثابت — القوالب الأطول تُقص بلطف مع تلاشٍ سفلي */
const FRAME = "h-[96px]";
/** ارتفاع صف النمط الواحد — الأنماط مصممة لتناسبه */
const ROW = "h-[18px]";

interface TemplatePreviewProps {
  /** أنواع الكتل العلوية بترتيبها — من templateListItem.arPreview/enPreview */
  types: string[];
  /** نص بديل للوصول (i18n يمرر الترجمة) */
  label: string;
  className?: string;
}

/** سطر نص مجرد — عرض نسبي ارتفاعه 1.5px تقريبًا */
function Line({ w, tone = "muted", className }: { w: string; tone?: "muted" | "strong" | "brand" | "white"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-1 rounded-full",
        tone === "muted" && "bg-slate-300/80",
        tone === "strong" && "bg-slate-400/80",
        tone === "brand" && "bg-brand/70",
        tone === "white" && "bg-white/70",
        w,
        className
      )}
    />
  );
}

/** بطاقة مجردة صغيرة */
function Card({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <span aria-hidden="true" className={cn("block rounded-[3px] border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(11,31,58,0.06)]", className)}>{children}</span>;
}

/** بلاطة صورة مجردة — بتدرج رمادي فاتح وأيقونة زاوية */
function Tile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block overflow-hidden rounded-[3px] bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300",
        "after:absolute after:end-[2px] after:top-[2px] after:size-1 after:rounded-full after:bg-white/90",
        className
      )}
    />
  );
}

/** أنماط كل نوع — دالة صغيرة لكل عائلة بصرية */
const PATTERNS: Record<string, () => React.ReactNode> = {
  // hero — navy gradient, two inline title lines
  hero: () => (
    <span className="flex h-full items-center gap-1.5 rounded-[4px] bg-gradient-to-l from-navy via-navy-soft to-brand/80 px-2">
      <Line w="w-2/5" tone="white" className="h-1.5" />
      <Line w="w-1/5" tone="brand" className="h-1.5 !bg-skydrop/90" />
      <Line w="w-1/6" tone="white" className="ms-auto opacity-40" />
    </span>
  ),
  // pageHeader — slim navy bar
  pageHeader: () => (
    <span className="flex h-full items-center gap-1.5 rounded-[4px] bg-gradient-to-l from-navy to-navy-soft px-2">
      <Line w="w-1/3" tone="white" className="h-1.5" />
      <span className="ms-auto flex gap-1">
        <Line w="w-3" tone="white" className="opacity-50" />
        <Line w="w-3" tone="white" className="opacity-50" />
      </span>
    </span>
  ),
  // servicesGrid — three compact cards
  servicesGrid: () => (
    <span className="flex h-full items-stretch gap-1.5">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="flex flex-1 items-center gap-1 px-1.5">
          <span className="size-1.5 shrink-0 rounded-full bg-brand/70" />
          <Line w="w-2/3" tone="strong" />
        </Card>
      ))}
    </span>
  ),
  // servicesDetail — two wide cards
  servicesDetail: () => (
    <span className="flex h-full items-stretch gap-1.5">
      {[0, 1].map((i) => (
        <Card key={i} className="flex flex-1 items-center gap-1.5 px-1.5">
          <span className="size-2.5 shrink-0 rounded bg-brand/60" />
          <Line w="w-1/2" tone="strong" />
        </Card>
      ))}
    </span>
  ),
  // featureGrid — 2x2 mini cards
  featureGrid: () => (
    <span className="grid h-full grid-cols-2 gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="flex items-center gap-1 px-1">
          <span className="size-1.5 shrink-0 rounded-full bg-skydrop" />
          <Line w="w-3/4" tone="strong" />
        </Card>
      ))}
    </span>
  ),
  // showcase — image tiles
  worksShowcase: () => (
    <span className="flex h-full items-stretch gap-1.5">
      <Tile className="flex-[2]" />
      <Tile className="flex-1" />
      <Tile className="flex-1" />
    </span>
  ),
  worksFull: () => (
    <span className="flex h-full flex-col gap-1">
      <Tile className="min-h-0 flex-[2]" />
      <span className="flex min-h-0 flex-1 gap-1">
        <Tile className="flex-1" />
        <Tile className="flex-1" />
      </span>
    </span>
  ),
  // processSteps — numbered dots on a line
  processSteps: () => (
    <span className="relative flex h-full items-center justify-between px-1">
      <span aria-hidden="true" className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-brand/30" />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} aria-hidden="true" className="relative z-10 flex size-3 items-center justify-center rounded-full border-2 border-brand bg-white text-[5px] font-bold text-brand">
          {i + 1}
        </span>
      ))}
    </span>
  ),
  processFull: () => (
    <span className="flex h-full items-stretch gap-1.5">
      {[1, 2].map((n) => (
        <Card key={n} className="flex flex-1 items-center gap-1.5 px-1.5">
          <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[6px] font-bold text-brand">{n}</span>
          <Line w="w-1/2" tone="strong" />
        </Card>
      ))}
    </span>
  ),
  // faq — accordion rows
  faqSection: () => (
    <span className="flex h-full flex-col justify-center gap-[3px]">
      {[0, 1].map((i) => (
        <Card key={i} className="flex h-[7px] items-center gap-1.5 px-1.5">
          <Line w={i % 2 ? "w-1/2" : "w-2/3"} tone="strong" />
          <span className="ms-auto block size-1.5 shrink-0 rounded-[1px] border border-brand/60" />
        </Card>
      ))}
    </span>
  ),
  // cta — colored banner with pill button
  ctaSection: () => (
    <span className="flex h-full items-center justify-between gap-2 rounded-[4px] bg-gradient-to-l from-brand to-skydrop/80 px-2">
      <Line w="w-1/3" tone="white" className="h-1.5" />
      <span aria-hidden="true" className="block h-2.5 w-8 rounded-full bg-white/90" />
    </span>
  ),
  navCtaBanner: () => (
    <span className="flex h-full items-center justify-between gap-2 rounded-[4px] border border-brand/30 bg-brand-soft/60 px-2">
      <Line w="w-1/3" tone="strong" className="h-1.5" />
      <span aria-hidden="true" className="block h-2.5 w-8 rounded-full bg-brand/80" />
    </span>
  ),
  // requestForm — fields box + button
  requestForm: () => (
    <span className="flex h-full items-center gap-2">
      <Card className="flex h-full flex-1 items-center gap-1 px-1.5">
        <span className="h-2 flex-1 rounded-[2px] border border-slate-200 bg-slate-50" />
        <span className="h-2 flex-1 rounded-[2px] border border-slate-200 bg-slate-50" />
      </Card>
      <span aria-hidden="true" className="block h-3 w-9 shrink-0 rounded-full bg-brand shadow-sm" />
    </span>
  ),
  // contactInfo — icon + line rows
  contactInfo: () => (
    <span className="flex h-full flex-col justify-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className={cn("size-2 shrink-0 rounded-[2px]", i === 0 ? "bg-brand/60" : i === 1 ? "bg-emerald-500/50" : "bg-amber-500/50")} />
          <Line w={i % 2 ? "w-2/5" : "w-1/2"} tone="strong" />
        </span>
      ))}
    </span>
  ),
  // visionMission — two columns
  visionMission: () => (
    <span className="flex h-full items-stretch gap-1.5">
      {[0, 1].map((i) => (
        <Card key={i} className="flex flex-1 items-center gap-1 px-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", i === 0 ? "bg-brand/60" : "bg-skydrop/70")} />
          <Line w="w-1/2" tone="strong" />
        </Card>
      ))}
    </span>
  ),
  // numbered lists — digit circles
  numberedValues: () => (
    <span className="flex h-full flex-col justify-center gap-[3px]">
      {[1, 2, 3].map((n) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="flex size-2.5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[5px] font-bold text-brand">{n}</span>
          <Line w={n === 2 ? "w-1/2" : "w-2/3"} tone="strong" />
        </span>
      ))}
    </span>
  ),
  numberedList: () => (
    <span className="flex h-full flex-col justify-center gap-[3px]">
      {[1, 2, 3].map((n) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="flex size-2.5 shrink-0 items-center justify-center rounded-[2px] bg-navy/20 text-[5px] font-bold text-navy">{n}</span>
          <Line w={n === 1 ? "w-3/5" : n === 2 ? "w-1/2" : "w-2/5"} tone="strong" />
        </span>
      ))}
    </span>
  ),
  // heading — short centered emphasized line
  heading: () => (
    <span className="flex h-full items-center justify-center gap-1.5">
      <Line w="w-1/4" tone="strong" className="h-1.5" />
      <span aria-hidden="true" className="block h-0.5 w-6 rounded-full bg-brand/60" />
    </span>
  ),
  // text — paragraphs
  text: () => (
    <span className="flex h-full flex-col justify-center gap-[3px]">
      <Line w="w-full" />
      <Line w="w-2/3" />
    </span>
  ),
  richText: () => (
    <span className="flex h-full flex-col justify-center gap-[3px]">
      <Line w="w-1/4" tone="brand" className="h-1.5" />
      <Line w="w-5/6" />
    </span>
  ),
  // image — single tile
  image: () => <Tile className="h-full w-full" />,
  // gallery — four tiles
  gallery: () => (
    <span className="grid h-full grid-cols-4 gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <Tile key={i} />
      ))}
    </span>
  ),
  // buttonLink — pills
  buttonLink: () => (
    <span className="flex h-full items-center justify-center gap-1.5">
      <span aria-hidden="true" className="block h-2.5 w-12 rounded-full bg-brand shadow-sm" />
      <span aria-hidden="true" className="block h-2.5 w-8 rounded-full border border-brand/50" />
    </span>
  ),
  // columns — two panes
  columns: () => (
    <span className="flex h-full items-stretch gap-1.5">
      {[0, 1].map((i) => (
        <span key={i} className="flex flex-1 items-center gap-1 rounded-[3px] border border-slate-200/90 px-1.5">
          <Line w={i === 0 ? "w-1/2" : "w-2/3"} tone="strong" />
        </span>
      ))}
    </span>
  ),
  // table — grid lines
  simpleTable: () => (
    <span className="grid h-full grid-cols-3 grid-rows-2 gap-px overflow-hidden rounded-[3px] border border-slate-200 bg-slate-200">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} aria-hidden="true" className={cn("block", i < 3 ? "bg-brand-soft/70" : "bg-white")} />
      ))}
    </span>
  ),
  // divider
  divider: () => (
    <span className="flex h-full items-center">
      <span aria-hidden="true" className="block h-px w-full bg-slate-200" />
    </span>
  ),
  // spacer — dashed gap
  spacer: () => (
    <span className="flex h-full items-center">
      <span aria-hidden="true" className="block h-2 w-full rounded-[2px] border border-dashed border-slate-200" />
    </span>
  ),
};

/** لون شارة النوع غير المعروف — رمادي محايد */
function Unknown() {
  return (
    <span className="flex h-full items-center gap-1.5 rounded-[4px] border border-slate-200 bg-slate-50 px-2">
      <span className="size-1.5 rounded-full bg-slate-300" />
      <Line w="w-1/3" tone="muted" />
    </span>
  );
}

export function TemplatePreview({ types, label, className }: TemplatePreviewProps) {
  if (types.length === 0) {
    return (
      <div
        role="img"
        aria-label={label}
        className={cn("flex items-center justify-center rounded-lg border border-dashed border-border/80 bg-slate-50/60", FRAME, className)}
      >
        <span className="text-[10px] font-medium text-muted-foreground/60">—</span>
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative overflow-hidden rounded-lg border border-border/80 bg-gradient-to-b from-slate-50/80 to-white p-1.5", FRAME, className)}
    >
      {/* صفوف بارتفاع طبيعي ثابت — القوالب الأطول تُقص بتلاشٍ سفلي */}
      <div className="flex flex-col gap-1 [mask-image:linear-gradient(to_bottom,black_75%,transparent_96%)]">
        {types.map((type, i) => {
          const Pattern = PATTERNS[type];
          return (
            <div key={`${type}-${i}`} className={ROW}>
              {Pattern ? <Pattern /> : <Unknown />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
