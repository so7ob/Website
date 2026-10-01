import { siteConfig } from "@/config/site";

/**
 * الشعار: الرسمة المعتمدة كما هي + معالجة كتابية للاسم (مؤقتة حتى اعتماد شعار نصي).
 * variant: dark = رسمة سوداء للأسطح الفاتحة، light = رسمة بيضاء للأسطح الداكنة.
 */
export function Logo({
  variant = "dark",
  size = "md",
  showName = true,
  nameLang = "ar",
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  nameLang?: "ar" | "en";
}) {
  const dims = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const titleSizes =
    nameLang === "ar"
      ? { main: "text-lg font-bold", sub: "text-[11px] font-medium tracking-wide" }
      : { main: "text-lg font-semibold", sub: "text-[11px] font-medium tracking-wide" };

  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={variant === "dark" ? "/logo.png" : "/logo-white.png"}
        alt=""
        aria-hidden="true"
        className={`${dims} w-auto`}
        width={40}
        height={40}
      />
      {showName && (
        <span className="flex flex-col leading-tight">
          <span className={`${titleSizes.main} ${variant === "dark" ? "text-navy" : "text-white"}`}>
            {nameLang === "ar" ? siteConfig.nameAr : siteConfig.nameEn}
          </span>
          <span className={`${titleSizes.sub} ${variant === "dark" ? "text-muted-foreground" : "text-white/70"}`}>
            {nameLang === "ar" ? siteConfig.nameEn : siteConfig.nameAr}
          </span>
        </span>
      )}
    </span>
  );
}
