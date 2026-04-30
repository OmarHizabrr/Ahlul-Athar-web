import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { AuthPageShell } from "../components/AuthPageShell";
import { ButtonBusyLabel } from "../components/ButtonBusyLabel";
import { AlertMessage } from "../components/ui";
import { FcGoogle } from "react-icons/fc";
import { IoPhonePortraitOutline } from "react-icons/io5";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { authService } from "../services/authService";
import { adminSecurityService } from "../services/adminSecurityService";
import { userProfileService } from "../services/userProfileService";
import type { UserRole } from "../types";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ready, user: sessionUser } = useAuth();
  const { tr } = useI18n();
  const role = (searchParams.get("role") === "admin" ? "admin" : "student") as UserRole;
  const roleText = useMemo(() => (role === "admin" ? tr("مسؤول") : tr("طالب")), [role, tr]);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const showMessage = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  useEffect(() => {
    if (ready && sessionUser) {
      navigate(`/${sessionUser.role}`, { replace: true });
    }
  }, [ready, sessionUser, navigate]);

  const verifyAdminCodeIfNeeded = async (): Promise<boolean> => {
    if (role !== "admin") return true;
    if (!adminCode.trim()) {
      showMessage(tr("أدخل رمز دخول الإدارة."), true);
      return false;
    }
    const ok = await adminSecurityService.verifyAdminAccessCode(adminCode);
    if (!ok) {
      showMessage(tr("رمز دخول الإدارة غير صحيح."), true);
      return false;
    }
    return true;
  };

  const onGoogleLogin = async () => {
    setLoadingGoogle(true);
    showMessage("");
    try {
      const allowed = await verifyAdminCodeIfNeeded();
      if (!allowed) return;
      const user = await authService.signInWithGoogle(role);
      const profile = await userProfileService.getProfile(user.uid, user.role);
      if (!profile.profileCompleted || !profile.displayName.trim() || !profile.phoneNumber.trim()) {
        navigate(`/${user.role}/profile?complete=1`, { replace: true });
      } else {
        navigate(`/${user.role}`, { replace: true });
      }
    } catch (error) {
      showMessage(tr("فشل تسجيل الدخول عبر Google. تأكد من إعداد Firebase."), true);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const onPhoneLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingPhone(true);
    showMessage("");
    try {
      const allowed = await verifyAdminCodeIfNeeded();
      if (!allowed) return;
      const user = await authService.signInWithPhoneAndPassword(role, phone, password);
      const profile = await userProfileService.getProfile(user.uid, user.role);
      if (!profile.profileCompleted || !profile.displayName.trim() || !profile.phoneNumber.trim()) {
        navigate(`/${user.role}/profile?complete=1`, { replace: true });
      } else {
        navigate(`/${role}`, { replace: true });
      }
    } catch (error) {
      showMessage(tr("فشل تسجيل الدخول برقم الهاتف وكلمة المرور."), true);
    } finally {
      setLoadingPhone(false);
    }
  };

  return (
    <AuthPageShell>
      <section className="card">
        <p className="badge">{tr("أهل الأثر")}</p>
        <h1>{tr("تسجيل الدخول")} — {roleText}</h1>
        <p className="muted">{tr("نفس بيانات التطبيق: Google أو رقم الجوال وكلمة المرور المرتبطة بالحساب.")}</p>

        <button
          className="google-btn"
          onClick={onGoogleLogin}
          disabled={loadingGoogle || loadingPhone}
          aria-busy={loadingGoogle}
        >
          <FcGoogle size={24} />
          <span>
            <ButtonBusyLabel busy={loadingGoogle}>{tr("الدخول عبر Google")}</ButtonBusyLabel>
          </span>
        </button>

        <div className="separator">
          <span>{tr("أو")}</span>
        </div>

        <form className="form" onSubmit={onPhoneLogin}>
          {role === "admin" ? (
            <>
              <label htmlFor="admin-code">{tr("رمز دخول الإدارة")}</label>
              <input
                id="admin-code"
                type={showAdminCode ? "text" : "password"}
                placeholder={tr("أدخل رمز الإدارة")}
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
                required
              />
              <button type="button" className="ghost-btn" onClick={() => setShowAdminCode((v) => !v)} aria-label={tr("إظهار أو إخفاء رمز الإدارة")}>
                {showAdminCode ? <FiEyeOff /> : <FiEye />}
              </button>
              {/* <p className="muted small">الرمز الافتراضي: {DEFAULT_ADMIN_ACCESS_CODE}</p> */}
            </>
          ) : null}
          <label htmlFor="phone">{tr("رقم الهاتف")}</label>
          <div className="input-wrap">
            <IoPhonePortraitOutline size={20} />
            <input
              id="phone"
              type="tel"
              placeholder={tr("9665XXXXXXX")}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          <label htmlFor="password">{tr("كلمة المرور")}</label>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="button" className="ghost-btn" onClick={() => setShowPassword((v) => !v)} aria-label={tr("إظهار أو إخفاء كلمة المرور")}>
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>

          <button
            className="primary-btn"
            type="submit"
            disabled={loadingGoogle || loadingPhone}
            aria-busy={loadingPhone}
          >
            <ButtonBusyLabel busy={loadingPhone}>{tr("الدخول برقم الهاتف وكلمة المرور")}</ButtonBusyLabel>
          </button>
        </form>

        <button className="link-btn" onClick={() => navigate("/role-selector")}>
          {tr("تغيير نوع الحساب")}
        </button>

        {message ? (
          <AlertMessage kind={isError ? "error" : "success"} role="status" ariaLive="polite">
            {message}
          </AlertMessage>
        ) : null}
      </section>
    </AuthPageShell>
  );
}
