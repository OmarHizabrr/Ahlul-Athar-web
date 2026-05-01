import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthPageShell } from "../components/AuthPageShell";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export function RoleSelectorPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (ready && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [ready, user, navigate]);

  if (!ready) {
    return (
      <AuthPageShell>
        <section className="card">
          <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
        </section>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <section className="card">
        <div className="auth-title-block">
          <h1 className="auth-title">{t("web_shell.role_selector_title", "اختر نوع الحساب")}</h1>
        </div>
        <div className="auth-divider" aria-hidden>
          <span className="auth-divider-icon">◆</span>
        </div>
        <p className="muted">{t("web_shell.role_selector_subtitle", "نفس تدفق تطبيق الجوال: طالب أو مسؤول، ثم تسجيل الدخول.")}</p>

        <div className="grid-2">
          <button className="primary-btn" onClick={() => navigate("/login?role=student")}>
            {t("web_shell.login_as_student", "دخول كطالب")}
          </button>
          <button className="ghost-btn" onClick={() => navigate("/login?role=admin")}>
            {t("web_shell.login_as_admin", "دخول كمسؤول")}
          </button>
        </div>

        <p className="auth-footer-help role-selector-help">
          {t("web_shell.role_selector_help_lead", "تحتاج مساعدة قبل الدخول؟")}{" "}
          <Link to="/contact" className="auth-footer-help-link">
            {t("web_pages.login.help_cta", "تواصل معنا")}
          </Link>
        </p>
      </section>
    </AuthPageShell>
  );
}
