import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import type { UserRole } from "../types";

interface DashboardLayoutProps {
  role: UserRole;
  title: string;
  children: ReactNode;
}

export function DashboardLayout({ role, title, children }: DashboardLayoutProps) {
  const navigate = useNavigate();

  const logout = async () => {
    await authService.logout();
    navigate("/role-selector", { replace: true });
  };

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
          <Link to={`${base}/profile`}>الملف الشخصي</Link>
        </nav>
        <button className="ghost-btn" onClick={logout}>
          تسجيل الخروج
        </button>
      </aside>

      <section className="content">
        <div className="content-header">
          <h1>{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
