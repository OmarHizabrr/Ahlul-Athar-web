import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import {
  Avatar,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  PageToolbar,
  SectionTitle,
} from "../../components/ui";
import { useI18n } from "../../context/I18nContext";
import type { EnrollmentRequest } from "../../types";
import { formatFirestoreTime } from "../../utils/firestoreTime";
import { dashboardBackLinkState } from "../../utils/dashboardBackNavigation";
import { emptyRequestsMessage, requestStatusLabel } from "./EnrollmentRequestHelpers";

type AdminEnrollmentRequestsPanelProps = {
  requestFilter: "all" | EnrollmentRequest["status"];
  onRequestFilterChange: (f: "all" | EnrollmentRequest["status"]) => void;
  requests: EnrollmentRequest[];
  requestsLoading: boolean;
  submitting: boolean;
  onRefresh: () => void;
  onOpenActivation: (r: EnrollmentRequest) => void;
  onRejectRequest: (id: string) => void;
};

export function AdminEnrollmentRequestsPanel({
  requestFilter,
  onRequestFilterChange,
  requests,
  requestsLoading,
  submitting,
  onRefresh,
  onOpenActivation,
  onRejectRequest,
}: AdminEnrollmentRequestsPanelProps) {
  const { t } = useI18n();
  const busy = submitting || requestsLoading;
  const backToRequests = dashboardBackLinkState("/admin/enrollment-requests");
  return (
    <section className="requests-panel">
      <div className="requests-header">
        <SectionTitle as="h3">{t("web_shell.enrollment_panel_title", "طلبات الانضمام للدورات")}</SectionTitle>
        <PageToolbar>
          <button
            type="button"
            className="ghost-btn toolbar-btn"
            onClick={() => void onRefresh()}
            disabled={busy}
            aria-busy={busy}
          >
            <ButtonBusyLabel busy={busy}>{t("web_shell.enrollment_refresh_requests", "تحديث الطلبات")}</ButtonBusyLabel>
          </button>
        </PageToolbar>
      </div>
      <div className="request-filters">
        {(
          [
            ["pending", "web_shell.filter_pending", "معلّقة"] as const,
            ["approved", "web_shell.filter_approved", "مقبولة"] as const,
            ["rejected", "web_shell.filter_rejected", "مرفوضة"] as const,
            ["expired", "web_shell.filter_expired", "منتهية"] as const,
            ["all", "web_shell.filter_all", "الكل"] as const,
          ] as const
        ).map(([key, labelKey, labelFallback]) => (
          <button
            key={key}
            className={requestFilter === key ? "primary-btn" : "ghost-btn"}
            onClick={() => onRequestFilterChange(key)}
            disabled={busy}
            type="button"
          >
            {t(labelKey, labelFallback)}
          </button>
        ))}
      </div>
      {requestsLoading ? (
        <PageLoadHint text={t("web_shell.enrollment_loading_requests", "جاري تحميل الطلبات...")} />
      ) : null}
      {!requestsLoading && requests.length === 0 ? (
        <EmptyState message={emptyRequestsMessage(requestFilter, t)} />
      ) : (
        <ContentList>
          {requests.map((request) => {
            const hasThumb = Boolean(request.targetImageURL?.trim());
            const studentAlt =
              request.studentName?.trim() ||
              request.studentEmail?.trim() ||
              t("web_shell.enrollment_requester_photo_alt", "صورة صاحب الطلب");
            return (
            <ContentListItem
              as="article"
              key={request.id}
              className="enrollment-req-item--row"
            >
              <div className="enrollment-req-media">
                <Avatar
                  photoURL={request.studentPhotoURL}
                  displayName={request.studentName}
                  email={request.studentEmail}
                  alt={studentAlt}
                  imageClassName="enrollment-req-student-photo"
                  fallbackClassName="enrollment-req-student-fallback"
                  size={52}
                />
                {hasThumb ? (
                  <CoverImage
                    variant="thumb"
                    src={request.targetImageURL}
                    alt={request.targetName}
                    className="enrollment-req-thumb enrollment-req-thumb--target"
                  />
                ) : null}
              </div>
              <div className="enrollment-req-item__body">
              <h3>{request.targetName}</h3>
              <p className="muted">
                {t("web_shell.enrollment_student_prefix", "الطالب:")}{" "}
                {request.studentName || t("web_shell.unknown_person", "غير معروف")} (
                {request.studentEmail || t("web_shell.no_email", "بدون بريد")})
              </p>
              <p className="muted">
                {t("web_shell.reason_prefix", "السبب:")} {request.reason || t("web_shell.dash_em", "—")}
              </p>
              {request.adminNotes ? (
                <p className="muted">
                  {t("web_shell.admin_notes_prefix", "ملاحظات الإدارة:")} {request.adminNotes}
                </p>
              ) : null}
              <p className="muted">
                {t("web_shell.status_prefix", "الحالة:")} <strong>{requestStatusLabel(request.status, t)}</strong>
              </p>
              <p className="muted">
                {t("web_shell.requested_at_prefix", "تاريخ الطلب:")} {formatFirestoreTime(request.requestedAt)}
              </p>
              {request.processedAt != null ? (
                <p className="muted">
                  {t("web_shell.processed_at_prefix", "تاريخ المعالجة:")}{" "}
                  {formatFirestoreTime(request.processedAt)}
                </p>
              ) : null}
              <div className="course-actions">
                <Link
                  className="ghost-btn toolbar-btn"
                  to={`/admin/student/${request.studentId}`}
                  {...backToRequests}
                >
                  {t("web_shell.enrollment_open_student", "ملف الطالب")}
                </Link>
                <Link
                  className="ghost-btn toolbar-btn"
                  to={
                    request.requestType === "folder"
                      ? `/admin/folder/${request.targetId}`
                      : `/admin/course/${request.targetId}/lessons`
                  }
                  {...backToRequests}
                >
                  {request.requestType === "folder"
                    ? t("web_shell.enrollment_open_folder", "فتح المجلد")
                    : t("web_shell.enrollment_open_course", "فتح المقرر")}
                </Link>
                {request.status === "pending" ? (
                  <>
                    <button
                      className="primary-btn"
                      onClick={() => onOpenActivation(request)}
                      disabled={busy}
                      type="button"
                      aria-busy={busy}
                    >
                      <ButtonBusyLabel busy={submitting}>{t("web_shell.enrollment_accept_activate", "قبول (تفعيل)")}</ButtonBusyLabel>
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => onRejectRequest(request.id)}
                      disabled={busy}
                      type="button"
                      aria-busy={busy}
                    >
                      <ButtonBusyLabel busy={submitting}>{t("web_shell.enrollment_reject", "رفض")}</ButtonBusyLabel>
                    </button>
                  </>
                ) : (
                  <span className="muted">{t("web_shell.enrollment_processed_hint", "تمت معالجة الطلب. عرض \"معلّقة\" للطلبات الجديدة.")}</span>
                )}
              </div>
              </div>
            </ContentListItem>
            );
          })}
        </ContentList>
      )}
    </section>
  );
}
