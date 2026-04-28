import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthPageShell } from "../components/AuthPageShell";
import { useAuth } from "../context/AuthContext";

export function SplashPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (!ready) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (!user) {
        navigate("/role-selector", { replace: true });
        return;
      }
      navigate(`/${user.role}`, { replace: true });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [ready, user, navigate]);

  return (
    <AuthPageShell>
      <section className="card splash-card" aria-busy="true" aria-label="جاري التحميل">
        <p className="badge">أهل الأثر</p>
        <div className="splash-page-spinner" aria-hidden>
          <span className="btn-spinner" />
        </div>
        <h1>جاري التهيئة...</h1>
        <p className="muted">مزامنة الحساب مع نفس بيانات تطبيق الجوال</p>
      </section>
    </AuthPageShell>
  );
}
