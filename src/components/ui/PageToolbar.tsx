import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function PageToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("toolbar", "page-toolbar", className)}>{children}</div>;
}
