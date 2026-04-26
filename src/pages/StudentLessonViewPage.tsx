import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { lessonsService } from "../services/lessonsService";
import type { Lesson } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

function LessonMedia({ lesson }: { lesson: Lesson }) {
  if (lesson.contentType === "video" && lesson.videoUrl) {
    return (
      <div className="lesson-embed">
        <a href={lesson.videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          فتح رابط الفيديو
        </a>
        <p className="muted small">يفتح رابط التخزين (YouTube/خارجي) — كما في التطبيق.</p>
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
      setLoading(false);
      return;
    }
    try {
      const L = await lessonsService.getById(courseId, lessonId);
      setLesson(L);
    } catch {
      setErr("تعذر تحميل الدرس (صلاحيات أو الدرس غير موجود).");
      setLesson(null);
    } finally {
      setLoading(false);
    }
  }, [user, courseId, lessonId]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  if (!ready) {
    return (
      <DashboardLayout role="student" title="درس">
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="student" title={lesson?.title ?? "درس"}>
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
        </>
      )}
    </DashboardLayout>
  );
}
