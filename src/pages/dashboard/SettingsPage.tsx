import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import { AlertMessage } from "../../components/ui";
import { Panel } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { DashboardLayout } from "../DashboardLayout";
import { authService } from "../../services/authService";
import { adminSecurityService, DEFAULT_ADMIN_ACCESS_CODE } from "../../services/adminSecurityService";
import type { UserRole } from "../../types";

export function SettingsPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminCode, setAdminCode] = useState(DEFAULT_ADMIN_ACCESS_CODE);
  const [loadingCode, setLoadingCode] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const base: "/admin" | "/student" = role === "admin" ? "/admin" : "/student";

  useEffect(() => {
    if (role !== "admin" || !ready) return;
    void (async () => {
      setLoadingCode(true);
      try {
        const code = await adminSecurityService.getAdminAccessCode();
        setAdminCode(code);
      } catch {
        setCodeMessage(tr("تعذر تحميل رمز الإدارة الحالي، سيتم استخدام الافتراضي."));
        setCodeError(true);
      } finally {
        setLoadingCode(false);
      }
    })();
  }, [role, ready]);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
      navigate("/role-selector", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const saveAdminCode = async () => {
    if (!user?.uid) return;
    const value = adminCode.trim();
    if (!value) {
      setCodeError(true);
      setCodeMessage(tr("رمز الإدارة مطلوب."));
      return;
    }
    setSavingCode(true);
    setCodeMessage(null);
    try {
      await adminSecurityService.updateAdminAccessCode(value, user.uid);
      setCodeError(false);
      setCodeMessage(tr("تم حفظ رمز دخول الإدارة بنجاح."));
    } catch {
      setCodeError(true);
      setCodeMessage(tr("تعذر حفظ رمز الإدارة حالياً."));
    } finally {
      setSavingCode(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout
        role={role}
        title={tr("الإعدادات")}
        lede={tr("اختصارات للحساب والجلسة — تفاصيل الملف والخروج متاحة أيضاً من الشريط العلوي.")}
      >
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={role}
      title={tr("الإعدادات")}
      lede={tr("اختصارات للحساب والجلسة — تفاصيل الملف والخروج متاحة أيضاً من الشريط العلوي.")}
    >
      <Panel className="settings-card">
        <ul className="settings-links">
          <li>
            <Link className="settings-link" to={`${base}/profile`}>
              {tr("الملف الشخصي وتعديل الاسم والجوال والصورة")}
            </Link>
          </li>
          <li>
            <Link className="settings-link" to={`${base}/courses`}>
              {tr("الدورات والكتالوج")}
            </Link>
          </li>
          {role === "student" ? (
            <li>
              <Link className="settings-link" to="/student/mycourses">
                {tr("مقرراتي المسجّل بها")}
              </Link>
            </li>
          ) : null}
          {role === "student" ? (
            <li>
              <Link className="settings-link" to="/student/enrollment-requests">
                {tr("طلبات انضمامي")}
              </Link>
            </li>
          ) : null}
          {role === "admin" ? (
            <li>
              <Link className="settings-link" to="/admin/enrollment-requests">
                {tr("طلبات الالتحاق (الإدارة)")}
              </Link>
            </li>
          ) : null}
          <li>
            <Link className="settings-link" to={`${base}/posts`}>
              {tr("المنشورات")}
            </Link>
          </li>
          <li>
            <Link className="settings-link" to={`${base}/notifications`}>
              {tr("الإشعارات")}
            </Link>
          </li>
        </ul>
      </Panel>
      {role === "admin" ? (
        <Panel className="settings-card">
          <h3 style={{ marginTop: 0 }}>{tr("أمان الإدارة")}</h3>
          <p className="muted small">{tr("رمز دخول الأدمن مطلوب عند تسجيل الدخول كمسؤول. الرمز الافتراضي:")} {DEFAULT_ADMIN_ACCESS_CODE}</p>
          {loadingCode ? <PageLoadHint text={tr("جاري تحميل رمز الإدارة...")} /> : null}
          <div className="form" style={{ marginTop: "0.75rem" }}>
            <label htmlFor="admin-access-code">{tr("رمز دخول الإدارة")}</label>
            <input
              id="admin-access-code"
              type={showAdminCode ? "text" : "password"}
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder={tr("أدخل الرمز الجديد")}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowAdminCode((v) => !v)}
              aria-label={tr("إظهار أو إخفاء رمز الإدارة")}
            >
              {showAdminCode ? <FiEyeOff /> : <FiEye />}
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void saveAdminCode()}
              disabled={savingCode || loadingCode}
              aria-busy={savingCode}
            >
              <ButtonBusyLabel busy={savingCode}>{tr("حفظ رمز الإدارة")}</ButtonBusyLabel>
            </button>
          </div>
          {codeMessage ? <AlertMessage kind={codeError ? "error" : "success"}>{codeMessage}</AlertMessage> : null}
        </Panel>
      ) : null}
      <div className="settings-meta">
        <p className="muted small">
          {tr("الحساب")}: {user?.email || tr("—")} · {tr("الدور")}: {role === "admin" ? tr("مسؤول") : tr("طالب")}
        </p>
        <button
          type="button"
          className="ghost-btn settings-logout"
          onClick={() => void logout()}
          disabled={loggingOut}
          aria-busy={loggingOut}
        >
          <ButtonBusyLabel busy={loggingOut}>{tr("تسجيل الخروج")}</ButtonBusyLabel>
        </button>
      </div>
    </DashboardLayout>
  );
}
