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
  const { tr } = useI18n();
  return (
    <AuthPageShell>
      <section className="card">
        <p className="badge">{tr("تنبيه")}</p>
        <h1>{tr("حدث خطأ في التحميل")}</h1>
        <p className="muted">
          {tr("يمكنك العودة للرئيسية أو إعادة تحميل الصفحة. إن تكرر الخطأ، تحقق من الاتصال والتحديثات.")}
        </p>
        <AlertMessage kind="error" className="error-detail" role="alert">
          {error.message}
        </AlertMessage>
        <div className="course-actions error-boundary-actions">
          <button type="button" className="primary-btn" onClick={onReload}>
            {tr("تحديث الصفحة")}
          </button>
          <button type="button" className="ghost-btn" onClick={onGoHome}>
            {tr("الذهاب للرئيسية")}
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
