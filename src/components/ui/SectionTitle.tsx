import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function SectionTitle({
  children,
  as: Tag = "h3",
  className,
  id,
}: {
  children: ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
  id?: string;
}) {
  return (
    <Tag className={cn("form-section-title", className)} id={id}>
      {children}
    </Tag>
  );
}
