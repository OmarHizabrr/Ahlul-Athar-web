import { ButtonBusyLabel } from "../../components/ButtonBusyLabel";
import { SectionTitle } from "../../components/ui";

type CourseActivationModalProps = {
  submitting: boolean;
  isLifetimeActivation: boolean;
  onLifetimeChange: (v: boolean) => void;
  activationDays: number;
  onDaysChange: (v: number) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function CourseActivationModal({
  submitting,
  isLifetimeActivation,
  onLifetimeChange,
  activationDays,
  onDaysChange,
  onConfirm,
  onClose,
}: CourseActivationModalProps) {
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activation-title"
        onClick={(e) => e.stopPropagation()}
      >
        <SectionTitle as="h4" id="activation-title">
          فترة تفعيل الدورة
        </SectionTitle>
        <p className="muted small-print">
          نفس منطق تطبيق Flutter: اختر &quot;مدى الحياة&quot; أو عدد الأيام قبل انتهاء التفعيل.
        </p>
        <label className="switch-line">
          <input
            type="checkbox"
            checked={isLifetimeActivation}
            onChange={(e) => onLifetimeChange(e.target.checked)}
            disabled={submitting}
          />
          <span>تفعيل مدى الحياة (بدون انتهاء)</span>
        </label>
        {!isLifetimeActivation ? (
          <label className="field-block">
            <span>عدد أيام التفعيل</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={activationDays}
              onChange={(e) => onDaysChange(Number.parseInt(e.target.value, 10) || 1)}
              disabled={submitting}
            />
          </label>
        ) : null}
        <div className="course-actions">
          <button
            className="primary-btn"
            onClick={() => void onConfirm()}
            disabled={submitting}
            aria-busy={submitting}
          >
            <ButtonBusyLabel busy={submitting}>تأكيد القبول</ButtonBusyLabel>
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              if (!submitting) {
                onClose();
              }
            }}
            disabled={submitting}
            aria-busy={submitting}
          >
            <ButtonBusyLabel busy={submitting}>إلغاء</ButtonBusyLabel>
          </button>
        </div>
      </div>
    </div>
  );
}
