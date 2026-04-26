import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
    <main className="center-page">
      <section className="card splash-card">
        <p className="badge">Ahlul Athar</p>
        <h1>جاري التحميل...</h1>
        <p>تجهيز المنصة الموحدة للويب والموبايل</p>
      </section>
    </main>
  );
}
