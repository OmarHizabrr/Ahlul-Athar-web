import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/**
 * بلاطة إحصاء في الشبكة (الرئيسية وغيرها) — تنسيق `card-stat` + `stat-tile`.
 */
export function StatTile({
  title,
  highlight,
  children,
  action,
  wide,
  className,
}: {
  title: string;
  /** الرقم الكبير أو المقياس الرئيسي */
  highlight?: ReactNode;
  children?: ReactNode;
  /** رابط أو زر سفلي */
  action?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("card-stat", "stat-tile", wide && "stat-tile-wide", className)}
    >
      <strong>{title}</strong>
      {highlight != null && highlight !== false ? <span className="stat-num">{highlight}</span> : null}
      {children}
      {action}
    </div>
  );
}
