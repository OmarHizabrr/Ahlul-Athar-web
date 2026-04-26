import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";

export function ShortcutNav({
  items,
  className,
  "aria-label": ariaLabel = "اختصارات سريعة",
}: {
  items: { to: string; label: string }[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <nav className={cn("home-shortcuts", "shortcut-nav", className)} aria-label={ariaLabel}>
      {items.map((x) => (
        <Link key={`${x.to}-${x.label}`} to={x.to}>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
