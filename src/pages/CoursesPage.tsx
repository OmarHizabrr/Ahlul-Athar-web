import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { coursesService } from "../services/coursesService";
import { myCoursesService } from "../services/myCoursesService";
import type { Course, EnrollmentRequest, UserRole } from "../types";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  AppModal,
  ContentList,
  ContentListItem,
  CoverImage,
  cn,
  EmptyState,
  FormPanel,
  PageToolbar,
  SectionTitle,
} from "../components/ui";
import { IoEyeOutline } from "react-icons/io5";
import { DashboardLayout } from "./DashboardLayout";

type CourseForm = {
  title: string;
  description: string;
  imageUrl: string;
  courseType: "public" | "private";
  isActive: boolean;
};

const initialForm: CourseForm = {
  title: "",
  description: "",
  imageUrl: "",
  courseType: "public",
  isActive: true,
};

export function CoursesPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  const STUDENT_ACTION_LABELS = useMemo(
    () => ({
      directEnroll: tr("تسجيل مباشر"),
      requestJoin: tr("طلب الانضمام"),
      requestJoinRetry: tr("إعادة طلب الانضمام"),
      pending: tr("الطلب قيد المراجعة"),
      openCourse: tr("فتح المقرر"),
    }),
    [tr],
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [form, setForm] = useState<CourseForm>(initialForm);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(() => new Set());
  const [latestReqByCourse, setLatestReqByCourse] = useState<Map<string, EnrollmentRequest>>(
    () => new Map(),
  );

  const loadStudentCourseContext = useCallback(async () => {
    if (!user || role !== "student") {
      return;
    }
    try {
      const [mine, reqs] = await Promise.all([
        myCoursesService.listForStudent(user.uid),
        coursesService.listStudentEnrollmentRequests(user.uid),
      ]);
      setEnrolledIds(new Set(mine.map((m) => m.courseId)));
      const m = new Map<string, EnrollmentRequest>();
      for (const r of reqs) {
        if (!m.has(r.targetId)) {
          m.set(r.targetId, r);
        }
      }
      setLatestReqByCourse(m);
    } catch {
      // تبقى البطاقات قابلة للاستخدام بدون تلميحات الطلب
    }
  }, [user, role]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await coursesService.listCoursesForRole(role);
      setCourses(data);
    } catch {
      setMessage(tr("تعذر تحميل الدورات."));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCourses();
  }, [role]);

  useEffect(() => {
    if (role === "student" && user) {
      void loadStudentCourseContext();
    }
  }, [role, user, loadStudentCourseContext]);

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
    setCourseModalOpen(false);
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
        await coursesService.updateCourse(editingId, {
          ...form,
          imageUrl: form.imageUrl.trim(),
        });
        setMessage(tr("تم تحديث الدورة بنجاح."));
      } else {
        await coursesService.createCourse(user, {
          ...form,
          imageUrl: form.imageUrl.trim(),
        });
        setMessage(tr("تم إنشاء الدورة بنجاح."));
      }
      setIsError(false);
      resetForm();
      await loadCourses();
    } catch {
      setMessage(tr("فشلت العملية، تحقق من صلاحيات Firestore."));
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
      imageUrl: course.imageUrl ?? "",
      courseType: course.courseType,
      isActive: course.isActive,
    });
    setCourseModalOpen(true);
  };

  const onOpenCreateModal = () => {
    setEditingId(null);
    setForm(initialForm);
    setCourseModalOpen(true);
  };

  const onDelete = async (course: Course) => {
    const ok = window.confirm(`${tr("حذف الدورة")}: ${course.title} ؟`);
    if (!ok) {
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.deleteCourse(course.id);
      setMessage(tr("تم حذف الدورة."));
      setIsError(false);
      await loadCourses();
    } catch {
      setMessage(tr("فشل حذف الدورة."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRequest = async (course: Course) => {
    if (!user) {
      return;
    }
    const pending = latestReqByCourse.get(course.id);
    if (pending?.status === "pending") {
      setMessage(tr("لديك طلب قيد المراجعة لهذا المقرر."));
      setIsError(true);
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.requestEnrollment(user, course);
      setMessage(tr("تم إرسال طلب الانضمام للإدارة."));
      setIsError(false);
      window.dispatchEvent(new CustomEvent("ah:enrollment-requests-updated"));
      await loadStudentCourseContext();
    } catch {
      setMessage(tr("فشل إرسال طلب الانضمام."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDirectEnroll = async (course: Course) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await coursesService.enrollStudentInPublicCourse(user, course);
      setMessage(tr("تم تسجيلك في المقرر مباشرة."));
      setIsError(false);
      await loadStudentCourseContext();
    } catch {
      setMessage(tr("تعذر التسجيل المباشر."));
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
      <DashboardLayout role={role} title={tr("الدورات")} lede={tr(pageLede)}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout role={role} title={tr("الدورات")} lede={tr(pageLede)}>
      <PageToolbar>
        <input
          className="course-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("بحث بالدورات...")}
        />
        {role === "admin" ? (
          <>
            <button type="button" className="primary-btn toolbar-btn" onClick={onOpenCreateModal}>
              {tr("إضافة دورة")}
            </button>
            <Link to="/admin/enrollment-requests" className="ghost-btn toolbar-btn">
              {tr("طلبات الالتحاق")}
            </Link>
          </>
        ) : null}
        {role === "student" ? (
          <>
            <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
              {tr("مقرراتي")}
            </Link>
            <Link to="/student/enrollment-requests" className="ghost-btn toolbar-btn">
              {tr("طلباتي")}
            </Link>
          </>
        ) : null}
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void loadCourses()}
          disabled={loading || submitting}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>{tr("تحديث الدورات")}</ButtonBusyLabel>
        </button>
      </PageToolbar>

      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint text={tr("جاري تحميل الدورات...")} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search.trim()
              ? tr("لا نتائج تطابق البحث. جرّب كلمات أخرى أو امسح حقل البحث.")
              : tr("لا توجد مقررات في القائمة بعد.")
          }
        />
      ) : (
        <ContentList>
          {filtered.map((course) => {
            const hasCover = Boolean(course.imageUrl?.trim());
            return (
            <ContentListItem key={course.id} className={cn(hasCover && "mycourse-card--cover")}>
              {hasCover ? <CoverImage variant="catalog" src={course.imageUrl} alt={course.title} /> : null}
              <div className={hasCover ? "mycourse-card-body" : undefined}>
              <h3>{course.title}</h3>
              <p className="muted">{course.description}</p>
              <div className="course-meta">
                <span>{course.courseType === "private" ? tr("خاصة") : tr("عامة")}</span>
                <span>{course.isActive ? tr("نشطة") : tr("موقفة")}</span>
                <span>{course.studentCount} {tr("طالب")}</span>
                <span>{course.lessonCount} {tr("درس")}</span>
              </div>
              <div className="course-actions">
                {role === "admin" ? (
                  <>
                    <Link
                      to={`/admin/preview/course/${course.id}`}
                      className="icon-tool-btn"
                      title={tr("معاينة واجهة الطالب (المقرر والدروس)")}
                      aria-label={tr("معاينة المقرر كطالب")}
                    >
                      <IoEyeOutline size={20} />
                      <span className="icon-tool-label">{tr("معاينة")}</span>
                    </Link>
                    <Link
                      to={`/admin/course/${course.id}/lessons`}
                      className="primary-btn"
                    >
                      {tr("دروس")}
                    </Link>
                    <button
                      className="ghost-btn"
                      onClick={() => onEdit(course)}
                      disabled={submitting}
                      type="button"
                      aria-busy={submitting}
                    >
                      <ButtonBusyLabel busy={submitting}>{tr("تعديل")}</ButtonBusyLabel>
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => onDelete(course)}
                      disabled={submitting}
                      type="button"
                      aria-busy={submitting}
                    >
                      <ButtonBusyLabel busy={submitting}>{tr("حذف")}</ButtonBusyLabel>
                    </button>
                  </>
                ) : (
                  <StudentCourseRowActions
                    course={course}
                    enrolled={enrolledIds.has(course.id)}
                    req={latestReqByCourse.get(course.id)}
                    submitting={submitting}
                    onRequest={() => void onRequest(course)}
                    onDirectEnroll={() => void onDirectEnroll(course)}
                    tr={tr}
                    labels={STUDENT_ACTION_LABELS}
                  />
                )}
              </div>
              </div>
            </ContentListItem>
            );
          })}
        </ContentList>
      )}

      {role === "admin" ? (
        <AppModal
          open={courseModalOpen}
          title={editingId ? tr("تعديل بيانات الدورة") : tr("إضافة دورة جديدة")}
          onClose={() => {
            if (!submitting) {
              resetForm();
            }
          }}
          contentClassName="course-form-modal"
        >
          <FormPanel onSubmit={onSubmit} elevated={false} className="course-form-modal__form">
            <SectionTitle as="h4">{editingId ? tr("تحديث الدورة") : tr("إضافة دورة")}</SectionTitle>
            <label>
              <span>{tr("عنوان الدورة")}</span>
              <input
                className="text-input"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={tr("عنوان الدورة")}
                required
              />
            </label>
            <label>
              <span>{tr("وصف مختصر")}</span>
              <input
                className="text-input"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder={tr("وصف مختصر")}
                required
              />
            </label>
            <label>
              <span>{tr("رابط صورة الدورة (اختياري)")}</span>
              <input
                className="text-input"
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <div className="form-row-2">
              <label>
              <span>{tr("نوع الدورة")}</span>
                <select
                  className="text-input"
                  value={form.courseType}
                  onChange={(e) => setForm((p) => ({ ...p, courseType: e.target.value as "public" | "private" }))}
                >
                  <option value="public">{tr("عامة")}</option>
                  <option value="private">{tr("خاصة")}</option>
                </select>
              </label>
              <label className="switch-line course-form-modal__switch">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span>{tr("نشطة في الكتالوج")}</span>
              </label>
            </div>
            <div className="course-actions">
              <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                <ButtonBusyLabel busy={submitting}>
                  {editingId ? tr("حفظ التعديلات") : tr("إنشاء دورة")}
                </ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
                {tr("إلغاء")}
              </button>
            </div>
          </FormPanel>
        </AppModal>
      ) : null}
    </DashboardLayout>
  );
}

function StudentCourseRowActions({
  course,
  enrolled,
  req,
  submitting,
  onRequest,
  onDirectEnroll,
  tr,
  labels,
}: {
  course: Course;
  enrolled: boolean;
  req: EnrollmentRequest | undefined;
  submitting: boolean;
  onRequest: () => void;
  onDirectEnroll: () => void;
  tr: (s: string) => string;
  labels: {
    directEnroll: string;
    requestJoin: string;
    requestJoinRetry: string;
    pending: string;
    openCourse: string;
  };
}) {
  const openCourse = `/student/course/${course.id}`;
  if (enrolled) {
    return (
      <>
        <Link to={openCourse} className="primary-btn">
          {labels.openCourse}
        </Link>
        <span className="meta-pill meta-pill--ok" title={tr("ضمن مقرراتك")}>
          {tr("مسجّل")}
        </span>
      </>
    );
  }
  if (req?.status === "pending") {
    return (
      <span className="ghost-btn course-waiting-pill" aria-disabled>
        {labels.pending}
      </span>
    );
  }
  if (req?.status === "approved") {
    return (
      <Link to={openCourse} className="primary-btn">
        {labels.openCourse}
      </Link>
    );
  }
  if (req?.status === "rejected" || req?.status === "expired") {
    return (
      <>
        <Link to="/student/enrollment-requests" className="ghost-btn">
          {tr("سجل الطلبات")}
        </Link>
        <button
          type="button"
          className="primary-btn"
          onClick={onRequest}
          disabled={submitting}
          aria-busy={submitting}
        >
          <ButtonBusyLabel busy={submitting}>
            {req.status === "rejected" ? labels.requestJoinRetry : labels.requestJoin}
          </ButtonBusyLabel>
        </button>
      </>
    );
  }
  const isPublic = course.courseType !== "private";
  if (isPublic) {
    return (
      <>
        <Link to={openCourse} className="ghost-btn">
          {tr("تفاصيل المقرر")}
        </Link>
        <button
          type="button"
          className="primary-btn"
          onClick={onDirectEnroll}
          disabled={submitting}
          aria-busy={submitting}
        >
          <ButtonBusyLabel busy={submitting}>{labels.directEnroll}</ButtonBusyLabel>
        </button>
      </>
    );
  }
  return (
    <>
      <Link to={openCourse} className="ghost-btn">
        {tr("تفاصيل المقرر")}
      </Link>
      <button
        type="button"
        className="primary-btn"
        onClick={onRequest}
        disabled={submitting}
        aria-busy={submitting}
      >
        <ButtonBusyLabel busy={submitting}>{labels.requestJoin}</ButtonBusyLabel>
      </button>
    </>
  );
}
