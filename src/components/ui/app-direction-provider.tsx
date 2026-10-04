"use client";

/**
 * مزود اتجاه Radix — يمرر اتجاه اللغة لكل مكونات Radix (Tabs، ScrollArea،
 * DropdownMenu، Dialog، Select…). بدونه تُصيَّر هذه المكونات dir="ltr" حتى في
 * الواجهة العربية (سلوك Radix الافتراضي بلا DirectionProvider) — وهو ما كان
 * يقلب اتجاه شجرة الطبقات داخل لوحة المحرر ويدفع صفوفها خارج اللوحة.
 */
import { DirectionProvider } from "@radix-ui/react-direction";

export function AppDirectionProvider({
  dir,
  children,
}: {
  dir: "rtl" | "ltr";
  children: React.ReactNode;
}) {
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
}
