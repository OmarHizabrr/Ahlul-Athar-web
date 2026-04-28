import type { ReactNode } from "react";
import { cn } from "../utils/cn";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * غلاف للصفحات العامّة (سيلز، الدور، الدخول) مع حواف آمنة للشاشات المقطوعة وحاوية مرنة تعمل على كل العرض.
 */
export function AuthPageShell({ children, className }: Props) {
  return (
    <main className={cn("center-page center-page--auth", className)}>
      <div className="auth-shell">{children}</div>
    </main>
  );
}
