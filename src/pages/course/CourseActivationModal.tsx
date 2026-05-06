import { ButtonBusyLabel } from "../../components/ButtonBusyLabel";
import { AppModal, Avatar, CoverImage } from "../../components/ui";
import { useI18n } from "../../context/I18nContext";

type CourseActivationModalProps = {
  submitting: boolean;
  isLifetimeActivation: boolean;
  onLifetimeChange: (v: boolean) => void;
  activationDays: number;
  onDaysChange: (v: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  /** معاينة بصرية (طالب + هدف الدورة/المجلد) كما في التطبيق */
  previewStudentName?: string;
  previewStudentPhotoURL?: string | null;
  previewStudentEmail?: string;
  previewTargetTitle?: string;
  previewTargetImageURL?: string | null;
};

export function CourseActivationModal({
  submitting,
  isLifetimeActivation,
  onLifetimeChange,
  activationDays,
  onDaysChange,
  onConfirm,
  onClose,
  previewStudentName,
  previewStudentPhotoURL,
  previewStudentEmail,
  previewTargetTitle,
  previewTargetImageURL,
}: CourseActivationModalProps) {
  const { t } = useI18n();
  const showPreview =
    Boolean(previewStudentName?.trim()) ||
    Boolean(previewTargetTitle?.trim()) ||
    Boolean(previewStudentPhotoURL?.trim()) ||
    Boolean(previewTargetImageURL?.trim());
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
        {showPreview ? (
          <div className="activation-modal-preview">
            <div className="activation-modal-preview__student">
              <Avatar
                photoURL={previewStudentPhotoURL ?? undefined}
                displayName={previewStudentName}
                email={previewStudentEmail}
                alt={previewStudentName || t("web_shell.unknown_person", "غير معروف")}
                imageClassName="user-avatar topbar-avatar"
                fallbackClassName="user-avatar-fallback topbar-avatar"
                size={44}
              />
              <div className="activation-modal-preview__text">
                <strong>{previewStudentName || t("web_shell.unknown_person", "غير معروف")}</strong>
                {previewStudentEmail ? <p className="muted small">{previewStudentEmail}</p> : null}
              </div>
            </div>
            <div className="activation-modal-preview__target">
              {previewTargetImageURL?.trim() ? (
                <CoverImage
                  variant="thumb"
                  src={previewTargetImageURL}
                  alt={previewTargetTitle ?? ""}
                  className="activation-modal-preview__cover"
                />
              ) : (
                <div className="activation-modal-preview__cover-ph" aria-hidden>
                  {(previewTargetTitle ?? "?").trim().slice(0, 1)}
                </div>
              )}
              {previewTargetTitle ? <p className="activation-modal-preview__target-title">{previewTargetTitle}</p> : null}
            </div>
          </div>
        ) : null}
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
