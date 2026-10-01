import type { WorkKind } from "@/content/types";

/**
 * رسوم توضيحية لحالات الأعمال — واجهات CSS مجردة (Wireframes) بدل صور.
 * تعكس بنية كل حالة وتُبنى محليًا دون أصول ثنائية.
 */
export function CaseVisual({ kind, label }: { kind: WorkKind; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-background p-4" role="img" aria-label={label}>
      {kind === "design" && <PortalVisual />}
      {kind === "interactive" && <BookingVisual />}
      {kind === "flow" && <FlowVisual />}
    </div>
  );
}

/** إطار متصفح مجرد */
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <span className="ms-3 h-4 flex-1 rounded-full bg-white" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Bar({ w, tone = "slate" }: { w: string; tone?: "slate" | "navy" | "brand" | "sky" }) {
  const tones = { slate: "bg-slate-200", navy: "bg-navy/80", brand: "bg-brand", sky: "bg-skydrop/70" };
  return <span className={`inline-block h-2 rounded-full ${tones[tone]}`} style={{ width: w }} />;
}

/** بوابة الطلبات: نموذج قصير + قائمة طلبات بحالات */
function PortalVisual() {
  return (
    <BrowserFrame>
      <div className="grid grid-cols-[1fr_1.3fr] gap-4">
        <div className="space-y-2.5 rounded-lg border border-border p-3">
          <Bar w="60%" tone="navy" />
          <div className="h-5 rounded-md border border-border bg-background" />
          <div className="h-5 rounded-md border border-border bg-background" />
          <div className="h-9 rounded-md border border-border bg-background" />
          <span className="flex h-6 w-20 items-center justify-center rounded-md bg-brand">
            <Bar w="60%" tone="sky" />
          </span>
        </div>
        <div className="space-y-2.5">
          {[70, 55, 80].map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
              <span className="h-6 w-6 rounded-full bg-accent" />
              <div className="flex-1 space-y-1.5">
                <Bar w={`${w}%`} tone="navy" />
                <Bar w={`${w - 25}%`} />
              </div>
              <span className={`h-4 w-12 rounded-full ${["bg-green-200", "bg-amber-200", "bg-sky-200"][i]}`} />
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

/** الحجز: إطار جوال بثلاث خطوات وشبكة أوقات */
function BookingVisual() {
  return (
    <div className="flex justify-center py-1">
      <div className="w-44 rounded-[1.6rem] border-4 border-navy/90 bg-white p-2.5 shadow-lg">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
        <Bar w="55%" tone="navy" />
        <div className="mt-2.5 flex gap-1.5">
          {["bg-brand", "bg-skydrop/60", "bg-slate-200"].map((c, i) => (
            <span key={i} className={`flex h-5 w-5 items-center justify-center rounded-full ${c} text-[8px] font-bold text-white`}>
              {i + 1}
            </span>
          ))}
          <span className="ms-auto h-5 w-12 rounded-full bg-slate-100" />
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {["bg-accent border-brand", "border-border bg-white", "border-border bg-white", "border-border bg-white", "bg-navy", "border-border bg-white"].map(
            (c, i) => (
              <span key={i} className={`h-6 rounded-md border ${c}`} />
            )
          )}
        </div>
        <span className="mt-2.5 flex h-7 items-center justify-center rounded-md bg-brand">
          <Bar w="50%" tone="sky" />
        </span>
      </div>
    </div>
  );
}

/** الأتمتة: مخطط سير بعقد واتجاهات */
function FlowVisual() {
  return (
    <div dir="ltr" className="space-y-3 px-1 py-2">
      <div className="flex items-center gap-2">
        <Node tone="navy" label="IN" />
        <Arrow />
        <Node tone="brand" label="AI" />
        <Arrow />
        <Node tone="slate" label="CRM" />
      </div>
      <div className="ms-6 h-4 border-s-2 border-dashed border-slate-300" />
      <div className="flex items-center gap-2">
        <span className="ms-4 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">REVIEW</span>
        <Arrow />
        <Node tone="green" label="SEND" />
      </div>
      <div className="ms-6 h-4 border-s-2 border-dashed border-slate-300" />
      <div className="flex items-center gap-2">
        <Node tone="slate" label="LOG" />
        <Arrow />
        <Node tone="sky" label="REPORT" />
      </div>
    </div>
  );
}

function Node({ tone, label }: { tone: "navy" | "brand" | "slate" | "green" | "sky"; label: string }) {
  const tones = {
    navy: "bg-navy text-white",
    brand: "bg-brand text-white",
    slate: "bg-white text-slate-600 border border-slate-200",
    green: "bg-green-600 text-white",
    sky: "bg-skydrop text-navy",
  };
  return (
    <span className={`flex h-9 w-16 items-center justify-center rounded-lg font-mono text-[10px] font-bold ${tones[tone]}`}>
      {label}
    </span>
  );
}

function Arrow() {
  return (
    <svg className="h-3 w-6 shrink-0 text-slate-400" viewBox="0 0 24 12" fill="none" aria-hidden="true">
      <path d="M0 6h20M16 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
