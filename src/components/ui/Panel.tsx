import type { FormHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type PanelAs = "div" | "section" | "article";

type PanelBase = {
  children: ReactNode;
  className?: string;
  /** يضيف `card-elevated` (الافتراضي true) */
  elevated?: boolean;
  /** الافتراضي `div` — استخدم `section` لأقسام مع `aria-label` */
  as?: PanelAs;
};

/** حاوية سطح مرتفع — للبطاقات والأقسام. */
export function Panel({
  as: Tag = "div",
  children,
  className,
  elevated = true,
  ...rest
}: PanelBase & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn(elevated && "card-elevated", className)} {...rest}>
      {children}
    </Tag>
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
