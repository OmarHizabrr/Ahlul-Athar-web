import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  canStudentOpenLesson,
  getQuizFileById,
  getStudentAnswerForQuiz,
  submitOrUpdateStudentQuiz,
} from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { useAuth } from "../context/AuthContext";
import { extractQuizRows, readStoredAnswers, type WebQuizRow } from "../utils/quizFromFirestore";
import { getYoutubeEmbedUrlFromWatchUrl } from "../utils/youtube";
import { DashboardLayout } from "./DashboardLayout";

function getAnswerStatus(ans: Record<string, unknown> | null): "none" | "pending" | "graded" {
  if (ans == null) {
    return "none";
  }
  return String(ans.status ?? "") === "graded" ? "graded" : "pending";
}

function QuizTakerForm({
  rows,
  values,
  onChange,
  onSubmit,
  submitting,
  readonly,
  submitLabel,
}: {
  rows: WebQuizRow[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  readonly: boolean;
  submitLabel: string;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <form className="quiz-taker-form" onSubmit={onSubmit}>
      <ol className="quiz-questions">
        {rows.map((q, idx) => (
          <li key={q.key} className="quiz-question">
            <p className="quiz-qtext">
              {idx + 1}. {q.text}
            </p>
            {q.options && q.options.length > 0 ? (
              <div className="quiz-options" role="group" aria-label={q.text}>
                {q.options.map((opt) => (
                  <label key={opt} className="quiz-opt-line">
                    <input
                      type="radio"
                      name={q.key}
                      value={opt}
                      checked={values[q.key] === opt}
                      onChange={() => onChange(q.key, opt)}
                      disabled={readonly}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="text-input textarea"
                rows={3}
                value={values[q.key] ?? ""}
                onChange={(e) => onChange(q.key, e.target.value)}
                readOnly={readonly}
                required={!readonly}
                placeholder="إجابتك"
              />
            )}
          </li>
        ))}
      </ol>
      {readonly ? null : (
        <button className="primary-btn" type="submit" disabled={submitting}>
          {submitting ? "جاري الإرسال..." : submitLabel}
        </button>
      )}
    </form>
  );
}

export function StudentQuizViewPage() {
  const { courseId = "", lessonId = "", quizId = "" } = useParams();
  const { user, ready } = useAuth();
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null);
  const [answer, setAnswer] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [formErr, setFormErr] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

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

  const rows = useMemo(() => (quiz != null ? extractQuizRows(quiz) : []), [quiz]);
  const status = getAnswerStatus(answer);
  const isGraded = status === "graded";
  const hasStructuredQuestions = rows.length > 0;

  useEffect(() => {
    if (quiz == null) {
      return;
    }
    const stored = readStoredAnswers(answer);
    const next: Record<string, string> = {};
    for (const r of rows) {
      next[r.key] = stored?.[r.key] ?? "";
    }
    setValues(next);
  }, [quiz, answer, rows]);

  const onChange = (key: string, v: string) => {
    setValues((p) => ({ ...p, [key]: v }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || isGraded || !hasStructuredQuestions) {
      return;
    }
    for (const r of rows) {
      if (!(values[r.key] ?? "").toString().trim()) {
        setFormErr("أكمل جميع الأسئلة قبل الإرسال.");
        return;
      }
    }
    setFormErr("");
    setSubmitting(true);
    try {
      const docId = answer != null && String((answer as { id?: string }).id ?? "") ? String((answer as { id: string }).id) : null;
      await submitOrUpdateStudentQuiz(quizId, user.uid, values, docId);
      await load();
      window.dispatchEvent(new CustomEvent("ah:quiz-updated"));
    } catch {
      setFormErr("تعذر حفظ الإجابة. تحقق من الاتصال وصلاحيات Firestore.");
    } finally {
      setSubmitting(false);
    }
  };

  const lede =
    "إجاباتك تُحفظ في quiz_answers مع حالة submitted حتى يُقيّم المسؤول (graded) — كما في تطبيق الجوال.";

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

  const title = String(
    quiz?.title ?? (quiz as { name?: string } | null)?.name ?? (quiz as { quizTitle?: string } | null)?.quizTitle ?? "اختبار",
  );
  const desc = String(quiz?.description ?? (quiz as { body?: string } | null)?.body ?? "");
  const mediaUrl = String(
    (quiz as { videoUrl?: string; mediaUrl?: string } | null)?.videoUrl ?? (quiz as { mediaUrl?: string }).mediaUrl ?? "",
  );
  const embed = mediaUrl ? getYoutubeEmbedUrlFromWatchUrl(mediaUrl) : null;

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
            {isGraded
              ? "تم التصحيح (graded)"
              : status === "pending"
                ? "تم الإرسال — بانتظار التصحيح من الإدارة"
                : "لم يُرسل بعد"}
          </p>
          {desc.length > 0 ? <p className="quiz-desc">{desc}</p> : null}
          {embed ? (
            <div className="quiz-video-embed">
              <iframe
                title="مقطع الاختبار"
                src={embed}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : null}
          {answer != null && (answer.score != null || answer.grade != null) ? (
            <p className="quiz-score">
              الدرجة: {String((answer as { score?: unknown }).score ?? (answer as { grade?: unknown }).grade)}
            </p>
          ) : null}

          {hasStructuredQuestions ? (
            <>
              <h3 className="form-section-title">الأسئلة</h3>
              {isGraded ? (
                <p className="muted small">النتيجة مُتاحة — عرض إجاباتك أدناه (قراءة فقط).</p>
              ) : null}
              <QuizTakerForm
                rows={rows}
                values={values}
                onChange={onChange}
                onSubmit={onSubmit}
                submitting={submitting}
                readonly={isGraded}
                submitLabel={status === "pending" ? "تحديث الإجابات" : "إرسال الإجابات"}
              />
              {formErr ? <p className="message error">{formErr}</p> : null}
            </>
          ) : (
            <p className="muted small quiz-hint">
              لا تتوفر «أسئلة» منظّمة في بيانات هذا الاختبار في Firestore. إن كان الاختبار يُبنى فقط داخل
              تطبيق الجوال، فاستخدمه هناك؛ وإلا تابع مع الإدارة لإضافة مصفوفة <code>questions</code> في وثيقة
              الاختبار ليظهر النموذج تلقائياً.
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
