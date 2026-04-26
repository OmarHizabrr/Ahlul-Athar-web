import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import type { Course, EnrollmentRequest, UserRole } from "../types";
import { AdminEnrollmentRequestsPanel } from "./course/AdminEnrollmentRequestsPanel";
import { CourseActivationModal } from "./course/CourseActivationModal";
import { DashboardLayout } from "./DashboardLayout";

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

export function CoursesPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
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
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationTarget, setActivationTarget] = useState<EnrollmentRequest | null>(null);
  const [isLifetimeActivation, setIsLifetimeActivation] = useState(true);
  const [activationDays, setActivationDays] = useState(30);

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
      const data = await coursesService.listCourseEnrollmentRequests(requestFilter);
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

  const openActivationDialog = (req: EnrollmentRequest) => {
    setActivationTarget(req);
    setIsLifetimeActivation(true);
    setActivationDays(30);
    setActivationOpen(true);
  };

  const confirmActivation = async () => {
    if (!activationTarget) {
      return;
    }
    setSubmitting(true);
    try {
      const expiresAt =
        isLifetimeActivation ? null : new Date(Date.now() + activationDays * 86_400_000);
      const { alreadyEnrolled } = await coursesService.approveEnrollmentRequest(activationTarget, {
        isLifetime: isLifetimeActivation,
        days: activationDays,
        expiresAt,
      });
      setMessage(
        alreadyEnrolled
          ? "تم اعتماد الطلب وتحديث بيانات التفعيل. الطالب كان مسجّلًا مسبقًا—لم نُكرّر زيادة عدد الطلاب."
          : "تم قبول الطلب وإضافة الطالب للدورة (نفس مسار التطبيق: enrollment_requests + numbers + Mycourses).",
      );
      setIsError(false);
      setActivationOpen(false);
      setActivationTarget(null);
      await Promise.all([loadRequests(), loadCourses()]);
    } catch {
      setMessage("تعذر قبول الطلب. تحقق من صلاحيات Firestore أو الفهارس المركّبة.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRejectRequest = async (requestId: string) => {
    const reason = window.prompt("سبب الرفض (يُحفظ في ملاحظات الإدارة):", "");
    if (reason === null) {
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.rejectEnrollmentRequest(requestId, reason.trim() || "مرفوض");
      setMessage("تم رفض الطلب وتسجيل الملاحظة.");
      setIsError(false);
      await loadRequests();
    } catch {
      setMessage("تعذر رفض الطلب.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const pageLede =
    role === "admin"
      ? "إنشاء وتعديل المقررات، إدارة طلبات الانضمام، وربط الدروس من صفحة «دروس المقرر»."
      : "تصفح المقررات المتاحة، اطلب الانضمام، أو انتقل إلى «مقرراتي» بعد الموافقة.";

  if (!ready) {
    return (
      <DashboardLayout role={role} title="الدورات" lede={pageLede}>
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role={role} title="الدورات" lede={pageLede}>
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
        {role === "student" ? (
          <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
            مقرراتي
          </Link>
        ) : null}
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
                    <Link
                      to={`/admin/course/${course.id}/lessons`}
                      className="primary-btn"
                    >
                      دروس
                    </Link>
                    <button className="ghost-btn" onClick={() => onEdit(course)} disabled={submitting} type="button">
                      تعديل
                    </button>
                    <button className="ghost-btn" onClick={() => onDelete(course)} disabled={submitting} type="button">
                      حذف
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={`/student/course/${course.id}`}
                      className="ghost-btn"
                    >
                      تفاصيل المقرر
                    </Link>
                    <button className="primary-btn" onClick={() => onRequest(course)} disabled={submitting} type="button">
                      طلب انضمام
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {role === "admin" ? (
        <AdminEnrollmentRequestsPanel
          requestFilter={requestFilter}
          onRequestFilterChange={setRequestFilter}
          requests={requests}
          requestsLoading={requestsLoading}
          submitting={submitting}
          onRefresh={loadRequests}
          onOpenActivation={openActivationDialog}
          onRejectRequest={(id) => void onRejectRequest(id)}
        />
      ) : null}

      {activationOpen && activationTarget ? (
        <CourseActivationModal
          submitting={submitting}
          isLifetimeActivation={isLifetimeActivation}
          onLifetimeChange={setIsLifetimeActivation}
          activationDays={activationDays}
          onDaysChange={setActivationDays}
          onConfirm={confirmActivation}
          onClose={() => {
            setActivationOpen(false);
            setActivationTarget(null);
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}
