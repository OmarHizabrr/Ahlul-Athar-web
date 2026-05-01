import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { IoChevronForward } from "react-icons/io5";
import { cn } from "../utils/cn";

export type SidebarIconTone = "blue" | "sky" | "green" | "amber" | "purple" | "rose" | "slate" | "indigo";

export function SidebarDrawerLink({
  to,
  end,
  icon,
  tone,
  title,
  subtitle,
  badge,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  tone: SidebarIconTone;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: number;
  onNavigate?: () => void;
}) {
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => cn("nav-drawer-link", isActive && "nav-drawer-link--active")}
    >
      <span className={cn("nav-drawer-ico", `nav-drawer-ico--${tone}`)} aria-hidden>
        {icon}
      </span>
      <span className="nav-drawer-body">
        <span className="nav-drawer-title">{title}</span>
        {subtitle ? <span className="nav-drawer-sub">{subtitle}</span> : null}
      </span>
      {showBadge ? <span className="nav-drawer-badge">{badge > 99 ? "99+" : badge}</span> : null}
      <IoChevronForward className="nav-drawer-chevron" aria-hidden />
    </NavLink>
  );
}
