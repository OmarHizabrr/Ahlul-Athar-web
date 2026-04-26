import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  canStudentOpenLesson,
  getLessonQuizzesForStudent,
  type LessonQuizItem,
} from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { lessonsService } from "../services/lessonsService";
import type { Lesson } from "../types";
import { getYoutubeEmbedUrlFromWatchUrl } from "../utils/youtube";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

function LessonMedia({ lesson }: { lesson: Lesson }) {
  if (lesson.contentType === "video" && lesson.videoUrl) {
    const em = getYoutubeEmbedUrlFromWatchUrl(lesson.videoUrl);
    return (
      <div className="lesson-embed">
        {em ? (
          <div className="lesson-youtube-embed" style={{ width: "100%", maxWidth: 720 }}>
            <iframe
              title={lesson.title}
              src={em}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : null}
        <a href={lesson.videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          {em ? "فتح YouTube في تبويب جديد" : "فتح رابط الفيديو"}
        </a>
        <p className="muted small">روابط YouTube/Shorts تُعرض مُضمّنة تلقائياً عند الإمكان.</p>
      </div>
    );
  }
  if (lesson.pdfUrl) {
    return (
      <a href={lesson.pdfUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
        فتح الملف (PDF)
      </a>
    );
  }
  if (lesson.audioUrl) {
    return (
      <a href={lesson.audioUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
        فتح الملف الصوتي
      </a>
    );
  }
  return null;
}

export function StudentLessonViewPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const { user, ready } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quizzes, setQuizzes] = useState<LessonQuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!user || !courseId || !lessonId) {
      return;
    }
    setLoading(true);
    setErr("");
    const ok = await isStudentEnrolledInCourse(user.uid, courseId);
    if (!ok) {
      setErr("ليس لديك صلاحية لعرض دروس هذا المقرر.");
      setLesson(null);
      setQuizzes([]);
      setLoading(false);
      return;
    }
    const access = await canStudentOpenLesson(user.uid, courseId, lessonId);
    if (!access.ok) {
      setErr(access.message ?? "لا يمكن فتح هذا الدرس.");
      setLesson(null);
      setQuizzes([]);
      setLoading(false);
      return;
    }
    try {
      const L = await lessonsService.getById(courseId, lessonId);
      setLesson(L);
      const qz = await getLessonQuizzesForStudent(user.uid, lessonId);
      setQuizzes(qz);
    } catch {
      setErr("تعذر تحميل الدرس (صلاحيات أو الدرس غير موجود).");
      setLesson(null);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [user, courseId, lessonId]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  useEffect(() => {
    const onQuiz = () => {
      if (user) {
        void load();
      }
    };
    window.addEventListener("ah:quiz-updated", onQuiz);
    return () => window.removeEventListener("ah:quiz-updated", onQuiz);
  }, [user, load]);

  const lessonLede = "محتوى الدرس بعد التحقق من التسجيل في المقرر وقواعد فتح الدرس (مثل التطبيق).";

  if (!ready) {
    return (
      <DashboardLayout role="student" title="درس" lede={lessonLede}>
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="student" title={lesson?.title ?? "درس"} lede={lessonLede}>
      <p>
        <Link to={`/student/course/${courseId}`} className="inline-link">
          ← العودة لقائمة دروس المقرر
        </Link>
      </p>
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : err ? (
        <p className="message error">{err}</p>
      ) : !lesson ? (
        <p className="muted">الدرس غير موجود.</p>
      ) : (
        <>
          {lesson.description ? <p className="muted lesson-lead">{lesson.description}</p> : null}
          <p className="muted post-meta">
            {formatFirestoreTime(lesson.createdAt)} · {lesson.createdByName || "—"}
            {lesson.duration != null ? ` · ${lesson.duration} د` : ""}
            {lesson.difficulty ? ` · ${lesson.difficulty}` : ""}
          </p>
          <LessonMedia lesson={lesson} />
          {lesson.txtContent || lesson.content ? (
            <div className="lesson-body">
              <pre className="lesson-pre">{String(lesson.txtContent ?? lesson.content ?? "")}</pre>
            </div>
          ) : null}
          {quizzes.length > 0 ? (
            <div className="lesson-quiz-section">
              <h3 className="form-section-title">اختبارات الدرس</h3>
              <ul className="lesson-quiz-list">
                {quizzes.map((q) => (
                  <li key={q.quizFileId}>
                    <div className="lesson-quiz-row">
                      <span className="lesson-quiz-title">{q.title}</span>
                      <span className="lesson-quiz-pill" data-st={q.status}>
                        {q.status === "graded"
                          ? "مُتاح / مقيّم"
                          : q.status === "pending"
                            ? "قيد التصحيح"
                            : "لم يُرسل"}
                      </span>
                      <Link
                        className="ghost-btn"
                        to={`/student/course/${courseId}/lesson/${lessonId}/quiz/${q.quizFileId}`}
                      >
                        التفاصيل
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </DashboardLayout>
  );
}
