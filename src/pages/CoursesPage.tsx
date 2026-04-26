import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { authService } from "../services/authService";
import { coursesService } from "../services/coursesService";
import type { Course, EnrollmentRequest, UserRole } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";

type CourseForm = {
  title: string;
  description: string;
  courseType: "public" | "private";
  isActive: boolean;
};

const initialForm: CourseForm = {
  title: "",
  description: "",
  courseType: "public",
  isActive: true,
};

function requestStatusLabel(status: EnrollmentRequest["status"]): string {
  switch (status) {
    case "pending":
      return "معلّق";
    case "approved":
      return "مقبول";
    case "rejected":
      return "مرفوض";
    default:
      return status;
  }
}

function emptyRequestsMessage(filter: "all" | EnrollmentRequest["status"]): string {
  switch (filter) {
    case "pending":
      return "لا توجد طلبات معلّقة.";
    case "approved":
      return "لا توجد طلبات مقبولة في هذا العرض.";
    case "rejected":
      return "لا توجد طلبات مرفوضة في هذا العرض.";
    case "all":
      return "لا توجد أي طلبات انضمام حتى الآن.";
    default:
      return "لا توجد طلبات.";
  }
}

export function CoursesPage({ role }: { role: UserRole }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>(initialForm);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState<"all" | EnrollmentRequest["status"]>("pending");

  const user = authService.getLocalUser();

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await coursesService.listCoursesForRole(role);
      setCourses(data);
    } catch {
      setMessage("تعذر تحميل الدورات.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourses();
  }, [role]);

  const loadRequests = async () => {
    if (role !== "admin") {
      return;
    }
    setRequestsLoading(true);
    try {
      const data = await coursesService.listEnrollmentRequests(requestFilter);
      setRequests(data);
    } catch {
      setMessage("تعذر تحميل طلبات الانضمام.");
      setIsError(true);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [role, requestFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return courses;
    }
    return courses.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [courses, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      if (editingId) {
        await coursesService.updateCourse(editingId, form);
        setMessage("تم تحديث الدورة بنجاح.");
      } else {
        await coursesService.createCourse(user, form);
        setMessage("تم إنشاء الدورة بنجاح.");
      }
      setIsError(false);
      resetForm();
      await loadCourses();
    } catch {
      setMessage("فشلت العملية، تحقق من صلاحيات Firestore.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (course: Course) => {
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description,
      courseType: course.courseType,
      isActive: course.isActive,
    });
  };

  const onDelete = async (course: Course) => {
    const ok = window.confirm(`حذف الدورة: ${course.title} ؟`);
    if (!ok) {
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.deleteCourse(course.id);
      setMessage("تم حذف الدورة.");
      setIsError(false);
      await loadCourses();
    } catch {
      setMessage("فشل حذف الدورة.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRequest = async (course: Course) => {
    if (!user) {
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.requestEnrollment(user, course);
      setMessage("تم إرسال طلب الانضمام للإدارة.");
      setIsError(false);
    } catch {
      setMessage("فشل إرسال طلب الانضمام.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onApproveRequest = async (request: EnrollmentRequest) => {
    setSubmitting(true);
    try {
      const { alreadyEnrolled } = await coursesService.approveEnrollmentRequest(request);
      setMessage(
        alreadyEnrolled
          ? "تم اعتماد الطلب. الطالب مسجّل مسبقًا في الدورة—لم نعد أعداد الطلاب مرتين."
          : "تم قبول الطلب وإضافة الطالب للدورة وتحديث العدد.",
      );
      setIsError(false);
      await Promise.all([loadRequests(), loadCourses()]);
    } catch {
      setMessage("تعذر قبول الطلب.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRejectRequest = async (requestId: string) => {
    setSubmitting(true);
    try {
      await coursesService.rejectEnrollmentRequest(requestId);
      setMessage("تم رفض الطلب.");
      setIsError(false);
      await loadRequests();
    } catch {
      setMessage("تعذر رفض الطلب.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role={role} title="الدورات">
      {role === "admin" ? (
        <form className="course-form" onSubmit={onSubmit}>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="عنوان الدورة"
            required
          />
          <input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="وصف مختصر"
            required
          />
          <select
            value={form.courseType}
            onChange={(e) => setForm((p) => ({ ...p, courseType: e.target.value as "public" | "private" }))}
          >
            <option value="public">عامة</option>
            <option value="private">خاصة</option>
          </select>
          <label className="switch-line">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <span>نشطة</span>
          </label>
          <button className="primary-btn" type="submit" disabled={submitting}>
            {editingId ? "حفظ التعديلات" : "إنشاء دورة"}
          </button>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={resetForm}>
              إلغاء التعديل
            </button>
          ) : null}
        </form>
      ) : null}

      <div className="toolbar">
        <input
          className="course-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالدورات..."
        />
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void loadCourses()}
          disabled={submitting}
        >
          تحديث الدورات
        </button>
      </div>

      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}

      {loading ? (
        <p className="muted">جاري تحميل الدورات...</p>
      ) : filtered.length === 0 ? (
        <p className="muted">لا توجد دورات.</p>
      ) : (
        <div className="course-list">
          {filtered.map((course) => (
            <article className="course-item" key={course.id}>
              <h3>{course.title}</h3>
              <p className="muted">{course.description}</p>
              <div className="course-meta">
                <span>{course.courseType === "private" ? "خاصة" : "عامة"}</span>
                <span>{course.isActive ? "نشطة" : "موقفة"}</span>
                <span>{course.studentCount} طالب</span>
                <span>{course.lessonCount} درس</span>
              </div>
              <div className="course-actions">
                {role === "admin" ? (
                  <>
                    <button className="ghost-btn" onClick={() => onEdit(course)} disabled={submitting}>
                      تعديل
                    </button>
                    <button className="ghost-btn" onClick={() => onDelete(course)} disabled={submitting}>
                      حذف
                    </button>
                  </>
                ) : (
                  <button className="primary-btn" onClick={() => onRequest(course)} disabled={submitting}>
                    طلب انضمام
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {role === "admin" ? (
        <section className="requests-panel">
          <div className="requests-header">
            <h3>طلبات الانضمام للدورات</h3>
            <button
              type="button"
              className="ghost-btn toolbar-btn"
              onClick={() => void loadRequests()}
              disabled={submitting}
            >
              تحديث الطلبات
            </button>
          </div>
          <div className="request-filters">
            <button
              className={requestFilter === "pending" ? "primary-btn" : "ghost-btn"}
              onClick={() => setRequestFilter("pending")}
              disabled={submitting}
            >
              معلّقة
            </button>
            <button
              className={requestFilter === "approved" ? "primary-btn" : "ghost-btn"}
              onClick={() => setRequestFilter("approved")}
              disabled={submitting}
            >
              مقبولة
            </button>
            <button
              className={requestFilter === "rejected" ? "primary-btn" : "ghost-btn"}
              onClick={() => setRequestFilter("rejected")}
              disabled={submitting}
            >
              مرفوضة
            </button>
            <button
              className={requestFilter === "all" ? "primary-btn" : "ghost-btn"}
              onClick={() => setRequestFilter("all")}
              disabled={submitting}
            >
              الكل
            </button>
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
                  <p className="muted">
                    الحالة: <strong>{requestStatusLabel(request.status)}</strong>
                  </p>
                  <p className="muted">
                    تاريخ الإنشاء: {formatFirestoreTime(request.createdAt)}
                  </p>
                  {request.reviewedAt != null ? (
                    <p className="muted">تاريخ المراجعة: {formatFirestoreTime(request.reviewedAt)}</p>
                  ) : null}
                  <div className="course-actions">
                    {request.status === "pending" ? (
                      <>
                        <button className="primary-btn" onClick={() => onApproveRequest(request)} disabled={submitting}>
                          قبول
                        </button>
                        <button className="ghost-btn" onClick={() => onRejectRequest(request.id)} disabled={submitting}>
                          رفض
                        </button>
                      </>
                    ) : (
                      <span className="muted">تمت مراجعة الطلب. استخدم &quot;معلّقة&quot; لمعالجة طلبات جديدة.</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </DashboardLayout>
  );
}
