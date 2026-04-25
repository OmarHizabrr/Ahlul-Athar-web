import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

export function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      const user = authService.getLocalUser();
      if (!user) {
        navigate("/role-selector", { replace: true });
        return;
      }
      navigate(`/${user.role}`, { replace: true });
    }, 800);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="center-page">
      <section className="card splash-card">
        <p className="badge">AlMosawa Platform</p>
        <h1>جاري التحميل...</h1>
        <p>تجهيز المنصة الموحدة للويب والموبايل</p>
      </section>
    </main>
  );
}
