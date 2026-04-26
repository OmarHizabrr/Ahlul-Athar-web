import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { getLessonsWithAccessForStudent } from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import type { Course, LessonWithAccess } from "../types";
import { DashboardLayout } from "./DashboardLayout";

export function StudentCourseViewPage() {
  const { courseId = "" } = useParams();
  const { user, ready } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonWithAccess[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user || !courseId) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const c = await coursesService.getCourseById(courseId);
      setCourse(c);
      const e = await isStudentEnrolledInCourse(user.uid, courseId);
      setEnrolled(e);
      if (e) {
        const L = await getLessonsWithAccessForStudent(user.uid, courseId);
        setLessons(L);
      } else {
        setLessons([]);
      }
    } catch {
      setMessage("تعذر التحميل.");
    } finally {
      setLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => {
    if (ready && user && courseId) {
      void load();
    }
  }, [ready, user, courseId, load]);

  if (!ready) {
    return (
      <DashboardLayout role="student" title="مقرر">
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const title = course?.title ?? "مقرر";

  return (
    <DashboardLayout role="student" title={title}>
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : !course ? (
        <p className="message error">المقرر غير موجود.</p>
      ) : (
        <>
          {message ? <p className="message error">{message}</p> : null}
          <p className="muted">{course.description}</p>
          <div className="course-meta lesson-course-meta">
            <span>{course.lessonCount} درس</span>
            <span>{course.studentCount} طالب</span>
            <span>{course.isActive ? "نشط في الكتالوج" : "موقف"}</span>
          </div>
          {!enrolled ? (
            <p className="message error">
              أنت لست مسجّلاً في هذا المقرر. أرسل طلب انضمام من «الدورات» ثم بعد قبول الإدارة ستظهر الدروس هنا.
            </p>
          ) : lessons.length === 0 ? (
            <p className="muted">لا توجد دروس مضافة بعد.</p>
          ) : (
            <div className="course-list">
              <h3 className="form-section-title">الدروس</h3>
              {lessons.map((row) => (
                <article
                  className={`course-item ${row.isUnlocked ? "" : "lesson-locked-card"}`}
                  key={row.lesson.id}
                >
                  <h4 className="post-title">{row.lesson.title}</h4>
                  {row.lesson.hasMandatoryQuiz ? (
                    <p className="muted small">يحتوي على اختبار إجباري (للدرس التالي)</p>
                  ) : null}
                  {row.lesson.description ? <p className="muted">{row.lesson.description}</p> : null}
                  <p className="muted post-meta">نوع المحتوى: {row.lesson.contentType || "نص"}</p>
                  {row.isUnlocked ? null : (
                    <p className="message error lock-hint">{row.blockHint ?? "الدرس مقفل"}</p>
                  )}
                  <div className="course-actions">
                    {row.isUnlocked ? (
                      <Link
                        className="primary-btn"
                        to={`/student/course/${courseId}/lesson/${row.lesson.id}`}
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
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
