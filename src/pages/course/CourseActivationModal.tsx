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
  const { t } = useI18n();
  return (
    <AppModal
      open
      title={t("web_shell.activation_modal_title", "فترة تفعيل الدورة")}
      onClose={() => {
        if (!submitting) {
          onClose();
        }
      }}
      contentClassName="course-form-modal"
    >
      <div>
        <p className="muted small-print">
          {t(
            "web_shell.activation_modal_hint",
            "نفس منطق تطبيق Flutter: اختر \"مدى الحياة\" أو عدد الأيام قبل انتهاء التفعيل.",
          )}
        </p>
        <label className="switch-line">
          <input
            type="checkbox"
            checked={isLifetimeActivation}
            onChange={(e) => onLifetimeChange(e.target.checked)}
            disabled={submitting}
          />
          <span>{t("web_shell.activation_lifetime", "تفعيل مدى الحياة (بدون انتهاء)")}</span>
        </label>
        {!isLifetimeActivation ? (
          <label className="field-block">
            <span>{t("web_shell.activation_days_label", "عدد أيام التفعيل")}</span>
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
            <ButtonBusyLabel busy={submitting}>{t("web_shell.confirm_accept", "تأكيد القبول")}</ButtonBusyLabel>
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
            <ButtonBusyLabel busy={submitting}>{t("web_shell.btn_cancel", "إلغاء")}</ButtonBusyLabel>
          </button>
        </div>
      </div>
    </AppModal>
  );
}
