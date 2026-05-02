import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { cn } from "../utils/cn";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * غلاف للصفحات العامّة (سيلز، الدور، الدخول) مع شعار، تبديل لغة، وحواف آمنة.
 */
export function AuthPageShell({ children, className }: Props) {
  const { t } = useI18n();
  const { mode, setMode } = useTheme();
  const S = "web_shell" as const;
  return (
    <main className={cn("center-page center-page--auth", className)}>
      <div className="auth-shell">
        <header className="auth-header">
          <Link to="/" className="auth-header-brand">
            <img src="/logo.png" alt="" className="auth-header-logo" width={44} height={44} decoding="async" />
            <div className="auth-header-text">
              <p className="auth-header-title">{t("web_shell.app_badge", "أهل الأثر")}</p>
              <p className="auth-header-tagline">
                {t("web_shell.auth_tagline", "منصة تعليمية متكاملة")}
              </p>
            </div>
          </Link>
          <div className="auth-header-actions">
            <label className="theme-switcher theme-switcher--auth" title={t(`${S}.topbar_theme`, "المظهر")}>
              <span className="theme-switcher-label">{t(`${S}.topbar_theme`, "المظهر")}</span>
              <select
                className="theme-switcher-select"
                value={mode}
                onChange={(e) => setMode(e.target.value as "light" | "dark" | "system")}
                aria-label={t(`${S}.topbar_theme_aria`, "تبديل المظهر")}
              >
                <option value="system">{t(`${S}.theme_system`, "تلقائي")}</option>
                <option value="dark">{t(`${S}.theme_dark`, "ليلي")}</option>
                <option value="light">{t(`${S}.theme_light`, "نهاري")}</option>
              </select>
            </label>
            <LanguageSwitcher />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
