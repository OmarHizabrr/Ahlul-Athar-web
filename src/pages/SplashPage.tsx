import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthPageShell } from "../components/AuthPageShell";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export function SplashPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();
  const { tr } = useI18n();

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
      <section className="card splash-card" aria-busy="true" aria-label={tr("جاري التحميل")}>
        <p className="badge">{tr("أهل الأثر")}</p>
        <div className="splash-page-spinner" aria-hidden>
          <span className="btn-spinner" />
        </div>
        <h1>{tr("جاري التهيئة...")}</h1>
        <p className="muted">{tr("مزامنة الحساب مع نفس بيانات تطبيق الجوال")}</p>
      </section>
    </AuthPageShell>
  );
}
