import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/** قائمة بطاقات عمودية — `course-list` */
export function ContentList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("course-list", "content-list", className)}>{children}</div>;
}

type ItemProps = {
  children: ReactNode;
  className?: string;
  as?: "article" | "div" | "section";
};

/** صف/بطاقة في قائمة المحتوى — `course-item` */
export function ContentListItem({ children, className, as: C = "article" }: ItemProps) {
  return <C className={cn("course-item", "content-list-item", className)}>{children}</C>;
}
