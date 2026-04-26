import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  canStudentOpenLesson,
  evaluateQuizSchedule,
  getQuizFileById,
  getQuizQuestionsWithOptions,
  getStudentAnswerForQuiz,
  submitOrUpdateStudentQuiz,
  webRowsToQuestionDefs,
  type QuizQuestionDef,
} from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { useAuth } from "../context/AuthContext";
import { VideoIntroBlock } from "../components/VideoIntroBlock";
import { extractQuizRows, readStoredAnswers, type WebQuizRow } from "../utils/quizFromFirestore";
import { DashboardLayout } from "./DashboardLayout";

function getAnswerStatus(ans: Record<string, unknown> | null): "none" | "pending" | "graded" {
  if (ans == null) {
    return "none";
  }
  return String(ans.status ?? "") === "graded" ? "graded" : "pending";
}

function questionDefsToWebRows(defs: QuizQuestionDef[]): WebQuizRow[] {
  return defs.map((d) => ({
    key: d.id,
    title: d.title,
    body: d.body,
    text: d.title && d.body ? `${d.title}\n${d.body}` : d.body || d.title,
    kind: d.kind,
    options: d.kind === "multiple_choice" && d.optionTexts.length > 0 ? d.optionTexts : undefined,
  }));
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
            <div className="quiz-qtext">
              <span className="quiz-qnum">{idx + 1}.</span>
              {q.title ? <span className="quiz-qtitle">{q.title}</span> : null}
              {q.body ? (
                <p className="quiz-qbody">
                  {q.body}
                </p>
              ) : !q.title ? (
                <p className="quiz-qbody">{q.text}</p>
              ) : null}
            </div>
            {q.kind === "true_false" ? (
              <div className="quiz-options" role="group" aria-label={q.text}>
                <label className="quiz-opt-line">
                  <input
                    type="radio"
                    name={q.key}
                    value="true"
                    checked={values[q.key] === "true"}
                    onChange={() => onChange(q.key, "true")}
                    disabled={readonly}
                  />
                  <span>صح</span>
                </label>
                <label className="quiz-opt-line">
                  <input
                    type="radio"
                    name={q.key}
                    value="false"
                    checked={values[q.key] === "false"}
                    onChange={() => onChange(q.key, "false")}
                    disabled={readonly}
                  />
                  <span>خطأ</span>
                </label>
              </div>
            ) : q.options && q.options.length > 0 ? (
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
        <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
          <ButtonBusyLabel busy={submitting}>{submitLabel}</ButtonBusyLabel>
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
  const [questionDefs, setQuestionDefs] = useState<QuizQuestionDef[]>([]);
  const [rows, setRows] = useState<WebQuizRow[]>([]);
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
      setRows([]);
      setQuestionDefs([]);
      setLoading(false);
      return;
    }
    const acc = await canStudentOpenLesson(user.uid, courseId, lessonId);
    if (!acc.ok) {
      setErr(acc.message ?? "لا يمكن الوصول إلى هذا الدرس.");
      setQuiz(null);
      setAnswer(null);
      setRows([]);
      setQuestionDefs([]);
      setLoading(false);
      return;
    }
    const qd = await getQuizFileById(lessonId, quizId);
    if (qd == null) {
      setErr("الاختبار غير موجود.");
      setQuiz(null);
      setAnswer(null);
      setRows([]);
      setQuestionDefs([]);
    } else {
      const asRecord = qd as Record<string, unknown>;
      setQuiz(asRecord);
      const a = await getStudentAnswerForQuiz(quizId, user.uid);
      setAnswer(a);

      const fromSub = await getQuizQuestionsWithOptions(quizId);
      const legacy = extractQuizRows(asRecord);
      if (fromSub.length > 0) {
        setQuestionDefs(fromSub);
        setRows(questionDefsToWebRows(fromSub));
      } else if (legacy.length > 0) {
        setRows(legacy);
        setQuestionDefs(webRowsToQuestionDefs(legacy));
      } else {
        setRows([]);
        setQuestionDefs([]);
      }
    }
    setLoading(false);
  }, [user, courseId, lessonId, quizId]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  useEffect(() => {
    const onQ = () => {
      if (user) {
        void load();
      }
    };
    window.addEventListener("ah:quiz-updated", onQ);
    return () => window.removeEventListener("ah:quiz-updated", onQ);
  }, [user, load]);

  const status = getAnswerStatus(answer);
  const isGraded = status === "graded";
  const hasStructuredQuestions = questionDefs.length > 0;
  const schedule = useMemo(
    () => (quiz != null ? evaluateQuizSchedule(quiz) : { allowed: true as const }),
    [quiz],
  );
  const scheduleBlocks = !schedule.allowed;
  const formLocked = isGraded || scheduleBlocks;

  useEffect(() => {
    if (quiz == null) {
      return;
    }
    const keys = rows.map((r) => r.key);
    const stored = readStoredAnswers(answer, keys);
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
    if (!user || formLocked || !hasStructuredQuestions) {
      return;
    }
    for (const r of rows) {
      if (r.kind === "true_false") {
        const v = values[r.key] ?? "";
        if (v !== "true" && v !== "false") {
          setFormErr("أكمل جميع الأسئلة قبل الإرسال.");
          return;
        }
        continue;
      }
      if (!(values[r.key] ?? "").toString().trim()) {
        setFormErr("أكمل جميع الأسئلة قبل الإرسال.");
        return;
      }
    }
    setFormErr("");
    setSubmitting(true);
    try {
      const docId = answer != null && String((answer as { id?: string }).id ?? "") ? String((answer as { id: string }).id) : null;
      const name = user.displayName?.trim() || user.email?.trim() || "";
      await submitOrUpdateStudentQuiz(
        quizId,
        user.uid,
        name,
        questionDefs,
        values,
        docId,
      );
      await load();
      window.dispatchEvent(new CustomEvent("ah:quiz-updated"));
    } catch {
      setFormErr("تعذر حفظ الإجابة. تحقق من الاتصال وصلاحيات Firestore.");
    } finally {
      setSubmitting(false);
    }
  };

  const lede =
    "تُحفظ الإجابات بحالة completed كما في تطبيق الجوال، ثم تُراجع (graded) لاحقاً.";

  if (!ready) {
    return (
      <DashboardLayout role="student" title="اختبار" lede={lede}>
        <PageLoadHint text="جاري التهيئة..." />
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
  const durationMin = (() => {
    const v = (quiz as { duration?: unknown } | null)?.duration;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    if (v != null && v !== "" && !Number.isNaN(Number(v))) {
      const n = Number(v);
      return n > 0 ? n : null;
    }
    return null;
  })();
  const mediaUrl = String(
    (quiz as { videoUrl?: string; mediaUrl?: string } | null)?.videoUrl ?? (quiz as { mediaUrl?: string }).mediaUrl ?? "",
  );

  return (
    <DashboardLayout role="student" title={title} lede={lede}>
      <p>
        <Link to={`/student/course/${courseId}/lesson/${lessonId}`} className="inline-link">
          ← العودة لصفحة الدرس
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
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
          {scheduleBlocks && schedule.messageAr ? <p className="message error">{schedule.messageAr}</p> : null}
          {durationMin != null ? (
            <p className="muted small quiz-quiz-duration">
              المدة: {Math.round(durationMin)} د
            </p>
          ) : null}
          {desc.length > 0 ? <p className="quiz-desc">{desc}</p> : null}
          {mediaUrl.trim() ? <VideoIntroBlock mediaUrl={mediaUrl} title="مقطع الاختبار" /> : null}
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
                readonly={formLocked}
                submitLabel={status === "pending" ? "تحديث الإجابات" : "إرسال الإجابات"}
              />
              {formErr ? <p className="message error">{formErr}</p> : null}
            </>
          ) : (
            <p className="muted small quiz-hint">
              لا تتوفر أسئلة لهذا الاختبار في{" "}
              <code>quiz_questions</code> ولا مصفوفة <code>questions</code> داخل وثيقة الاختبار. راجع
              الإدارة أو أضف الأسئلة من لوحة التحكم / التطبيق.
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
