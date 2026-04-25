import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { authService } from "../services/authService";
import { coursesService } from "../services/coursesService";
import type { Course, UserRole } from "../types";

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
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>(initialForm);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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

      <input
        className="course-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث بالدورات..."
      />

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
    </DashboardLayout>
  );
}
