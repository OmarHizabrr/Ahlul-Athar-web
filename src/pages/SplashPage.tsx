import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthPageShell } from "../components/AuthPageShell";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export function SplashPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();
  const { t } = useI18n();

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
      <section className="card splash-card" aria-busy="true" aria-label={t("common.loading", "جاري التحميل")}>
        <p className="badge">{t("web_shell.app_badge", "أهل الأثر")}</p>
        <div className="splash-page-spinner" aria-hidden>
          <span className="btn-spinner" />
        </div>
        <h1>{t("web_shell.auth_initializing", "جاري التهيئة...")}</h1>
        <p className="muted">{t("web_shell.splash_sync_account", "مزامنة الحساب مع نفس بيانات تطبيق الجوال")}</p>
      </section>
    </AuthPageShell>
  );
}
