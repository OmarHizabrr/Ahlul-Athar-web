import type { ReactNode } from "react";

type BusyLabelProps = {
  busy: boolean;
  children: ReactNode;
};

/** داخل الزر: دوّار + نص العملية ليبقى الإحساس بأن الطلب جارٍ. */
export function ButtonBusyLabel({ busy, children }: BusyLabelProps) {
  return (
    <span className="btn-busy-label">
      {busy ? <span className="btn-spinner" aria-hidden /> : null}
      <span className="btn-busy-text">{children}</span>
    </span>
  );
}

type PageLoadProps = {
  text?: string;
};

/** سطر «جاري التحميل / التهيئة…» مع دوّار بجانب النص. */
export function PageLoadHint({ text = "جاري التحميل..." }: PageLoadProps) {
  return (
    <p className="page-load-hint muted" role="status">
      <span className="btn-spinner btn-spinner--muted" aria-hidden />
      {text}
    </p>
  );
}
