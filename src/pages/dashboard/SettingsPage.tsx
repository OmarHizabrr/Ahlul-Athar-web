import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import { Panel } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { authService } from "../../services/authService";
import type { UserRole } from "../../types";

export function SettingsPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const base: "/admin" | "/student" = role === "admin" ? "/admin" : "/student";

  const logout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
      navigate("/role-selector", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout
        role={role}
        title="الإعدادات"
        lede="اختصارات للحساب والجلسة — تفاصيل الملف والخروج متاحة أيضاً من الشريط العلوي."
      >
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={role}
      title="الإعدادات"
      lede="اختصارات للحساب والجلسة — تفاصيل الملف والخروج متاحة أيضاً من الشريط العلوي."
    >
      <Panel className="settings-card">
        <ul className="settings-links">
          <li>
            <Link className="settings-link" to={`${base}/profile`}>
              الملف الشخصي وتعديل الاسم والجوال والصورة
            </Link>
          </li>
          <li>
            <Link className="settings-link" to={`${base}/courses`}>
              الدورات والكتالوج
            </Link>
          </li>
          {role === "student" ? (
            <li>
              <Link className="settings-link" to="/student/mycourses">
                مقرراتي المسجّل بها
              </Link>
            </li>
          ) : null}
          {role === "student" ? (
            <li>
              <Link className="settings-link" to="/student/enrollment-requests">
                طلبات انضمامي
              </Link>
            </li>
          ) : null}
          {role === "admin" ? (
            <li>
              <Link className="settings-link" to="/admin/enrollment-requests">
                طلبات الالتحاق (الإدارة)
              </Link>
            </li>
          ) : null}
          <li>
            <Link className="settings-link" to={`${base}/posts`}>
              المنشورات
            </Link>
          </li>
          <li>
            <Link className="settings-link" to={`${base}/notifications`}>
              الإشعارات
            </Link>
          </li>
        </ul>
      </Panel>
      <div className="settings-meta">
        <p className="muted small">
          الحساب: {user?.email || "—"} · الدور: {role === "admin" ? "مسؤول" : "طالب"}
        </p>
        <button
          type="button"
          className="ghost-btn settings-logout"
          onClick={() => void logout()}
          disabled={loggingOut}
          aria-busy={loggingOut}
        >
          <ButtonBusyLabel busy={loggingOut}>تسجيل الخروج</ButtonBusyLabel>
        </button>
      </div>
    </DashboardLayout>
  );
}
