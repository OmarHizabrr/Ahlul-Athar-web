import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { AuthPageShell } from "../components/AuthPageShell";
import { ButtonBusyLabel } from "../components/ButtonBusyLabel";
import { AlertMessage } from "../components/ui";
import { FcGoogle } from "react-icons/fc";
import { IoPhonePortraitOutline, IoSchoolOutline, IoShieldCheckmarkOutline, IoTimeOutline } from "react-icons/io5";
import { FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { authService } from "../services/authService";
import { adminSecurityService } from "../services/adminSecurityService";
import { userProfileService } from "../services/userProfileService";
import type { UserRole } from "../types";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { ready, user: sessionUser } = useAuth();
  const { t } = useI18n();
  const role = (searchParams.get("role") === "admin" ? "admin" : "student") as UserRole;
  const roleText = useMemo(
    () => (role === "admin" ? t("web_pages.login.role_admin", "مسؤول") : t("web_pages.login.role_student", "طالب")),
    [role, t],
  );

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
      showMessage(t("web_pages.login.err_admin_code_required", "أدخل رمز دخول الإدارة."), true);
      return false;
    }
    const ok = await adminSecurityService.verifyAdminAccessCode(adminCode);
    if (!ok) {
      showMessage(t("web_pages.login.err_admin_code_invalid", "رمز دخول الإدارة غير صحيح."), true);
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
      showMessage(t("web_pages.login.err_google", "فشل تسجيل الدخول عبر Google. تأكد من إعداد Firebase."), true);
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
      showMessage(t("web_pages.login.err_phone", "فشل تسجيل الدخول برقم الهاتف وكلمة المرور."), true);
    } finally {
      setLoadingPhone(false);
    }
  };

  return (
    <AuthPageShell>
      <section className="card">
        <div className="auth-title-block">
          <h1 className="auth-title">{t("web_pages.login.title", "تسجيل الدخول")}</h1>
          <p className="auth-role-line">{roleText}</p>
        </div>
        <div className="auth-divider" aria-hidden>
          <span className="auth-divider-icon">◆</span>
        </div>
        <p className="muted">{t("web_pages.login.subtitle", "نفس بيانات التطبيق: Google أو رقم الجوال وكلمة المرور المرتبطة بالحساب.")}</p>

        <button
          className="google-btn"
          onClick={onGoogleLogin}
          disabled={loadingGoogle || loadingPhone}
          aria-busy={loadingGoogle}
        >
          <FcGoogle size={24} />
          <span>
            <ButtonBusyLabel busy={loadingGoogle}>{t("web_pages.login.google", "الدخول عبر Google")}</ButtonBusyLabel>
          </span>
        </button>

        <div className="separator">
          <span>{t("web_pages.login.or", "أو")}</span>
        </div>

        <form className="form" onSubmit={onPhoneLogin}>
          {role === "admin" ? (
            <>
              <label htmlFor="admin-code">{t("web_pages.login.admin_code_label", "رمز دخول الإدارة")}</label>
              <input
                id="admin-code"
                type={showAdminCode ? "text" : "password"}
                placeholder={t("web_pages.login.admin_code_placeholder", "أدخل رمز الإدارة")}
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
                required
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowAdminCode((v) => !v)}
                aria-label={t("web_pages.login.toggle_admin_code_aria", "إظهار أو إخفاء رمز الإدارة")}
              >
                {showAdminCode ? <FiEyeOff /> : <FiEye />}
              </button>
            </>
          ) : null}
          <label htmlFor="phone">{t("common.phone_number", "رقم الهاتف")}</label>
          <div className="input-wrap">
            <IoPhonePortraitOutline size={20} />
            <input
              id="phone"
              type="tel"
              placeholder={t("web_pages.login.phone_placeholder_sample", "9665XXXXXXX")}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          <label htmlFor="password">{t("web_pages.login.password_label", "كلمة المرور")}</label>
          <div className="input-wrap">
            <FiLock size={18} aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("web_pages.login.password_placeholder_dots", "••••••••")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button
            type="button"
            className="auth-show-password"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={t("web_pages.login.toggle_password_aria", "إظهار أو إخفاء كلمة المرور")}
          >
            {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            {showPassword
              ? t("web_pages.login.hide_password", "إخفاء كلمة المرور")
              : t("web_pages.login.show_password", "عرض كلمة المرور")}
          </button>

          <button className="primary-btn" type="submit" disabled={loadingGoogle || loadingPhone} aria-busy={loadingPhone}>
            <ButtonBusyLabel busy={loadingPhone}>{t("web_pages.login.submit_phone", "الدخول برقم الهاتف وكلمة المرور")}</ButtonBusyLabel>
          </button>
        </form>

        <button className="link-btn" onClick={() => navigate("/role-selector")}>
          {t("web_pages.login.change_account_type", "تغيير نوع الحساب")}
        </button>

        <ul className="auth-trust-row" aria-label={t("web_pages.login.trust_aria", "مميزات المنصة")}>
          <li className="auth-trust-item">
            <IoSchoolOutline aria-hidden />
            <span>{t("web_pages.login.trust_learning", "تعلم مستمر")}</span>
          </li>
          <li className="auth-trust-item">
            <IoTimeOutline aria-hidden />
            <span>{t("web_pages.login.trust_fast", "دخول سريع")}</span>
          </li>
          <li className="auth-trust-item">
            <IoShieldCheckmarkOutline aria-hidden />
            <span>{t("web_pages.login.trust_secure", "آمن وموثوق")}</span>
          </li>
        </ul>

        <p className="auth-footer-help">
          {t("web_pages.login.help_lead", "تحتاج مساعدة؟ تواصل معنا وسنساعدك في أي وقت —")}{" "}
          <Link to="/contact" className="auth-footer-help-link">
            {t("web_pages.login.help_cta", "تواصل معنا")}
          </Link>
        </p>

        {message ? (
          <AlertMessage kind={isError ? "error" : "success"} role="status" ariaLive="polite">
            {message}
          </AlertMessage>
        ) : null}
      </section>
    </AuthPageShell>
  );
}
