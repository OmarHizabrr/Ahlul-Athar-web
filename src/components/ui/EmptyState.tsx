import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/** حالة فارغة — نفس `empty-state-card` في أغلب الصفحات. */
export function EmptyState({
  message,
  className,
  children,
}: {
  message: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("empty-state-card", className)} style={{ maxWidth: "100%" }}>
      <p className="muted empty-state-card__text">{message}</p>
      {children}
    </div>
  );
}
