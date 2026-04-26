import { useEffect, useState, type ReactNode } from "react";
import { IoCloseOutline, IoMenuOutline } from "react-icons/io5";
import { Link, useLocation } from "react-router-dom";
import { DashboardTopBar } from "../components/DashboardTopBar";
import type { UserRole } from "../types";

interface DashboardLayoutProps {
  role: UserRole;
  title: string;
  /** سطر توضيحي تحت العنوان (نفس الاستعمال في واجهة التطبيق) */
  lede?: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ role, title, lede, children }: DashboardLayoutProps) {
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
      <aside className="sidebar" aria-label="قائمة التنقل">
        <div className="sidebar-top">
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setNavOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <IoCloseOutline size={24} />
          </button>
        </div>
        <p className="badge">{role === "admin" ? "Admin" : "Student"}</p>
        <h3>المنصة الموحدة</h3>
        <nav className="nav-list">
          <Link to={base} onClick={() => setNavOpen(false)}>
            الرئيسية
          </Link>
          <Link to={`${base}/courses`} onClick={() => setNavOpen(false)}>
            الدورات
          </Link>
          {role === "student" ? (
            <>
              <Link to="/student/mycourses" onClick={() => setNavOpen(false)}>
                مقرراتي
              </Link>
              <Link to="/student/enrollment-requests" onClick={() => setNavOpen(false)}>
                طلباتي
              </Link>
            </>
          ) : null}
          <Link to={`${base}/posts`} onClick={() => setNavOpen(false)}>
            المنشورات
          </Link>
          <Link to={`${base}/notifications`} onClick={() => setNavOpen(false)}>
            الإشعارات
          </Link>
          <Link to={`${base}/settings`} onClick={() => setNavOpen(false)}>
            الإعدادات
          </Link>
        </nav>
        <p className="muted small sidebar-hint">الملف والجلسة من الشريط العلوي</p>
      </aside>

      <div className="dashboard-main">
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setNavOpen(true)}
            aria-label="فتح القائمة"
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
