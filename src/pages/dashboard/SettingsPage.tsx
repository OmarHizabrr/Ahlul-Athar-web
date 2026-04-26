import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { authService } from "../../services/authService";
import type { UserRole } from "../../types";

export function SettingsPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const base: "/admin" | "/student" = role === "admin" ? "/admin" : "/student";

  const logout = async () => {
    await authService.logout();
    navigate("/role-selector", { replace: true });
  };

  if (!ready) {
    return (
      <DashboardLayout
        role={role}
        title="الإعدادات"
        lede="اختصارات للحساب والجلسة — تفاصيل الملف والخروج متاحة أيضاً من الشريط العلوي."
      >
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={role}
      title="الإعدادات"
      lede="اختصارات للحساب والجلسة — تفاصيل الملف والخروج متاحة أيضاً من الشريط العلوي."
    >
      <ul className="settings-links">
        <li>
          <Link className="settings-link" to={`${base}/profile`}>
            الملف الشخصي وتعديل الاسم والجوال والصورة
          </Link>
        </li>
        <li>
          <Link className="settings-link" to={`${base}/notifications`}>
            الإشعارات
          </Link>
        </li>
      </ul>
      <div className="settings-meta">
        <p className="muted small">
          الحساب: {user?.email || "—"} · الدور: {role === "admin" ? "مسؤول" : "طالب"}
        </p>
        <button type="button" className="ghost-btn settings-logout" onClick={() => void logout()}>
          تسجيل الخروج
        </button>
      </div>
    </DashboardLayout>
  );
}
