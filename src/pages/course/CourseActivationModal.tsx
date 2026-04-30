import { ButtonBusyLabel } from "../../components/ButtonBusyLabel";
import { AppModal } from "../../components/ui";
import { useI18n } from "../../context/I18nContext";

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
  const { tr } = useI18n();
  return (
    <AppModal
      open
      title={tr("فترة تفعيل الدورة")}
      onClose={() => {
        if (!submitting) {
          onClose();
        }
      }}
      contentClassName="course-form-modal"
    >
      <div>
        <p className="muted small-print">
          {tr("نفس منطق تطبيق Flutter: اختر \"مدى الحياة\" أو عدد الأيام قبل انتهاء التفعيل.")}
        </p>
        <label className="switch-line">
          <input
            type="checkbox"
            checked={isLifetimeActivation}
            onChange={(e) => onLifetimeChange(e.target.checked)}
            disabled={submitting}
          />
          <span>{tr("تفعيل مدى الحياة (بدون انتهاء)")}</span>
        </label>
        {!isLifetimeActivation ? (
          <label className="field-block">
            <span>{tr("عدد أيام التفعيل")}</span>
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
            <ButtonBusyLabel busy={submitting}>{tr("تأكيد القبول")}</ButtonBusyLabel>
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
            <ButtonBusyLabel busy={submitting}>{tr("إلغاء")}</ButtonBusyLabel>
          </button>
        </div>
      </div>
    </AppModal>
  );
}
