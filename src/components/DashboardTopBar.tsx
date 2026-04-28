import { useCallback, useEffect, useRef, useState } from "react";
import { IoChevronDown, IoNotificationsOutline } from "react-icons/io5";
import { Link, useNavigate } from "react-router-dom";
import { ButtonBusyLabel } from "./ButtonBusyLabel";
import { Avatar } from "./ui";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { coursesService } from "../services/coursesService";
import { notificationsService } from "../services/notificationsService";
import type { UserRole } from "../types";

export function DashboardTopBar({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
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
    const t = window.setInterval(() => void refreshUnread(), 60_000);
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
      window.clearInterval(t);
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
      navigate("/role-selector", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (!ready || !user) {
    return null;
  }

  const name = user.displayName || user.email || "مستخدم";
  const photo = user.photoURL;

  return (
    <header className="dashboard-topbar" dir="rtl">
      <div className="topbar-trailing">
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
                الملف الشخصي
              </Link>
              <Link
                to={`${base}/settings`}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                الإعدادات
              </Link>
              <Link
                to={`${base}/notifications`}
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                الإشعارات
              </Link>
              <button
                type="button"
                className="user-dropdown-item danger"
                role="menuitem"
                disabled={loggingOut}
                aria-busy={loggingOut}
                onClick={() => void onLogout()}
              >
                <ButtonBusyLabel busy={loggingOut}>تسجيل الخروج</ButtonBusyLabel>
              </button>
            </div>
          ) : null}
        </div>

        <Link
          to={`${base}/notifications`}
          className="topbar-notif-btn"
          title="الإشعارات"
          aria-label="الإشعارات"
        >
          <span className="topbar-notif-icon-wrap">
            <IoNotificationsOutline className="topbar-notif-icon" />
            {unread > 0 ? <span className="notif-badge">{unread > 99 ? "99+" : unread}</span> : null}
          </span>
        </Link>
        <Link
          to={role === "admin" ? "/admin/enrollment-requests" : "/student/enrollment-requests"}
          className="topbar-notif-btn"
          title={role === "admin" ? "طلبات الالتحاق" : "طلباتي"}
          aria-label={role === "admin" ? "طلبات الالتحاق" : "طلباتي"}
        >
          <span className="topbar-notif-icon-wrap topbar-notif-icon-wrap--text">
            <span className="topbar-mini-label">{role === "admin" ? "طلبات" : "طلباتي"}</span>
            {pendingEnrollments > 0 ? (
              <span className="notif-badge">{pendingEnrollments > 99 ? "99+" : pendingEnrollments}</span>
            ) : null}
          </span>
        </Link>
      </div>
    </header>
  );
}
