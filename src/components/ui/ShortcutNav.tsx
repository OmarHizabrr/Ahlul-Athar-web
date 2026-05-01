import { Link } from "react-router-dom";
import { useI18n } from "../../context/I18nContext";
import { cn } from "../../utils/cn";

export function ShortcutNav({
  items,
  className,
  "aria-label": ariaLabel,
}: {
  items: { to: string; label: string }[];
  className?: string;
  "aria-label"?: string;
}) {
  const { t } = useI18n();
  const label = ariaLabel ?? t("web_shell.shortcut_nav_aria", "اختصارات سريعة");
  return (
    <nav className={cn("home-shortcuts", "shortcut-nav", className)} aria-label={label}>
      {items.map((x) => (
        <Link key={`${x.to}-${x.label}`} to={x.to}>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
