import { Globe, Smartphone, LayoutDashboard, PenTool, Workflow, ShieldCheck } from "lucide-react";
import type { ServiceType } from "@/lib/validation";

const MAP = {
  web: Globe,
  mobile: Smartphone,
  systems: LayoutDashboard,
  ux: PenTool,
  automation: Workflow,
  maintenance: ShieldCheck,
  unsure: LayoutDashboard,
} as const;

/** أيقونات الخطية الموحدة للخدمات */
export function ServiceIcon({ service, className = "h-6 w-6" }: { service: ServiceType; className?: string }) {
  const Icon = MAP[service];
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8} />;
}
