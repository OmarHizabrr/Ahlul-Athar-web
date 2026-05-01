import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "../context/I18nContext";
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
  return (
    <main className={cn("center-page center-page--auth", className)}>
      <div className="auth-shell">
        <header className="auth-header">
          <Link to="/role-selector" className="auth-header-brand">
            <img src="/logo.png" alt="" className="auth-header-logo" width={44} height={44} decoding="async" />
            <div className="auth-header-text">
              <p className="auth-header-title">{t("web_shell.app_badge", "أهل الأثر")}</p>
              <p className="auth-header-tagline">
                {t("web_shell.auth_tagline", "منصة تعليمية متكاملة")}
              </p>
            </div>
          </Link>
          <div className="auth-header-lang">
            <LanguageSwitcher />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
