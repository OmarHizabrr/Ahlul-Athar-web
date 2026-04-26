import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DashboardTopBar } from "../components/DashboardTopBar";
import type { UserRole } from "../types";

interface DashboardLayoutProps {
  role: UserRole;
  title: string;
  children: ReactNode;
}

export function DashboardLayout({ role, title, children }: DashboardLayoutProps) {
  const base = role === "admin" ? "/admin" : "/student";

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <p className="badge">{role === "admin" ? "Admin" : "Student"}</p>
        <h3>المنصة الموحدة</h3>
        <nav className="nav-list">
          <Link to={base}>الرئيسية</Link>
          <Link to={`${base}/courses`}>الدورات</Link>
          {role === "student" ? <Link to="/student/mycourses">مقرراتي</Link> : null}
          <Link to={`${base}/posts`}>المنشورات</Link>
          <Link to={`${base}/notifications`}>الإشعارات</Link>
          <Link to={`${base}/settings`}>الإعدادات</Link>
        </nav>
        <p className="muted small sidebar-hint">الملف والجلسة من الشريط العلوي</p>
      </aside>

      <div className="dashboard-main">
        <DashboardTopBar role={role} />
        <section className="content">
          <div className="content-header">
            <h1>{title}</h1>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
