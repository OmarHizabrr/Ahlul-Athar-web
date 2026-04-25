import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

export function StudentHomePage() {
  const navigate = useNavigate();
  const user = authService.getLocalUser();

  const logout = async () => {
    await authService.logout();
    navigate("/role-selector", { replace: true });
  };

  return (
    <main className="center-page">
      <section className="card">
        <p className="badge">Student Main Scaffold</p>
        <h1>أهلًا {user?.displayName || "Student"}</h1>
        <p className="muted">هذه الصفحة الأساسية للطالب كبداية، ثم سنكمل بقية صفحات التطبيق مطابقًا لFlutter.</p>

        <div className="grid-2">
          <div className="mini-card">الدورات المسجل بها</div>
          <div className="mini-card">الدروس والمرفقات</div>
          <div className="mini-card">الاختبارات والنتائج</div>
          <div className="mini-card">المنشورات والإشعارات</div>
        </div>

        <button className="ghost-btn" onClick={logout}>
          تسجيل الخروج
        </button>
      </section>
    </main>
  );
}
