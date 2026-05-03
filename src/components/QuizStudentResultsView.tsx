import { AlertMessage, Panel, SectionTitle } from "./ui";
import type { QuizQuestionDef } from "../services/lessonAccessService";
import { formatFirestoreTime } from "../utils/firestoreTime";

const P = "web_pages.student_quiz.results" as const;

function readObjMap(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function formatStudentAnswer(val: unknown, t: (k: string, f?: string) => string): string {
  if (val === undefined || val === null) {
    return "";
  }
  if (typeof val === "boolean") {
    return val ? t(`${P}.true_label`, "صح") : t(`${P}.false_label`, "خطأ");
  }
  return String(val);
}

function numOrZero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function QuizStudentResultsView({
  questions,
  answer,
  t,
}: {
  questions: QuizQuestionDef[];
  answer: Record<string, unknown> | null;
  t: (key: string, fallback?: string) => string;
}) {
  if (questions.length === 0) {
    return <p className="muted small">{t(`${P}.no_questions`, "لا توجد أسئلة لعرض النتيجة.")}</p>;
  }

  if (answer == null) {
    return (
      <Panel className="quiz-results-empty">
        <p className="muted">{t(`${P}.not_submitted`, "لم يُرسل الاختبار بعد. انتقل إلى تبويب «الأسئلة» للإجابة والإرسال.")}</p>
      </Panel>
    );
  }

  const status = String(answer.status ?? "pending").toLowerCase();
  const answersMap = readObjMap(answer.answers);
  const gradesMap = readObjMap(answer.questionGrades);
  const notesMap = readObjMap(answer.questionNotes);

  const answeredKeys = Object.keys(answersMap).filter((k) => {
    const v = answersMap[k];
    if (typeof v === "boolean") {
      return true;
    }
    return v != null && String(v).trim() !== "";
  });
  const answeredCount = questions.filter((q) => answeredKeys.includes(q.id)).length;

  let totalGrade = 0;
  for (const q of questions) {
    totalGrade += numOrZero(gradesMap[q.id]);
  }
  const maxTotal = questions.reduce((s, q) => s + q.maxPoints, 0);
  const pct = maxTotal > 0 ? Math.round((totalGrade / maxTotal) * 100) : 0;

  const a = answer as Record<string, unknown>;
  const adminFeedback = [a.adminNotes, a.feedback, a.teacherNotes, a.reviewNotes]
    .map((x) => (x != null ? String(x).trim() : ""))
    .find((s) => s.length > 0);

  const scoreTop =
    answer.score != null || answer.grade != null
      ? String(answer.score ?? answer.grade)
      : status === "graded"
        ? `${totalGrade}/${maxTotal}`
        : null;

  return (
    <div className="quiz-results-root">
      <div className="quiz-results-summary" role="region" aria-label={t(`${P}.summary_aria`, "ملخص النتيجة")}>
        <div className="quiz-results-summary-grid">
          <div className="quiz-results-stat quiz-results-stat--primary">
            <span className="quiz-results-stat-label">{t(`${P}.answered`, "أسئلة مجابة")}</span>
            <span className="quiz-results-stat-value">
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className="quiz-results-stat quiz-results-stat--grade">
            <span className="quiz-results-stat-label">{t(`${P}.total_grade`, "الدرجة")}</span>
            <span className="quiz-results-stat-value">
              {status === "graded" || totalGrade > 0 ? `${totalGrade}/${maxTotal}` : "—"}
            </span>
          </div>
          <div className={`quiz-results-stat quiz-results-stat--pct quiz-results-stat--pct-${pct >= 80 ? "hi" : pct >= 60 ? "mid" : "lo"}`}>
            <span className="quiz-results-stat-label">{t(`${P}.percentage`, "النسبة")}</span>
            <span className="quiz-results-stat-value">{status === "graded" || totalGrade > 0 ? `${pct}%` : "—"}</span>
          </div>
          <div className="quiz-results-stat quiz-results-stat--muted">
            <span className="quiz-results-stat-label">{t(`${P}.submitted_at`, "تاريخ الإرسال")}</span>
            <span className="quiz-results-stat-value">{formatFirestoreTime(answer.submittedAt ?? answer.updatedAt)}</span>
          </div>
        </div>
        {scoreTop && status === "graded" ? (
          <p className="quiz-results-scoreline">
            <strong>{t(`${P}.score_label`, "الدرجة المسجّلة")}:</strong> {scoreTop}
          </p>
        ) : null}
      </div>

      {adminFeedback ? (
        <AlertMessage kind="info">
          <strong>{t(`${P}.admin_feedback`, "ملاحظات المشرف")}:</strong> {adminFeedback}
        </AlertMessage>
      ) : null}

      {status === "pending" && answeredCount > 0 ? (
        <p className="muted small quiz-results-pending-hint">{t(`${P}.pending_hint`, "الإجابات مُرسلة وبانتظار التصحيح من الإدارة.")}</p>
      ) : null}

      <SectionTitle as="h3">{t(`${P}.per_question`, "تفاصيل الأسئلة")}</SectionTitle>
      <ul className="quiz-results-questions">
        {questions.map((q, index) => {
          const rawAns = answersMap[q.id];
          const hasAns = rawAns !== undefined && (typeof rawAns === "boolean" || String(rawAns).trim() !== "");
          const gradeVal = gradesMap[q.id];
          const hasNumericGrade = gradeVal !== undefined && gradeVal !== null && String(gradeVal) !== "" && !Number.isNaN(Number(gradeVal));
          const gradeNum = hasNumericGrade ? numOrZero(gradeVal) : null;
          const note = notesMap[q.id] != null ? String(notesMap[q.id]) : "";
          const borderMod =
            gradeNum != null
              ? gradeNum >= q.maxPoints * 0.8
                ? "ok"
                : gradeNum >= q.maxPoints * 0.6
                  ? "mid"
                  : "low"
              : hasAns
                ? "answered"
                : "empty";

          return (
            <li key={q.id} className={`quiz-results-qcard quiz-results-qcard--${borderMod}`}>
              <div className="quiz-results-qhead">
                <span className="quiz-results-qnum">{index + 1}</span>
                <h4 className="quiz-results-qtitle">{q.title || t(`${P}.untitled`, "سؤال")}</h4>
                {gradeNum != null && status === "graded" ? (
                  <span className={`meta-pill quiz-results-grade-pill quiz-results-grade-pill--${borderMod}`}>
                    {gradeNum}/{q.maxPoints}
                  </span>
                ) : hasAns && status === "graded" ? (
                  <span className="meta-pill meta-pill--warn">{t(`${P}.pending_grade`, "بانتظار الدرجة")}</span>
                ) : hasAns ? (
                  <span className="meta-pill meta-pill--info">{t(`${P}.answered_badge`, "مُجاب")}</span>
                ) : (
                  <span className="meta-pill meta-pill--muted">{t(`${P}.skipped`, "بدون إجابة")}</span>
                )}
              </div>
              {q.body ? <p className="quiz-results-qbody">{q.body}</p> : null}

              <div className="quiz-results-block quiz-results-block--answer">
                <strong>{t(`${P}.your_answer`, "إجابتك")}</strong>
                {hasAns ? (
                  <p>{formatStudentAnswer(rawAns, t)}</p>
                ) : (
                  <p className="quiz-results-missing">{t(`${P}.not_answered`, "لم تُجب عن هذا السؤال.")}</p>
                )}
              </div>

              {q.correctAnswer && String(q.correctAnswer).trim() ? (
                <div className="quiz-results-block quiz-results-block--correct">
                  <strong>{t(`${P}.correct_answer`, "الإجابة المرجعية")}</strong>
                  <p>{q.correctAnswer}</p>
                </div>
              ) : null}

              {note.trim() ? (
                <div className="quiz-results-block quiz-results-block--note">
                  <strong>{t(`${P}.teacher_notes`, "ملاحظات المدرّس")}</strong>
                  <p>{note}</p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
