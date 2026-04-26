import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { useIsAdminPreview } from "../context/AdminPreviewContext";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { getLessonsForAdminPreview, getLessonsWithAccessForStudent } from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import type { Course, LessonWithAccess } from "../types";
import { DashboardLayout } from "./DashboardLayout";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  text: "نص",
  video: "فيديو",
  pdf: "PDF",
  audio: "صوت",
};

export function StudentCourseViewPage() {
  const { courseId = "" } = useParams();
  const { user, ready } = useAuth();
  const isAdminPreview = useIsAdminPreview();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonWithAccess[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const runLoad = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!user || !courseId) {
        return;
      }
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setMessage("");
      try {
        const c = await coursesService.getCourseById(courseId);
        setCourse(c);
        if (isAdminPreview) {
          setEnrolled(true);
          const L = await getLessonsForAdminPreview(courseId);
          setLessons(L);
        } else {
          const e = await isStudentEnrolledInCourse(user.uid, courseId);
          setEnrolled(e);
          if (e) {
            const L = await getLessonsWithAccessForStudent(user.uid, courseId);
            setLessons(L);
          } else {
            setLessons([]);
          }
        }
      } catch {
        setMessage("تعذر التحميل.");
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user, courseId, isAdminPreview],
  );

  useEffect(() => {
    if (ready && user && courseId) {
      void runLoad("initial");
    }
  }, [ready, user, courseId, runLoad]);

  useEffect(() => {
    const onQuiz = () => {
      if (user && courseId) {
        void runLoad("refresh");
      }
    };
    window.addEventListener("ah:quiz-updated", onQuiz);
    return () => window.removeEventListener("ah:quiz-updated", onQuiz);
  }, [user, courseId, runLoad]);

  const courseLede = isAdminPreview
    ? "معاينة واجهة الطالب: الدروس كما تظهر بلا قيود تسجيل (للمشرف فقط)."
    : "تفاصيل المقرر وقائمة الدروس مع القفل والتقدم — كما في تطبيق الجوال.";
  const layoutRole = isAdminPreview ? "admin" : "student";

  if (!ready) {
    return (
      <DashboardLayout role={layoutRole} title="مقرر" lede={courseLede}>
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const title = isAdminPreview
    ? course?.title
      ? `معاينة: ${course.title}`
      : "معاينة مقرر"
    : (course?.title ?? "مقرر");
  const viewRoot = isAdminPreview ? "/admin/preview" : "/student";

  return (
    <DashboardLayout role={layoutRole} title={title} lede={courseLede}>
      {loading ? (
        <PageLoadHint />
      ) : !course ? (
        <p className="message error">المقرر غير موجود.</p>
      ) : (
        <>
          {isAdminPreview ? (
            <p className="admin-preview-banner" role="status">
              <strong>معاينة واجهة الطالب</strong> — الروابط أدناه كما يراها طالب.{" "}
              <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
                العودة لإدارة الدروس
              </Link>
            </p>
          ) : null}
          {message ? <p className="message error">{message}</p> : null}
          <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
            <button
              type="button"
              className="ghost-btn toolbar-btn"
              onClick={() => void runLoad("refresh")}
              disabled={refreshing}
              aria-busy={refreshing}
            >
              <ButtonBusyLabel busy={refreshing}>تحديث المقرر</ButtonBusyLabel>
            </button>
            {isAdminPreview ? (
              <Link to={`/admin/course/${courseId}/lessons`} className="ghost-btn toolbar-btn">
                إدارة الدروس
              </Link>
            ) : (
              <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
                مقرراتي
              </Link>
            )}
          </div>
          <div className="card-elevated course-hero-surface">
            <p className="muted course-hero-lead">{course.description}</p>
            <div className="course-meta lesson-course-meta">
              <span>{course.lessonCount} درس</span>
              <span>{course.studentCount} طالب</span>
              <span>{course.isActive ? "نشط في الكتالوج" : "موقف"}</span>
            </div>
          </div>
          {!enrolled ? (
            <p className="message error">
              أنت لست مسجّلاً في هذا المقرر. أرسل طلب انضمام من «الدورات» ثم بعد قبول الإدارة ستظهر الدروس هنا.
            </p>
          ) : lessons.length === 0 ? (
            <div className="empty-state-card" style={{ maxWidth: "100%" }} role="status">
              <p className="muted" style={{ margin: 0 }}>
                لا توجد دروس مضافة لهذا المقرر بعد.
              </p>
            </div>
          ) : (
            <div className="course-list">
              <h3 className="form-section-title">الدروس</h3>
              {lessons.map((row, idx) => {
                const t = row.lesson.contentType?.trim();
                const tlab = t ? CONTENT_TYPE_LABEL[t] ?? t : "—";
                return (
                  <article
                    className={`course-item ${row.isUnlocked ? "" : "course-item--locked lesson-locked-card"}`}
                    key={row.lesson.id}
                  >
                    <h4 className="post-title">
                      <span className="lesson-index-pill" aria-hidden>
                        {idx + 1}
                      </span>{" "}
                      {row.lesson.title}
                    </h4>
                    {row.lesson.hasMandatoryQuiz ? (
                      <p className="muted small">يحتوي على اختبار إجباري (للدرس التالي)</p>
                    ) : null}
                    {row.lesson.description ? <p className="muted">{row.lesson.description}</p> : null}
                    <p className="muted post-meta">
                      نوع المحتوى: {tlab}
                      {row.lesson.videoUrl ? " · فيديو" : ""}
                      {row.lesson.pdfUrl ? " · PDF" : ""}
                      {row.lesson.audioUrl ? " · صوت" : ""}
                    </p>
                    {row.isUnlocked ? null : <p className="message error lock-hint">{row.blockHint ?? "الدرس مقفل"}</p>}
                    <div className="course-actions">
                      {row.isUnlocked ? (
                        <Link
                          className="primary-btn"
                          to={`${viewRoot}/course/${courseId}/lesson/${row.lesson.id}`}
                        >
                          فتح الدرس
                        </Link>
                      ) : (
                        <span className="ghost-btn lesson-locked-pill" aria-disabled>
                          مقفل
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
