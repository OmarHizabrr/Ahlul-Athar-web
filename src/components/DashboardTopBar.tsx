import { useCallback, useEffect, useRef, useState } from "react";
import { IoChevronDown, IoChevronForwardOutline, IoNotificationsOutline } from "react-icons/io5";
import { Link, useNavigate } from "react-router-dom";
import { ButtonBusyLabel } from "./ButtonBusyLabel";
import { Avatar } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { authService } from "../services/authService";
import { coursesService } from "../services/coursesService";
import { notificationsService } from "../services/notificationsService";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { UserRole } from "../types";

const S = "web_shell" as const;

export function DashboardTopBar({
  role,
  backHref,
  backLabel,
}: {
  role: UserRole;
  backHref?: string | null;
  backLabel?: string;
}) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const base = role === "admin" ? "/admin" : "/student";
  const [unread, setUnread] = useState(0);
  const [pendingEnrollments, setPendingEnrollments] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const n = await notificationsService.countUnread(user.uid);
      setUnread(n);
    } catch {
      setUnread(0);
    }
  }, [user]);

  const refreshPendingEnrollments = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      if (role === "admin") {
        const pending = await coursesService.listAnyEnrollmentRequests({ status: "pending", type: "all" });
        setPendingEnrollments(pending.length);
      } else {
        const mine = await coursesService.listStudentEnrollmentRequests(user.uid);
        setPendingEnrollments(mine.filter((r) => r.status === "pending").length);
      }
    } catch {
      setPendingEnrollments(0);
    }
  }, [role, user]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void refreshUnread();
    void refreshPendingEnrollments();
    const tmr = window.setInterval(() => void refreshUnread(), 60_000);
    const tReq = window.setInterval(() => void refreshPendingEnrollments(), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refreshUnread();
      }
    };
    const onNotifUpdated = () => void refreshUnread();
    const onEnrollmentUpdated = () => void refreshPendingEnrollments();
    window.addEventListener("ah:notifications-updated", onNotifUpdated);
    window.addEventListener("ah:enrollment-requests-updated", onEnrollmentUpdated);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("ah:notifications-updated", onNotifUpdated);
      window.removeEventListener("ah:enrollment-requests-updated", onEnrollmentUpdated);
      window.clearInterval(tmr);
      window.clearInterval(tReq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready, user, refreshUnread, refreshPendingEnrollments]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onLogout = async () => {
    setMenuOpen(false);
    setLoggingOut(true);
    try {
      await authService.logout();
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (!ready || !user) {
    return null;
  }

  const name = user.displayName || user.email || t(`${S}.topbar_user_fallback`, "مستخدم");
  const photo = user.photoURL;

  const showBack = Boolean(backHref);
  const backAria = backLabel ?? t(`${S}.dashboard_back_aria`, "الرجوع للصفحة السابقة");

  return (
    <header className={showBack ? "dashboard-topbar dashboard-topbar--has-back" : "dashboard-topbar"}>
      {showBack && backHref ? (
        <div className="topbar-leading">
          <Link to={backHref} className="topbar-back-btn" aria-label={backAria} title={backAria}>
            <IoChevronForwardOutline className="topbar-back-icon" aria-hidden size={22} />
            <span className="topbar-back-text">{t(`${S}.dashboard_back`, "رجوع")}</span>
          </Link>
        </div>
      ) : null}
      <div className="topbar-trailing">
        <div className="topbar-trailing-scroll">
          <label className="theme-switcher" title={t(`${S}.topbar_theme`, "المظهر")}>
            <span className="theme-switcher-label">{t(`${S}.topbar_theme`, "المظهر")}</span>
            <select
              className="theme-switcher-select"
              value={mode}
              onChange={(e) => setMode(e.target.value as "light" | "dark" | "system")}
              aria-label={t(`${S}.topbar_theme_aria`, "تبديل المظهر")}
            >
              <option value="system">{t(`${S}.theme_system`, "تلقائي")}</option>
              <option value="dark">{t(`${S}.theme_dark`, "ليلي")}</option>
              <option value="light">{t(`${S}.theme_light`, "نهاري")}</option>
            </select>
          </label>
          <LanguageSwitcher />
        </div>

        <div className="user-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="user-menu-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <Avatar
              photoURL={photo}
              displayName={user.displayName}
              email={user.email}
              imageClassName="user-avatar topbar-avatar"
              fallbackClassName="user-avatar-fallback topbar-avatar"
              size={40}
            />
            <span className="user-menu-name">{name}</span>
            <IoChevronDown className="user-menu-chevron" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="user-dropdown" role="menu">
              <Link
                to={`${base}/profile`}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                {t(`${S}.topbar_profile`, "الملف الشخصي")}
              </Link>
              <Link
                to={`${base}/settings`}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                {t(`${S}.topbar_settings`, "الإعدادات")}
              </Link>
              <Link
                to={`${base}/notifications`}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                {t(`${S}.topbar_notifications`, "الإشعارات")}
              </Link>
              <button
                type="button"
                className="user-dropdown-item danger"
                role="menuitem"
                disabled={loggingOut}
                aria-busy={loggingOut}
                onClick={() => void onLogout()}
              >
                <ButtonBusyLabel busy={loggingOut}>{t(`${S}.topbar_logout`, "تسجيل الخروج")}</ButtonBusyLabel>
              </button>
            </div>
          ) : null}
        </div>

        <Link
          to={`${base}/notifications`}
          className="topbar-notif-btn"
          title={t(`${S}.topbar_notifications`, "الإشعارات")}
          aria-label={t(`${S}.topbar_notifications`, "الإشعارات")}
        >
          <span className="topbar-notif-icon-wrap">
            <IoNotificationsOutline className="topbar-notif-icon" />
            {unread > 0 ? <span className="notif-badge">{unread > 99 ? "99+" : unread}</span> : null}
          </span>
        </Link>
        <Link
          to={role === "admin" ? "/admin/enrollment-requests" : "/student/enrollment-requests"}
          className="topbar-notif-btn"
          title={
            role === "admin"
              ? t(`${S}.topbar_enrollment_requests`, "طلبات الالتحاق")
              : t(`${S}.topbar_my_requests`, "طلباتي")
          }
          aria-label={
            role === "admin"
              ? t(`${S}.topbar_enrollment_requests`, "طلبات الالتحاق")
              : t(`${S}.topbar_my_requests`, "طلباتي")
          }
        >
          <span className="topbar-notif-icon-wrap topbar-notif-icon-wrap--text">
            <span className="topbar-mini-label">
              {role === "admin"
                ? t(`${S}.topbar_requests_badge`, "طلبات")
                : t(`${S}.topbar_my_requests_badge`, "طلباتي")}
            </span>
            {pendingEnrollments > 0 ? (
              <span className="notif-badge">{pendingEnrollments > 99 ? "99+" : pendingEnrollments}</span>
            ) : null}
          </span>
        </Link>
      </div>
    </header>
  );
}
