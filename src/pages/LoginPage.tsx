import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { IoPhonePortraitOutline } from "react-icons/io5";
import { authService } from "../services/authService";
import type { UserRole } from "../types";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = (searchParams.get("role") === "admin" ? "admin" : "student") as UserRole;
  const roleText = useMemo(() => (role === "admin" ? "مسؤول" : "طالب"), [role]);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const showMessage = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const onGoogleLogin = async () => {
    setLoadingGoogle(true);
    showMessage("");
    try {
      const user = await authService.signInWithGoogle(role);
      navigate(`/${user.role}`, { replace: true });
    } catch (error) {
      showMessage("فشل تسجيل الدخول عبر Google. تأكد من إعداد Firebase.", true);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const onPhoneLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingPhone(true);
    showMessage("");
    try {
      await authService.signInWithPhoneAndPassword(role, phone, password);
      navigate(`/${role}`, { replace: true });
    } catch (error) {
      showMessage("فشل تسجيل الدخول برقم الهاتف وكلمة المرور.", true);
    } finally {
      setLoadingPhone(false);
    }
  };

  return (
    <main className="center-page">
      <section className="card">
        <p className="badge">Login</p>
        <h1>تسجيل الدخول كـ {roleText}</h1>
        <p className="muted">بداية موحّدة مع التطبيق: Google أو رقم الهاتف + كلمة المرور.</p>

        <button className="google-btn" onClick={onGoogleLogin} disabled={loadingGoogle || loadingPhone}>
          <FcGoogle size={24} />
          <span>{loadingGoogle ? "جاري الدخول..." : "الدخول عبر Google"}</span>
        </button>

        <div className="separator">
          <span>أو</span>
        </div>

        <form className="form" onSubmit={onPhoneLogin}>
          <label htmlFor="phone">رقم الهاتف</label>
          <div className="input-wrap">
            <IoPhonePortraitOutline size={20} />
            <input
              id="phone"
              type="tel"
              placeholder="9665XXXXXXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button className="primary-btn" type="submit" disabled={loadingGoogle || loadingPhone}>
            {loadingPhone ? "جاري الدخول..." : "الدخول برقم الهاتف وكلمة المرور"}
          </button>
        </form>

        <button className="link-btn" onClick={() => navigate("/role-selector")}>
          تغيير نوع الحساب
        </button>

        {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
      </section>
    </main>
  );
}
