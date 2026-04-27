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
import { useIsAdminPreview } from "../context/AdminPreviewContext";
import { useAuth } from "../context/AuthContext";
import { VideoIntroBlock } from "../components/VideoIntroBlock";
import { AlertMessage, SectionTitle } from "../components/ui";
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
  const isAdminPreview = useIsAdminPreview();
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
    if (!isAdminPreview) {
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
      const a = isAdminPreview ? null : await getStudentAnswerForQuiz(quizId, user.uid);
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
  }, [user, courseId, lessonId, quizId, isAdminPreview]);

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
  const scheduleBlocks = !schedule.allowed && !isAdminPreview;
  const formLocked = isAdminPreview || isGraded || scheduleBlocks;

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

  const answeredCount = useMemo(() => {
    if (rows.length === 0) {
      return 0;
    }
    let count = 0;
    for (const r of rows) {
      const raw = (values[r.key] ?? "").toString();
      if (r.kind === "true_false") {
        if (raw === "true" || raw === "false") {
          count += 1;
        }
        continue;
      }
      if (raw.trim().length > 0) {
        count += 1;
      }
    }
    return count;
  }, [rows, values]);
  const progressPct = rows.length > 0 ? Math.round((answeredCount / rows.length) * 100) : 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isAdminPreview || !user || formLocked || !hasStructuredQuestions) {
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

  const lede = isAdminPreview
    ? "معاينة اختبار الطالب: الإجابات للعرض فقط (لا يُرسل تسليم من وضع المشرف)."
    : "تُحفظ الإجابات بحالة completed كما في تطبيق الجوال، ثم تُراجع (graded) لاحقاً.";
  const layoutRole = isAdminPreview ? "admin" : "student";
  const lessonPageHref = isAdminPreview
    ? `/admin/preview/course/${courseId}/lesson/${lessonId}`
    : `/student/course/${courseId}/lesson/${lessonId}`;

  if (!ready) {
    return (
      <DashboardLayout role={layoutRole} title="اختبار" lede={lede}>
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
    <DashboardLayout role={layoutRole} title={isAdminPreview ? `معاينة: ${title}` : title} lede={lede}>
      {isAdminPreview ? (
        <p className="admin-preview-banner" role="status">
          <strong>معاينة واجهة الطالب</strong> — الإجابات للمراجعة البصرية فقط.{" "}
          <Link to={`/admin/course/${courseId}/lessons/${lessonId}/quizzes`} className="inline-link">
            تحرير الاختبار
          </Link>
        </p>
      ) : null}
      <p>
        <Link to={lessonPageHref} className="inline-link">
          ← العودة لصفحة الدرس
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : err ? (
        <AlertMessage kind="error">{err}</AlertMessage>
      ) : (
        <div className="quiz-view-card">
          <div className="quiz-status-row" aria-label="حالة الاختبار">
            <span
              className={
                isGraded
                  ? "meta-pill meta-pill--ok"
                  : status === "pending"
                    ? "meta-pill meta-pill--info"
                    : "meta-pill meta-pill--muted"
              }
            >
              {isGraded
                ? "تم التصحيح"
                : status === "pending"
                  ? "بانتظار التصحيح"
                  : "لم يُرسل بعد"}
            </span>
            <span className="meta-pill meta-pill--muted">
              {hasStructuredQuestions ? `${answeredCount}/${rows.length} مجاب` : "بدون أسئلة"}
            </span>
            {durationMin != null ? <span className="meta-pill meta-pill--muted">المدة: {Math.round(durationMin)} د</span> : null}
          </div>
          {hasStructuredQuestions ? (
            <div className="quiz-progress-wrap" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
              <div className="quiz-progress-bar" style={{ width: `${progressPct}%` }} />
            </div>
          ) : null}
          {scheduleBlocks && schedule.messageAr ? (
            <AlertMessage kind="error">{schedule.messageAr}</AlertMessage>
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
              <SectionTitle as="h3">الأسئلة</SectionTitle>
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
              {formErr ? <AlertMessage kind="error">{formErr}</AlertMessage> : null}
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
