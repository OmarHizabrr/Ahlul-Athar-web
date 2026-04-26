import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type AlertKind = "error" | "success" | "info";

const kindClass: Record<AlertKind, string> = {
  error: "message error",
  success: "message success",
  info: "message info",
};

export function AlertMessage({
  kind,
  children,
  className,
  role = "status",
}: {
  kind: AlertKind;
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  if (children == null || children === "") {
    return null;
  }
  return (
    <p className={cn(kindClass[kind], className)} role={role}>
      {children}
    </p>
  );
}
