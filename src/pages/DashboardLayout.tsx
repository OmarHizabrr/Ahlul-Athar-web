import { useEffect, useState, type ReactNode } from "react";
import { IoCloseOutline, IoMenuOutline } from "react-icons/io5";
import { NavLink, useLocation } from "react-router-dom";
import { DashboardTopBar } from "../components/DashboardTopBar";
import { useI18n } from "../context/I18nContext";
import type { UserRole } from "../types";

interface DashboardLayoutProps {
  role: UserRole;
  title: string;
  /** سطر توضيحي تحت العنوان (نفس الاستعمال في واجهة التطبيق) */
  lede?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ role, title, lede, children }: DashboardLayoutProps) {
  const { t } = useI18n();
  const base = role === "admin" ? "/admin" : "/student";
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

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
        <p className="badge">{role === "admin" ? t("web_pages.login.role_admin", "مسؤول") : t("web_pages.login.role_student", "طالب")}</p>
        <h3>{t("web_pages.nav.platform_title", "المنصة الموحدة")}</h3>
        <nav className="nav-list">
          <NavLink to={base} end onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
            {t("web_pages.nav.home", "الرئيسية")}
          </NavLink>
          {role === "admin" ? (
            <NavLink to="/admin/admins" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
              {t("web_pages.nav.admins", "المشرفون")}
            </NavLink>
          ) : null}
          {role === "admin" ? (
            <NavLink to="/admin/students" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
              {t("web_pages.nav.students", "الطلاب")}
            </NavLink>
          ) : null}
          <NavLink to={`${base}/courses`} onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
            {t("web_pages.nav.courses", "الدورات")}
          </NavLink>
          {role === "admin" ? (
            <NavLink to="/admin/folders" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
              {t("web_pages.nav.folders", "المجلدات")}
            </NavLink>
          ) : null}
          {role === "admin" ? (
            <NavLink to="/admin/enrollment-requests" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
              {t("web_pages.nav.enrollment_requests_admin", "طلبات الالتحاق")}
            </NavLink>
          ) : null}
          {role === "admin" ? (
            <NavLink to="/admin/contact" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
              {t("web_pages.nav.contact_admin", "إدارة التواصل")}
            </NavLink>
          ) : null}
          {role === "student" ? (
            <>
              <NavLink to="/student/mycourses" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
                {t("web_pages.nav.my_courses", "مقرراتي")}
              </NavLink>
              <NavLink to="/student/myfiles" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
                {t("web_pages.nav.my_files", "ملفاتي")}
              </NavLink>
              <NavLink to="/student/explore" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
                {t("web_pages.nav.explore", "الاستكشاف")}
              </NavLink>
              <NavLink to="/student/enrollment-requests" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
                {t("web_pages.nav.my_requests", "طلباتي")}
              </NavLink>
            </>
          ) : null}
          <NavLink to={`${base}/posts`} onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
            {t("web_pages.nav.posts", "المنشورات")}
          </NavLink>
          <NavLink to={`${base}/notifications`} onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
            {t("web_pages.nav.notifications", "الإشعارات")}
          </NavLink>
          <NavLink to={`${base}/settings`} onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
            {t("web_pages.nav.settings", "الإعدادات")}
          </NavLink>
          <NavLink to="/contact" onClick={() => setNavOpen(false)} className={({ isActive }) => (isActive ? "nav-link--active" : undefined)}>
            {t("web_pages.nav.contact_public", "تواصل معنا")}
          </NavLink>
        </nav>
        <p className="muted small sidebar-hint">{t("web_pages.nav.sidebar_hint", "الملف والجلسة من الشريط العلوي")}</p>
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
        </div>
        <DashboardTopBar role={role} />
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
