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
  return (
    <section className="requests-panel">
      <div className="requests-header">
        <h3>طلبات الانضمام للدورات</h3>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void onRefresh()}
          disabled={submitting}
        >
          تحديث الطلبات
        </button>
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
            disabled={submitting}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {requestsLoading ? <p className="muted">جاري تحميل الطلبات...</p> : null}
      {!requestsLoading && requests.length === 0 ? (
        <p className="muted">{emptyRequestsMessage(requestFilter)}</p>
      ) : (
        <div className="course-list">
          {requests.map((request) => (
            <article className="course-item" key={request.id}>
              <h3>{request.targetName}</h3>
              <p className="muted">
                الطالب: {request.studentName || "غير معروف"} ({request.studentEmail || "بدون بريد"})
              </p>
              <p className="muted">السبب: {request.reason || "—"}</p>
              {request.adminNotes ? <p className="muted">ملاحظات الإدارة: {request.adminNotes}</p> : null}
              <p className="muted">
                الحالة: <strong>{requestStatusLabel(request.status)}</strong>
              </p>
              <p className="muted">تاريخ الطلب: {formatFirestoreTime(request.requestedAt)}</p>
              {request.processedAt != null ? (
                <p className="muted">تاريخ المعالجة: {formatFirestoreTime(request.processedAt)}</p>
              ) : null}
              <div className="course-actions">
                {request.status === "pending" ? (
                  <>
                    <button
                      className="primary-btn"
                      onClick={() => onOpenActivation(request)}
                      disabled={submitting}
                      type="button"
                    >
                      قبول (تفعيل)
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => onRejectRequest(request.id)}
                      disabled={submitting}
                      type="button"
                    >
                      رفض
                    </button>
                  </>
                ) : (
                  <span className="muted">تمت معالجة الطلب. عرض &quot;معلّقة&quot; للطلبات الجديدة.</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
