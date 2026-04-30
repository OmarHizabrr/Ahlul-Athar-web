import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthPageShell } from "../components/AuthPageShell";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export function RoleSelectorPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();
  const { tr } = useI18n();

  useEffect(() => {
    if (ready && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [ready, user, navigate]);

  if (!ready) {
    return (
      <AuthPageShell>
        <section className="card">
          <p className="badge">{tr("أهل الأثر")}</p>
          <PageLoadHint text={tr("جاري التهيئة...")} />
        </section>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <section className="card">
        <p className="badge">{tr("أهل الأثر")}</p>
        <h1>{tr("اختر نوع الحساب")}</h1>
        <p className="muted">{tr("نفس تدفق تطبيق الجوال: طالب أو مسؤول، ثم تسجيل الدخول.")}</p>

        <div className="grid-2">
          <button className="primary-btn" onClick={() => navigate("/login?role=student")}>
            {tr("دخول كطالب")}
          </button>
          <button className="ghost-btn" onClick={() => navigate("/login?role=admin")}>
            {tr("دخول كمسؤول")}
          </button>
        </div>
      </section>
    </AuthPageShell>
  );
}
