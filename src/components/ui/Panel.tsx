import type { FormHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type PanelBase = {
  children: ReactNode;
  className?: string;
  /** يضيف `card-elevated` (الافتراضي true) */
  elevated?: boolean;
};

/** حاوية سطح مرتفع — للبطاقات والأقسام. */
export function Panel({ children, className, elevated = true, ...rest }: PanelBase & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(elevated && "card-elevated", className)} {...rest}>
      {children}
    </div>
  );
}

/** نموذج ببطاقة — يدمج `course-form` + `card-elevated` كما في صفحات الإدارة. */
export function FormPanel({
  children,
  className,
  elevated = true,
  ...rest
}: PanelBase & FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cn("course-form", elevated && "card-elevated", className)} {...rest}>
      {children}
    </form>
  );
}
