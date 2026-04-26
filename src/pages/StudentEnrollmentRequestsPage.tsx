import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  ContentList,
  ContentListItem,
  CoverImage,
  cn,
  EmptyState,
  PageToolbar,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { myCoursesService } from "../services/myCoursesService";
import type { EnrollmentRequest } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

function statusLabel(s: EnrollmentRequest["status"]): string {
  switch (s) {
    case "pending":
      return "قيد المراجعة";
    case "approved":
      return "مقبول";
    case "rejected":
      return "مرفوض";
    case "expired":
      return "منتهٍ";
    default:
      return s;
  }
}

export function StudentEnrollmentRequestsPage() {
  const { user, ready } = useAuth();
  const [rows, setRows] = useState<EnrollmentRequest[]>([]);
  const [enrolled, setEnrolled] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const [reqs, mine] = await Promise.all([
        coursesService.listStudentEnrollmentRequests(user.uid),
        myCoursesService.listForStudent(user.uid),
      ]);
      setRows(reqs);
      setEnrolled(new Set(mine.map((m) => m.courseId)));
    } catch {
      setMessage("تعذر تحميل طلباتك. تحقق من الاتصال وقواعد Firestore.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  if (!ready) {
    return (
      <DashboardLayout
        role="student"
        title="طلباتي"
        lede="تتبّع حالة طلبات الانضمام للمقررات — نفس سجل «طلباتي» / الدورات في تطبيق الجوال."
      >
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      role="student"
      title="طلباتي"
      lede="تتبّع حالة طلبات الانضمام للمقررات — نفس سجل «طلباتي» / الدورات في تطبيق الجوال."
    >
      <PageToolbar>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>تحديث</ButtonBusyLabel>
        </button>
        <Link to="/student/courses" className="ghost-btn toolbar-btn">
          تصفح الكتالوج
        </Link>
        <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
          مقرراتي
        </Link>
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {loading ? (
        <PageLoadHint />
      ) : rows.length === 0 ? (
        <EmptyState message='لا توجد طلبات انضمام حتى الآن. تصفح «الدورات» واطلب الانضمام للمقررات المتاحة.' />
      ) : (
        <ContentList>
          {rows.map((r) => {
            const inMy = enrolled.has(r.targetId);
            const hasThumb = Boolean(r.targetImageURL?.trim());
            return (
              <ContentListItem
                key={r.id}
                className={cn("enrollment-req-item", hasThumb && "enrollment-req-item--row")}
              >
                {hasThumb ? (
                  <CoverImage
                    variant="thumb"
                    src={r.targetImageURL}
                    alt={r.targetName}
                    className="enrollment-req-thumb"
                  />
                ) : null}
                <div className="enrollment-req-item__body">
                <h3 className="post-title">{r.targetName || "مقرر"}</h3>
                <p className="muted post-meta small">
                  طُلب في {formatFirestoreTime(r.requestedAt)}
                  {r.processedAt != null ? ` · عُالج في ${formatFirestoreTime(r.processedAt)}` : null}
                </p>
                <p className="enrollment-req-badges" aria-label="الحالة">
                  <span
                    className={
                      r.status === "approved"
                        ? "meta-pill meta-pill--ok"
                        : r.status === "pending"
                          ? "meta-pill meta-pill--info"
                          : r.status === "rejected"
                            ? "meta-pill meta-pill--warn"
                            : "meta-pill meta-pill--muted"
                    }
                  >
                    {statusLabel(r.status)}
                  </span>
                  {inMy && r.status === "approved" ? (
                    <span className="meta-pill meta-pill--ok">ضمن «مقرراتي»</span>
                  ) : null}
                </p>
                {r.adminNotes && r.status !== "pending" ? (
                  <p className="muted small">ملاحظة الإدارة: {r.adminNotes}</p>
                ) : null}
                <div className="course-actions">
                  {r.status === "approved" || inMy ? (
                    <Link className="primary-btn" to={`/student/course/${r.targetId}`}>
                      فتح المقرر
                    </Link>
                  ) : null}
                </div>
                </div>
              </ContentListItem>
            );
          })}
        </ContentList>
      )}
    </DashboardLayout>
  );
}
