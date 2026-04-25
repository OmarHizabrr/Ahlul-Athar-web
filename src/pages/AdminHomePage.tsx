import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

export function AdminHomePage() {
  const navigate = useNavigate();
  const user = authService.getLocalUser();

  const logout = async () => {
    await authService.logout();
    navigate("/role-selector", { replace: true });
  };

  return (
    <main className="center-page">
      <section className="card">
        <p className="badge">Admin Main Scaffold</p>
        <h1>مرحبًا {user?.displayName || "Admin"}</h1>
        <p className="muted">هذه الصفحة الأساسية للمسؤول كبداية، ثم سنربط كل شاشات الإدارة.</p>

        <div className="grid-2">
          <div className="mini-card">إدارة الدورات</div>
          <div className="mini-card">إدارة الطلاب</div>
          <div className="mini-card">إدارة المنشورات</div>
          <div className="mini-card">إعدادات المنصة</div>
        </div>

        <button className="ghost-btn" onClick={logout}>
          تسجيل الخروج
        </button>
      </section>
    </main>
  );
}
