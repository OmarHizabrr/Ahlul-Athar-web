import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "../context/I18nContext";
import { AuthPageShell } from "./AuthPageShell";
import { AlertMessage } from "./ui";

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

function RouteErrorFallback({
  error,
  onReload,
  onGoHome,
}: {
  error: Error;
  onReload: () => void;
  onGoHome: () => void;
}) {
  const { t } = useI18n();
  return (
    <AuthPageShell>
      <section className="card">
        <p className="badge">{t("web_shell.error_alert_badge", "تنبيه")}</p>
        <h1>{t("web_shell.error_load_title", "حدث خطأ في التحميل")}</h1>
        <p className="muted">
          {t(
            "web_shell.error_load_body",
            "يمكنك العودة للرئيسية أو إعادة تحميل الصفحة. إن تكرر الخطأ، تحقق من الاتصال والتحديثات.",
          )}
        </p>
        <AlertMessage kind="error" className="error-detail" role="alert">
          {error.message}
        </AlertMessage>
        <div className="course-actions error-boundary-actions">
          <button type="button" className="primary-btn" onClick={onReload}>
            {t("web_shell.reload_page", "تحديث الصفحة")}
          </button>
          <button type="button" className="ghost-btn" onClick={onGoHome}>
            {t("web_shell.go_home", "الذهاب للرئيسية")}
          </button>
        </div>
      </section>
    </AuthPageShell>
  );
}

/**
 * يلتقط أخطاء التصيير أو فشل الحَزَم الديناميكية ويعرض واجهة بسيطة.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("RouteErrorBoundary", error, errorInfo.componentStack);
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign("/");
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <RouteErrorFallback
          error={this.state.error}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}
