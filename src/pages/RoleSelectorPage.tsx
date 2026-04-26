import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RoleSelectorPage() {
  const navigate = useNavigate();
  const { ready, user } = useAuth();

  useEffect(() => {
    if (ready && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [ready, user, navigate]);

  return (
    <main className="center-page">
      <section className="card">
        <p className="badge">Role Selector</p>
        <h1>اختر نوع الحساب</h1>
        <p className="muted">نفس تدفق تطبيق Flutter: طالب أو مسؤول.</p>

        <div className="grid-2">
          <button className="primary-btn" onClick={() => navigate("/login?role=student")}>
            دخول كطالب
          </button>
          <button className="ghost-btn" onClick={() => navigate("/login?role=admin")}>
            دخول كمسؤول
          </button>
        </div>
      </section>
    </main>
  );
}
