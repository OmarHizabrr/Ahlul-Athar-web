import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function AppModal({
  open,
  title,
  onClose,
  children,
  className,
  contentClassName,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className={cn("modal-overlay", "app-modal-overlay", className)} role="presentation" onClick={onClose}>
      <section
        className={cn("modal-card", "app-modal-card", contentClassName)}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="app-modal-head">
          <h3 className="app-modal-title">{title}</h3>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="إغلاق النافذة">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
