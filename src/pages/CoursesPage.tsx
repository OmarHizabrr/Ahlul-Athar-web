import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
      setMessage("تعذر تحميل الدورات.");
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
        setMessage("تم تحديث الدورة بنجاح.");
      } else {
        await coursesService.createCourse(user, {
          ...form,
          imageUrl: form.imageUrl.trim(),
        });
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
    const pending = latestReqByCourse.get(course.id);
    if (pending?.status === "pending") {
      setMessage("لديك طلب قيد المراجعة لهذا المقرر.");
      setIsError(true);
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.requestEnrollment(user, course);
      setMessage("تم إرسال طلب الانضمام للإدارة.");
      setIsError(false);
      await loadStudentCourseContext();
    } catch {
      setMessage("فشل إرسال طلب الانضمام.");
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
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role={role} title="الدورات" lede={pageLede}>
      <PageToolbar>
        <input
          className="course-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالدورات..."
        />
        {role === "admin" ? (
          <>
            <button type="button" className="primary-btn toolbar-btn" onClick={onOpenCreateModal}>
              إضافة دورة
            </button>
            <Link to="/admin/enrollment-requests" className="ghost-btn toolbar-btn">
              طلبات الالتحاق
            </Link>
          </>
        ) : null}
        {role === "student" ? (
          <>
            <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
              مقرراتي
            </Link>
            <Link to="/student/enrollment-requests" className="ghost-btn toolbar-btn">
              طلباتي
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
          <ButtonBusyLabel busy={loading}>تحديث الدورات</ButtonBusyLabel>
        </button>
      </PageToolbar>

      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint text="جاري تحميل الدورات..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            search.trim()
              ? "لا نتائج تطابق البحث. جرّب كلمات أخرى أو امسح حقل البحث."
              : "لا توجد مقررات في القائمة بعد."
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
                <span>{course.courseType === "private" ? "خاصة" : "عامة"}</span>
                <span>{course.isActive ? "نشطة" : "موقفة"}</span>
                <span>{course.studentCount} طالب</span>
                <span>{course.lessonCount} درس</span>
              </div>
              <div className="course-actions">
                {role === "admin" ? (
                  <>
                    <Link
                      to={`/admin/preview/course/${course.id}`}
                      className="icon-tool-btn"
                      title="معاينة واجهة الطالب (المقرر والدروس)"
                      aria-label="معاينة المقرر كطالب"
                    >
                      <IoEyeOutline size={20} />
                      <span className="icon-tool-label">معاينة</span>
                    </Link>
                    <Link
                      to={`/admin/course/${course.id}/lessons`}
                      className="primary-btn"
                    >
                      دروس
                    </Link>
                    <button
                      className="ghost-btn"
                      onClick={() => onEdit(course)}
                      disabled={submitting}
                      type="button"
                      aria-busy={submitting}
                    >
                      <ButtonBusyLabel busy={submitting}>تعديل</ButtonBusyLabel>
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => onDelete(course)}
                      disabled={submitting}
                      type="button"
                      aria-busy={submitting}
                    >
                      <ButtonBusyLabel busy={submitting}>حذف</ButtonBusyLabel>
                    </button>
                  </>
                ) : (
                  <StudentCourseRowActions
                    course={course}
                    enrolled={enrolledIds.has(course.id)}
                    req={latestReqByCourse.get(course.id)}
                    submitting={submitting}
                    onRequest={() => void onRequest(course)}
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
          title={editingId ? "تعديل بيانات الدورة" : "إضافة دورة جديدة"}
          onClose={() => {
            if (!submitting) {
              resetForm();
            }
          }}
          contentClassName="course-form-modal"
        >
          <FormPanel onSubmit={onSubmit} elevated={false} className="course-form-modal__form">
            <SectionTitle as="h4">{editingId ? "تحديث الدورة" : "إضافة دورة"}</SectionTitle>
            <label>
              <span>عنوان الدورة</span>
              <input
                className="text-input"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="عنوان الدورة"
                required
              />
            </label>
            <label>
              <span>وصف مختصر</span>
              <input
                className="text-input"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="وصف مختصر"
                required
              />
            </label>
            <label>
              <span>رابط صورة الدورة (اختياري)</span>
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
                <span>نوع الدورة</span>
                <select
                  className="text-input"
                  value={form.courseType}
                  onChange={(e) => setForm((p) => ({ ...p, courseType: e.target.value as "public" | "private" }))}
                >
                  <option value="public">عامة</option>
                  <option value="private">خاصة</option>
                </select>
              </label>
              <label className="switch-line course-form-modal__switch">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span>نشطة في الكتالوج</span>
              </label>
            </div>
            <div className="course-actions">
              <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                <ButtonBusyLabel busy={submitting}>
                  {editingId ? "حفظ التعديلات" : "إنشاء دورة"}
                </ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
                إلغاء
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
}: {
  course: Course;
  enrolled: boolean;
  req: EnrollmentRequest | undefined;
  submitting: boolean;
  onRequest: () => void;
}) {
  const openCourse = `/student/course/${course.id}`;
  if (enrolled) {
    return (
      <>
        <Link to={openCourse} className="primary-btn">
          فتح المقرر
        </Link>
        <span className="meta-pill meta-pill--ok" title="ضمن مقرراتك">
          مسجّل
        </span>
      </>
    );
  }
  if (req?.status === "pending") {
    return (
      <span className="ghost-btn course-waiting-pill" aria-disabled>
        الطلب قيد المراجعة
      </span>
    );
  }
  if (req?.status === "approved") {
    return (
      <Link to={openCourse} className="primary-btn">
        فتح المقرر
      </Link>
    );
  }
  if (req?.status === "rejected" || req?.status === "expired") {
    return (
      <>
        <Link to="/student/enrollment-requests" className="ghost-btn">
          سجل الطلبات
        </Link>
        <button
          type="button"
          className="primary-btn"
          onClick={onRequest}
          disabled={submitting}
          aria-busy={submitting}
        >
          <ButtonBusyLabel busy={submitting}>
            {req.status === "rejected" ? "إعادة طلب الانضمام" : "طلب انضمام"}
          </ButtonBusyLabel>
        </button>
      </>
    );
  }
  return (
    <>
      <Link to={openCourse} className="ghost-btn">
        تفاصيل المقرر
      </Link>
      <button
        type="button"
        className="primary-btn"
        onClick={onRequest}
        disabled={submitting}
        aria-busy={submitting}
      >
        <ButtonBusyLabel busy={submitting}>طلب انضمام</ButtonBusyLabel>
      </button>
    </>
  );
}
