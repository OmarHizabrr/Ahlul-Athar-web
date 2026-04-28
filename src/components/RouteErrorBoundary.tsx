import { Component, type ErrorInfo, type ReactNode } from "react";
import { AuthPageShell } from "./AuthPageShell";
import { AlertMessage } from "./ui";

type Props = { children: ReactNode };

type State = { hasError: boolean; error: Error | null };

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
        <AuthPageShell>
          <section className="card">
            <p className="badge">تنبيه</p>
            <h1>حدث خطأ في التحميل</h1>
            <p className="muted">يمكنك العودة للرئيسية أو إعادة تحميل الصفحة. إن تكرر الخطأ، تحقق من الاتصال والتحديثات.</p>
            <AlertMessage kind="error" className="error-detail" role="alert">
              {this.state.error.message}
            </AlertMessage>
            <div className="course-actions error-boundary-actions">
              <button type="button" className="primary-btn" onClick={this.handleReload}>
                تحديث الصفحة
              </button>
              <button type="button" className="ghost-btn" onClick={this.handleGoHome}>
                الذهاب للرئيسية
              </button>
            </div>
          </section>
        </AuthPageShell>
      );
    }

    return this.props.children;
  }
}
