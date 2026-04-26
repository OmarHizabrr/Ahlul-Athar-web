import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canStudentOpenLesson, getQuizFileById, getStudentAnswerForQuiz } from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { DashboardLayout } from "./DashboardLayout";

function getAnswerStatus(ans: Record<string, unknown> | null): "none" | "pending" | "graded" {
  if (ans == null) {
    return "none";
  }
  return String(ans.status ?? "") === "graded" ? "graded" : "pending";
}

export function StudentQuizViewPage() {
  const { courseId = "", lessonId = "", quizId = "" } = useParams();
  const { user, ready } = useAuth();
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null);
  const [answer, setAnswer] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!user || !courseId || !lessonId || !quizId) {
      return;
    }
    setLoading(true);
    setErr("");
    const en = await isStudentEnrolledInCourse(user.uid, courseId);
    if (!en) {
      setErr("لست مسجّلاً في هذا المقرر.");
      setQuiz(null);
      setAnswer(null);
      setLoading(false);
      return;
    }
    const acc = await canStudentOpenLesson(user.uid, courseId, lessonId);
    if (!acc.ok) {
      setErr(acc.message ?? "لا يمكن الوصول إلى هذا الدرس.");
      setQuiz(null);
      setAnswer(null);
      setLoading(false);
      return;
    }
    const qd = await getQuizFileById(lessonId, quizId);
    if (qd == null) {
      setErr("الاختبار غير موجود.");
      setQuiz(null);
      setAnswer(null);
    } else {
      setQuiz(qd as Record<string, unknown>);
      const a = await getStudentAnswerForQuiz(quizId, user.uid);
      setAnswer(a);
    }
    setLoading(false);
  }, [user, courseId, lessonId, quizId]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  const lede = "حالة الاختبار وإدخال الإجابات — التطبيق الكامل وFlutter يتعاملان مع تسليم الأسئلة التفصيلي.";

  if (!ready) {
    return (
      <DashboardLayout role="student" title="اختبار" lede={lede}>
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  const title = String(quiz?.title ?? quiz?.name ?? (quiz as { quizTitle?: string } | null)?.quizTitle ?? "اختبار");
  const status = getAnswerStatus(answer);

  return (
    <DashboardLayout role="student" title={title} lede={lede}>
      <p>
        <Link to={`/student/course/${courseId}/lesson/${lessonId}`} className="inline-link">
          ← العودة لصفحة الدرس
        </Link>
      </p>
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : err ? (
        <p className="message error">{err}</p>
      ) : (
        <div className="quiz-view-card">
          <p className="muted small">
            حالة تسليمك:{" "}
            {status === "graded"
              ? "تم التصحيح (graded)"
              : status === "pending"
                ? "تم الإرسال — بانتظار التصحيح"
                : "لم يُرسل بعد"}
          </p>
          {String(quiz?.description ?? (quiz as { body?: string } | null)?.body ?? "").length > 0 ? (
            <p className="quiz-desc">{String(quiz?.description ?? (quiz as { body?: string }).body)}</p>
          ) : null}
          {answer != null && (answer.score != null || answer.grade != null) ? (
            <p className="quiz-score">
              الدرجة: {String((answer as { score?: unknown }).score ?? (answer as { grade?: unknown }).grade)}
            </p>
          ) : null}
          <p className="muted small quiz-hint">
            لإدخال الإجابات وسلسلة أسئلة كاملة مثل تطبيق الجوال، استخدم تطبيق أهل الأثر إن وُجد؛ الويب هنا يعرض حالة
            التقدم المتزامنة مع Firestore.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
