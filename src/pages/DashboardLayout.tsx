import { useEffect, useState, type ReactNode } from "react";
import { IoCloseOutline, IoMenuOutline } from "react-icons/io5";
import { Link, useLocation } from "react-router-dom";
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
  const { tr } = useI18n();
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
      <aside className="sidebar" aria-label={tr("قائمة التنقل")}>
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setNavOpen(false)}
            aria-label={tr("إغلاق القائمة")}
          >
            <IoCloseOutline size={24} />
          </button>
        </div>
        <p className="badge">{role === "admin" ? "Admin" : "Student"}</p>
        <h3>{tr("المنصة الموحدة")}</h3>
        <nav className="nav-list">
          <Link to={base} onClick={() => setNavOpen(false)}>
            {tr("الرئيسية")}
          </Link>
          {role === "admin" ? (
            <Link to="/admin/admins" onClick={() => setNavOpen(false)}>
              {tr("المشرفون")}
            </Link>
          ) : null}
          {role === "admin" ? (
            <Link to="/admin/students" onClick={() => setNavOpen(false)}>
              {tr("الطلاب")}
            </Link>
          ) : null}
          <Link to={`${base}/courses`} onClick={() => setNavOpen(false)}>
            {tr("الدورات")}
          </Link>
          {role === "admin" ? (
            <Link to="/admin/folders" onClick={() => setNavOpen(false)}>
              {tr("المجلدات")}
            </Link>
          ) : null}
          {role === "admin" ? (
            <Link to="/admin/enrollment-requests" onClick={() => setNavOpen(false)}>
              {tr("طلبات الالتحاق")}
            </Link>
          ) : null}
          {role === "student" ? (
            <>
              <Link to="/student/mycourses" onClick={() => setNavOpen(false)}>
                {tr("مقرراتي")}
              </Link>
              <Link to="/student/myfiles" onClick={() => setNavOpen(false)}>
                {tr("ملفاتي")}
              </Link>
              <Link to="/student/explore" onClick={() => setNavOpen(false)}>
                {tr("الاستكشاف")}
              </Link>
              <Link to="/student/enrollment-requests" onClick={() => setNavOpen(false)}>
                {tr("طلباتي")}
              </Link>
            </>
          ) : null}
          <Link to={`${base}/posts`} onClick={() => setNavOpen(false)}>
            {tr("المنشورات")}
          </Link>
          <Link to={`${base}/notifications`} onClick={() => setNavOpen(false)}>
            {tr("الإشعارات")}
          </Link>
          <Link to={`${base}/settings`} onClick={() => setNavOpen(false)}>
            {tr("الإعدادات")}
          </Link>
        </nav>
        <p className="muted small sidebar-hint">{tr("الملف والجلسة من الشريط العلوي")}</p>
      </aside>

      <div className="dashboard-main">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setNavOpen(true)}
            aria-label={tr("فتح القائمة")}
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
