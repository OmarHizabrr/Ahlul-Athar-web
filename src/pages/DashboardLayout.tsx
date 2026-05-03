import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  IoBookOutline,
  IoCallOutline,
  IoChatbubblesOutline,
  IoClipboardOutline,
  IoCloseOutline,
  IoCompassOutline,
  IoFolderOpenOutline,
  IoGridOutline,
  IoHomeOutline,
  IoLogOutOutline,
  IoMailOutline,
  IoMenuOutline,
  IoNotificationsOutline,
  IoPeopleOutline,
  IoSchoolOutline,
  IoSettingsOutline,
} from "react-icons/io5";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IoChevronForwardOutline } from "react-icons/io5";
import { resolveDashboardBackHref } from "../utils/dashboardBackNavigation";
import { DashboardTopBar } from "../components/DashboardTopBar";
import { ButtonBusyLabel } from "../components/ButtonBusyLabel";
import { SidebarDrawerLink } from "../components/SidebarDrawerLink";
import { Avatar } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { authService } from "../services/authService";
import { notificationsService } from "../services/notificationsService";
import type { UserRole } from "../types";

interface DashboardLayoutProps {
  role: UserRole;
  title: string;
  /** سطر توضيحي تحت العنوان (نفس الاستعمال في واجهة التطبيق) */
  lede?: ReactNode;
  children: ReactNode;
  /** مسار صريح للرجوع، أو `null` لإخفاء زر الرجوع رغم الاكتشاف التلقائي */
  backTo?: string | null;
}

export function DashboardLayout({ role, title, lede, children, backTo }: DashboardLayoutProps) {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const base = role === "admin" ? "/admin" : "/student";
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const closeNav = () => setNavOpen(false);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      setUnreadNotif(await notificationsService.countUnread(user.uid));
    } catch {
      setUnreadNotif(0);
    }
  }, [user]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void refreshUnread();
    const onUpd = () => void refreshUnread();
    window.addEventListener("ah:notifications-updated", onUpd);
    const tmr = window.setInterval(() => void refreshUnread(), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refreshUnread();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("ah:notifications-updated", onUpd);
      window.clearInterval(tmr);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready, user, refreshUnread]);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const displayName = user?.displayName || user?.email || t("web_shell.topbar_user_fallback", "مستخدم");
  const photo = user?.photoURL;

  const backHref =
    backTo === null ? null : backTo ?? resolveDashboardBackHref(location.pathname, location.state);
  const backLabel = t("web_shell.dashboard_back_aria", "الرجوع للصفحة السابقة");

  return (
    <main className={navOpen ? "dashboard-page dashboard-page--nav-open" : "dashboard-page"}>
      {navOpen ? (
        <div
          className="sidebar-backdrop"
          role="presentation"
          aria-hidden
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className="sidebar" aria-label={t("web_pages.nav.nav_aria", "قائمة التنقل")}>
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setNavOpen(false)}
            aria-label={t("web_pages.nav.close_menu", "إغلاق القائمة")}
          >
            <IoCloseOutline size={24} />
          </button>
        </div>

        {ready && user ? (
          <Link to={`${base}/profile`} className="sidebar-profile-card" onClick={closeNav}>
            <Avatar
              photoURL={photo}
              displayName={user.displayName}
              email={user.email}
              imageClassName="sidebar-profile-avatar"
              fallbackClassName="sidebar-profile-avatar-fallback"
              size={52}
            />
            <div className="sidebar-profile-text">
              <span className="sidebar-profile-name">{displayName}</span>
              <span className="sidebar-role-badge">
                {role === "admin" ? t("web_pages.login.role_admin", "مسؤول") : t("web_pages.login.role_student", "طالب")}
              </span>
            </div>
          </Link>
        ) : null}

        <div className="nav-drawer-intro">
          <span className="nav-drawer-ico nav-drawer-ico--blue">
            <IoGridOutline size={22} />
          </span>
          <span className="nav-drawer-body">
            <span className="nav-drawer-title">{t("web_pages.nav.platform_title", "المنصة الموحدة")}</span>
            <span className="nav-drawer-sub">
              {t("web_pages.nav.platform_subtitle", "جميع أدواتك في مكان واحد")}
            </span>
          </span>
        </div>

        <nav className="nav-list nav-list--drawer">
          <SidebarDrawerLink
            to={base}
            end
            icon={<IoHomeOutline size={22} />}
            tone="blue"
            title={t("web_pages.nav.home", "الرئيسية")}
            onNavigate={closeNav}
          />
          {role === "admin" ? (
            <SidebarDrawerLink
              to="/admin/admins"
              icon={<IoPeopleOutline size={22} />}
              tone="indigo"
              title={t("web_pages.nav.admins", "المشرفون")}
              subtitle={t("web_pages.nav.admins_sub", "حسابات الفريق والصلاحيات")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "admin" ? (
            <SidebarDrawerLink
              to="/admin/students"
              icon={<IoSchoolOutline size={22} />}
              tone="green"
              title={t("web_pages.nav.students", "الطلاب")}
              subtitle={t("web_pages.nav.students_sub", "دليل الطلاب والوصول")}
              onNavigate={closeNav}
            />
          ) : null}
          <SidebarDrawerLink
            to={`${base}/courses`}
            icon={<IoBookOutline size={22} />}
            tone="sky"
            title={t("web_pages.nav.courses", "الدورات")}
            subtitle={t("web_pages.nav.courses_sub", "الكتالوج والدروس والاختبارات")}
            onNavigate={closeNav}
          />
          {role === "admin" ? (
            <SidebarDrawerLink
              to="/admin/folders"
              icon={<IoFolderOpenOutline size={22} />}
              tone="amber"
              title={t("web_pages.nav.folders", "المجلدات")}
              subtitle={t("web_pages.nav.folders_sub", "ملفات ومكتبة مشتركة")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "admin" ? (
            <SidebarDrawerLink
              to="/admin/enrollment-requests"
              icon={<IoClipboardOutline size={22} />}
              tone="green"
              title={t("web_pages.nav.enrollment_requests_admin", "طلبات الالتحاق")}
              subtitle={t("web_pages.nav.enrollment_requests_admin_sub", "مراجعة طلبات الانضمام والمقررات")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "admin" ? (
            <SidebarDrawerLink
              to="/admin/contact"
              icon={<IoMailOutline size={22} />}
              tone="purple"
              title={t("web_pages.nav.contact_admin", "إدارة التواصل")}
              subtitle={t("web_pages.nav.contact_admin_sub", "أرقام وواتساب وروابط للزوار")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "student" ? (
            <SidebarDrawerLink
              to="/student/mycourses"
              icon={<IoBookOutline size={22} />}
              tone="green"
              title={t("web_pages.nav.my_courses", "مقرراتي")}
              subtitle={t("web_pages.nav.my_courses_sub", "مقرراتك المسجّل بها")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "student" ? (
            <SidebarDrawerLink
              to="/student/myfiles"
              icon={<IoFolderOpenOutline size={22} />}
              tone="amber"
              title={t("web_pages.nav.my_files", "ملفاتي")}
              subtitle={t("web_pages.nav.my_files_sub", "المجلدات المشاركة معك")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "student" ? (
            <SidebarDrawerLink
              to="/student/explore"
              icon={<IoCompassOutline size={22} />}
              tone="purple"
              title={t("web_pages.nav.explore", "الاستكشاف")}
              subtitle={t("web_pages.nav.explore_sub", "اكتشف محتوى جديداً")}
              onNavigate={closeNav}
            />
          ) : null}
          {role === "student" ? (
            <SidebarDrawerLink
              to="/student/enrollment-requests"
              icon={<IoClipboardOutline size={22} />}
              tone="green"
              title={t("web_pages.nav.my_requests", "طلباتي")}
              subtitle={t("web_pages.nav.my_requests_sub", "طلبات الانضمام والمقررات")}
              onNavigate={closeNav}
            />
          ) : null}
          <SidebarDrawerLink
            to={`${base}/posts`}
            icon={<IoChatbubblesOutline size={22} />}
            tone="purple"
            title={t("web_pages.nav.posts", "المنشورات")}
            subtitle={t("web_pages.nav.posts_sub", "الأخبار والمقالات")}
            onNavigate={closeNav}
          />
          <SidebarDrawerLink
            to={`${base}/notifications`}
            icon={<IoNotificationsOutline size={22} />}
            tone="rose"
            title={t("web_pages.nav.notifications", "الإشعارات")}
            badge={unreadNotif}
            onNavigate={closeNav}
          />
          <SidebarDrawerLink
            to={`${base}/settings`}
            icon={<IoSettingsOutline size={22} />}
            tone="slate"
            title={t("web_pages.nav.settings", "الإعدادات")}
            subtitle={t("web_pages.nav.settings_sub", "الملف والجلسة من الشريط العلوي")}
            onNavigate={closeNav}
          />
          <SidebarDrawerLink
            to="/contact"
            icon={<IoCallOutline size={22} />}
            tone="sky"
            title={t("web_pages.nav.contact_public", "تواصل معنا")}
            onNavigate={closeNav}
          />
        </nav>

        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => void onLogout()}
          disabled={loggingOut}
          aria-busy={loggingOut}
        >
          <IoLogOutOutline size={22} aria-hidden />
          <ButtonBusyLabel busy={loggingOut}>{t("web_shell.topbar_logout", "تسجيل الخروج")}</ButtonBusyLabel>
        </button>
      </aside>

      <div className="dashboard-main">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setNavOpen(true)}
            aria-label={t("web_pages.nav.open_menu", "فتح القائمة")}
            aria-expanded={navOpen}
          >
            <IoMenuOutline size={28} />
          </button>
          {backHref ? (
            <Link to={backHref} className="mobile-back-btn" aria-label={backLabel} title={backLabel}>
              <IoChevronForwardOutline size={26} aria-hidden />
            </Link>
          ) : null}
        </div>
        <DashboardTopBar role={role} backHref={backHref} backLabel={backLabel} />
        <section className="content">
          <div className="content-header">
            <h1>{title}</h1>
            {lede != null && lede !== false ? <p className="content-lede muted">{lede}</p> : null}
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
