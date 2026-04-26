import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function WelcomeHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("home-welcome", "welcome-heading", className)}>{children}</p>;
}
