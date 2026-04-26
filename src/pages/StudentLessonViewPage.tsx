import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { LessonContentView } from "../components/LessonContentView";
import { useAuth } from "../context/AuthContext";
import {
  canStudentOpenLesson,
  getLessonQuizzesForStudent,
  type LessonQuizItem,
} from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { lessonsService } from "../services/lessonsService";
import type { Lesson } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  text: "نص",
  video: "فيديو",
  pdf: "PDF",
  audio: "صوت",
};

export function StudentLessonViewPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const { user, ready } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quizzes, setQuizzes] = useState<LessonQuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const runLoad = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!user || !courseId || !lessonId) {
        return;
      }
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setErr("");
      const ok = await isStudentEnrolledInCourse(user.uid, courseId);
      if (!ok) {
        setErr("ليس لديك صلاحية لعرض دروس هذا المقرر.");
        setLesson(null);
        setQuizzes([]);
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
        return;
      }
      const access = await canStudentOpenLesson(user.uid, courseId, lessonId);
      if (!access.ok) {
        setErr(access.message ?? "لا يمكن فتح هذا الدرس.");
        setLesson(null);
        setQuizzes([]);
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
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
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user, courseId, lessonId],
  );

  useEffect(() => {
    if (ready && user) {
      void runLoad("initial");
    }
  }, [ready, user, runLoad]);

  useEffect(() => {
    const onQuiz = () => {
      if (user) {
        void runLoad("refresh");
      }
    };
    window.addEventListener("ah:quiz-updated", onQuiz);
    return () => window.removeEventListener("ah:quiz-updated", onQuiz);
  }, [user, runLoad]);

  if (!ready) {
    return (
      <DashboardLayout role="student" title="درس" lede={undefined}>
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
      title={lesson?.title ?? (loading ? "…" : "درس")}
      lede={undefined}
    >
      <p className="lesson-back">
        <Link to={`/student/course/${courseId}`} className="inline-link">
          ← العودة لقائمة دروس المقرر
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : err ? (
        <p className="message error">{err}</p>
      ) : !lesson ? (
        <div className="empty-state-card" style={{ maxWidth: "100%" }} role="status">
          <p className="muted" style={{ margin: 0 }}>
            الدرس غير موجود أو أُزيل.
          </p>
        </div>
      ) : (
        <StudentLessonBody
          courseId={courseId}
          lessonId={lessonId}
          lesson={lesson}
          quizzes={quizzes}
          onRefresh={() => void runLoad("refresh")}
          refreshing={refreshing}
        />
      )}
    </DashboardLayout>
  );
}

function StudentLessonBody({
  courseId,
  lessonId,
  lesson,
  quizzes,
  onRefresh,
  refreshing,
}: {
  courseId: string;
  lessonId: string;
  lesson: Lesson;
  quizzes: LessonQuizItem[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const ct = lesson.contentType?.trim().toLowerCase() ?? "";
  const typeLabel = ct ? CONTENT_TYPE_LABEL[ct] ?? lesson.contentType : null;

  return (
    <article className="lesson-reader">
      <div className="toolbar lesson-toolbar">
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <ButtonBusyLabel busy={refreshing}>تحديث</ButtonBusyLabel>
        </button>
      </div>

      <div className="lesson-hero card-elevated">
        {lesson.imageUrl ? (
          <div className="lesson-hero-cover">
            <img
              src={lesson.imageUrl}
              alt={lesson.title}
              className="lesson-hero-img"
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
        <div className="lesson-hero-inner">
          {lesson.description ? <p className="lesson-hero-sub">{lesson.description}</p> : null}
          <div className="lesson-chips" aria-label="معلومات الدرس">
            {typeLabel ? (
              <span className="meta-pill meta-pill--info" title="نوع المحتوى">
                {typeLabel}
              </span>
            ) : null}
            {lesson.duration != null ? <span className="meta-pill meta-pill--muted">{lesson.duration} دقيقة</span> : null}
            {lesson.difficulty ? <span className="meta-pill meta-pill--muted">{lesson.difficulty}</span> : null}
            {lesson.hasMandatoryQuiz ? (
              <span className="meta-pill meta-pill--ok" title="للمتابعة إلى الدرس التالي">
                اختبار إجباري
              </span>
            ) : null}
          </div>
          <p className="lesson-hero-meta muted small">
            {formatFirestoreTime(lesson.createdAt)}
            {lesson.createdByName ? ` · ${lesson.createdByName}` : ""}
          </p>
        </div>
      </div>

      {lesson.hasMandatoryQuiz ? (
        <p className="lesson-mandatory-hint muted small" role="note">
          قد يُطلب اجتياز اختبار هذا الدرس حسب إعدادات المقرر للانتقال للدرس التالي.
        </p>
      ) : null}

      <LessonContentView lesson={lesson} />

      {quizzes.length > 0 ? (
        <div className="lesson-quiz-section">
          <h3 className="form-section-title">اختبارات الدرس</h3>
          <ul className="lesson-quiz-list">
            {quizzes.map((q) => (
              <li key={q.quizFileId}>
                <div className="lesson-quiz-row">
                  <span className="lesson-quiz-title">{q.title}</span>
                  <span className="lesson-quiz-pill" data-st={q.status === "none" ? "none" : q.status}>
                    {q.status === "graded"
                      ? "مُتاح / مقيّم"
                      : q.status === "pending"
                        ? "مُرسل — بانتظار التصحيح"
                        : "لم يُرسل بعد"}
                  </span>
                  <Link
                    className="ghost-btn"
                    to={`/student/course/${courseId}/lesson/${lessonId}/quiz/${q.quizFileId}`}
                  >
                    فتح الاختبار
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
