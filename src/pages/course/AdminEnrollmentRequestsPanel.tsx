import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import {
  ContentList,
  ContentListItem,
  CoverImage,
  cn,
  EmptyState,
  PageToolbar,
  SectionTitle,
} from "../../components/ui";
import { useI18n } from "../../context/I18nContext";
import type { EnrollmentRequest } from "../../types";
import { formatFirestoreTime } from "../../utils/firestoreTime";
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
  const { tr } = useI18n();
  const busy = submitting || requestsLoading;
  return (
    <section className="requests-panel">
      <div className="requests-header">
        <SectionTitle as="h3">{tr("طلبات الانضمام للدورات")}</SectionTitle>
        <PageToolbar>
          <button
            type="button"
            className="ghost-btn toolbar-btn"
            onClick={() => void onRefresh()}
            disabled={busy}
            aria-busy={busy}
          >
            <ButtonBusyLabel busy={busy}>{tr("تحديث الطلبات")}</ButtonBusyLabel>
          </button>
        </PageToolbar>
      </div>
      <div className="request-filters">
        {(
          [
            ["pending", "معلّقة"] as const,
            ["approved", "مقبولة"] as const,
            ["rejected", "مرفوضة"] as const,
            ["expired", "منتهية"] as const,
            ["all", "الكل"] as const,
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={requestFilter === key ? "primary-btn" : "ghost-btn"}
            onClick={() => onRequestFilterChange(key)}
            disabled={busy}
            type="button"
          >
            {tr(label)}
          </button>
        ))}
      </div>
      {requestsLoading ? <PageLoadHint text={tr("جاري تحميل الطلبات...")} /> : null}
      {!requestsLoading && requests.length === 0 ? (
        <EmptyState message={emptyRequestsMessage(requestFilter, tr)} />
      ) : (
        <ContentList>
          {requests.map((request) => {
            const hasThumb = Boolean(request.targetImageURL?.trim());
            return (
            <ContentListItem
              as="article"
              key={request.id}
              className={cn(hasThumb && "enrollment-req-item--row")}
            >
              {hasThumb ? (
                <CoverImage
                  variant="thumb"
                  src={request.targetImageURL}
                  alt={request.targetName}
                  className="enrollment-req-thumb"
                />
              ) : null}
              <div className="enrollment-req-item__body">
              <h3>{request.targetName}</h3>
              <p className="muted">
                {tr("الطالب:")} {request.studentName || tr("غير معروف")} ({request.studentEmail || tr("بدون بريد")})
              </p>
              <p className="muted">
                {tr("السبب:")} {request.reason || tr("—")}
              </p>
              {request.adminNotes ? (
                <p className="muted">
                  {tr("ملاحظات الإدارة:")} {request.adminNotes}
                </p>
              ) : null}
              <p className="muted">
                {tr("الحالة:")} <strong>{requestStatusLabel(request.status, tr)}</strong>
              </p>
              <p className="muted">
                {tr("تاريخ الطلب:")} {formatFirestoreTime(request.requestedAt)}
              </p>
              {request.processedAt != null ? (
                <p className="muted">
                  {tr("تاريخ المعالجة:")} {formatFirestoreTime(request.processedAt)}
                </p>
              ) : null}
              <div className="course-actions">
                {request.status === "pending" ? (
                  <>
                    <button
                      className="primary-btn"
                      onClick={() => onOpenActivation(request)}
                      disabled={busy}
                      type="button"
                      aria-busy={busy}
                    >
                      <ButtonBusyLabel busy={submitting}>{tr("قبول (تفعيل)")}</ButtonBusyLabel>
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => onRejectRequest(request.id)}
                      disabled={busy}
                      type="button"
                      aria-busy={busy}
                    >
                      <ButtonBusyLabel busy={submitting}>{tr("رفض")}</ButtonBusyLabel>
                    </button>
                  </>
                ) : (
                  <span className="muted">{tr("تمت معالجة الطلب. عرض \"معلّقة\" للطلبات الجديدة.")}</span>
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
