import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
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
import { useI18n } from "../context/I18nContext";
import { QuizStudentResultsView } from "../components/QuizStudentResultsView";
import { VideoIntroBlock } from "../components/VideoIntroBlock";
import { AlertMessage, AppTabPanel, AppTabs, SectionTitle } from "../components/ui";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { extractQuizRows, readStoredAnswers, type WebQuizRow } from "../utils/quizFromFirestore";
import { DashboardLayout } from "./DashboardLayout";

const SQ = "web_pages.student_quiz" as const;
const QUIZ_TIMER_SS = "ah-quiz-timer-start:";

function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type QuizAnswerStatus = "none" | "pending" | "graded" | "approved" | "rejected";

function getAnswerStatus(ans: Record<string, unknown> | null): QuizAnswerStatus {
  if (ans == null) {
    return "none";
  }
  const s = String(ans.status ?? "").toLowerCase();
  if (s === "graded") {
    return "graded";
  }
  if (s === "approved") {
    return "approved";
  }
  if (s === "rejected") {
    return "rejected";
  }
  return "pending";
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
  answeredPill,
  trueLabel,
  falseLabel,
  answerPlaceholder,
}: {
  rows: WebQuizRow[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  readonly: boolean;
  submitLabel: string;
  answeredPill: string;
  trueLabel: string;
  falseLabel: string;
  answerPlaceholder: string;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <form className="quiz-taker-form" onSubmit={onSubmit}>
      <ol className="quiz-questions">
        {rows.map((q, idx) => {
          const raw = (values[q.key] ?? "").toString();
          const answered =
            q.kind === "true_false"
              ? raw === "true" || raw === "false"
              : q.options && q.options.length > 0
                ? raw.trim().length > 0
                : raw.trim().length > 0;
          return (
            <li key={q.key} className={`quiz-question${answered ? " quiz-question--answered" : ""}`}>
              <div className="quiz-qhead-row">
                <div className="quiz-qtext">
                  <span className="quiz-qnum">{idx + 1}.</span>
                  {q.title ? <span className="quiz-qtitle">{q.title}</span> : null}
                  {q.body ? (
                    <p className="quiz-qbody">{q.body}</p>
                  ) : !q.title ? (
                    <p className="quiz-qbody">{q.text}</p>
                  ) : null}
                </div>
                {answered ? <span className="quiz-answered-pill">{answeredPill}</span> : null}
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
                    <span>{trueLabel}</span>
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
                    <span>{falseLabel}</span>
                  </label>
                </div>
              ) : q.options && q.options.length > 0 ? (
                <div className="quiz-options quiz-options--mcq" role="group" aria-label={q.text}>
                  {q.options.map((opt) => (
                    <label key={opt} className="quiz-opt-line quiz-opt-line--mcq">
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
                  placeholder={answerPlaceholder}
                />
              )}
            </li>
          );
        })}
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [quizTab, setQuizTab] = useState<"intro" | "questions" | "results">("intro");
  const [quizTimeUp, setQuizTimeUp] = useState(false);
  const [timerTick, setTimerTick] = useState(0);
  const { t } = useI18n();

  const load = useCallback(async () => {
    if (!user || !courseId || !lessonId || !quizId) {
      return;
    }
    setLoading(true);
    setErr("");
    try {
      if (!isAdminPreview) {
        const en = await isStudentEnrolledInCourse(user.uid, courseId);
        if (!en) {
          setErr(t(`${SQ}.not_enrolled`, "لست مسجّلاً في هذا المقرر."));
          setQuiz(null);
          setAnswer(null);
          setRows([]);
          setQuestionDefs([]);
          return;
        }
        const acc = await canStudentOpenLesson(user.uid, courseId, lessonId);
        if (!acc.ok) {
          setErr(acc.message ?? t(`${SQ}.cannot_open_lesson`, "لا يمكن الوصول إلى هذا الدرس."));
          setQuiz(null);
          setAnswer(null);
          setRows([]);
          setQuestionDefs([]);
          return;
        }
      }
      const qd = await getQuizFileById(lessonId, quizId);
      if (qd == null) {
        setErr(t(`${SQ}.quiz_not_found`, "الاختبار غير موجود."));
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
    } catch {
      setErr(t(`${SQ}.load_failed`, "تعذر تحميل الاختبار. تحقق من الاتصال وصلاحيات الوصول."));
      setQuiz(null);
      setAnswer(null);
      setRows([]);
      setQuestionDefs([]);
    } finally {
      setLoading(false);
    }
  }, [user, courseId, lessonId, quizId, isAdminPreview, t]);

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
  const isFinalized = status === "graded" || status === "approved" || status === "rejected";
  const hasStructuredQuestions = questionDefs.length > 0;
  const schedule = useMemo(
    () => (quiz != null ? evaluateQuizSchedule(quiz) : { allowed: true as const }),
    [quiz],
  );
  const scheduleBlocks = !schedule.allowed && !isAdminPreview;
  const formLocked = isAdminPreview || isFinalized || scheduleBlocks;

  const durationMin = useMemo(() => {
    if (quiz == null) {
      return null;
    }
    const v = (quiz as { duration?: unknown }).duration;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      return v;
    }
    if (v != null && v !== "" && !Number.isNaN(Number(v))) {
      const n = Number(v);
      return n > 0 ? n : null;
    }
    return null;
  }, [quiz]);

  const timerStorageKey =
    user && !isAdminPreview && quizId ? `${QUIZ_TIMER_SS}${quizId}:${user.uid}` : "";

  useEffect(() => {
    setQuizTab("intro");
    setQuizTimeUp(false);
    setTimerTick(0);
  }, [quizId]);

  useEffect(() => {
    if (loading || quiz == null) {
      return;
    }
    const raw = searchParams.get("tab");
    if (raw === "results" && !hasStructuredQuestions) {
      setQuizTab("intro");
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.delete("tab");
          return n;
        },
        { replace: true },
      );
      return;
    }
    if (raw === "questions") {
      setQuizTab("questions");
      return;
    }
    if (raw === "results" && hasStructuredQuestions) {
      setQuizTab("results");
      return;
    }
    if (raw === "intro") {
      setQuizTab("intro");
      return;
    }
    if (raw != null && raw !== "") {
      setQuizTab("intro");
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.delete("tab");
          return n;
        },
        { replace: true },
      );
    }
  }, [loading, quiz, hasStructuredQuestions, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isFinalized || !timerStorageKey) {
      return;
    }
    try {
      sessionStorage.removeItem(timerStorageKey);
    } catch {
      /* ignore */
    }
  }, [isFinalized, timerStorageKey]);

  useEffect(() => {
    if (!timerStorageKey || durationMin == null || formLocked || isAdminPreview || quizTab !== "questions") {
      return;
    }
    try {
      if (!sessionStorage.getItem(timerStorageKey)) {
        sessionStorage.setItem(timerStorageKey, String(Date.now()));
        setTimerTick((x) => x + 1);
      }
    } catch {
      /* ignore */
    }
  }, [timerStorageKey, durationMin, formLocked, isAdminPreview, quizTab]);

  useEffect(() => {
    if (durationMin == null || formLocked || isAdminPreview || !timerStorageKey) {
      return;
    }
    let started = 0;
    try {
      started = Number(sessionStorage.getItem(timerStorageKey) || "0");
    } catch {
      return;
    }
    if (!Number.isFinite(started) || started <= 0) {
      return;
    }
    const id = window.setInterval(() => setTimerTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [durationMin, formLocked, isAdminPreview, timerStorageKey]);

  const timerRemainingSec = useMemo(() => {
    if (durationMin == null || formLocked || isAdminPreview || !timerStorageKey) {
      return null;
    }
    void timerTick;
    let start = 0;
    try {
      start = Number(sessionStorage.getItem(timerStorageKey) || "0");
    } catch {
      return null;
    }
    if (!Number.isFinite(start) || start <= 0) {
      return null;
    }
    const limit = Math.round(durationMin * 60);
    return Math.max(0, limit - Math.floor((Date.now() - start) / 1000));
  }, [durationMin, formLocked, isAdminPreview, timerStorageKey, timerTick]);

  useEffect(() => {
    if (
      timerRemainingSec !== 0 ||
      durationMin == null ||
      quizTab !== "questions" ||
      isFinalized ||
      scheduleBlocks ||
      isAdminPreview ||
      !timerStorageKey
    ) {
      return;
    }
    setQuizTimeUp(true);
  }, [
    timerRemainingSec,
    durationMin,
    quizTab,
    isFinalized,
    scheduleBlocks,
    isAdminPreview,
    timerStorageKey,
  ]);

  const formLockedEffective = formLocked || (!isAdminPreview && quizTimeUp);

  const handleQuizTabChange = useCallback(
    (id: "intro" | "questions" | "results") => {
      if (id === "results" && !hasStructuredQuestions) {
        return;
      }
      setQuizTab(id);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (id === "intro") {
            n.delete("tab");
          } else {
            n.set("tab", id);
          }
          return n;
        },
        { replace: true },
      );
    },
    [hasStructuredQuestions, setSearchParams],
  );

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
    if (isAdminPreview || !user || formLockedEffective || !hasStructuredQuestions) {
      return;
    }
    for (const r of rows) {
      if (r.kind === "true_false") {
        const v = values[r.key] ?? "";
        if (v !== "true" && v !== "false") {
          setFormErr(t(`${SQ}.complete_all_hint`, "أكمل جميع الأسئلة قبل الإرسال."));
          return;
        }
        continue;
      }
      if (!(values[r.key] ?? "").toString().trim()) {
        setFormErr(t(`${SQ}.complete_all_hint`, "أكمل جميع الأسئلة قبل الإرسال."));
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
      if (timerStorageKey) {
        try {
          sessionStorage.removeItem(timerStorageKey);
        } catch {
          /* ignore */
        }
      }
      setQuizTimeUp(false);
      await load();
      window.dispatchEvent(new CustomEvent("ah:quiz-updated"));
    } catch {
      setFormErr(t(`${SQ}.save_answer_failed`, "تعذر حفظ الإجابة. تحقق من الاتصال وصلاحيات Firestore."));
    } finally {
      setSubmitting(false);
    }
  };

  const ledeText = isAdminPreview
    ? t(`${SQ}.lede_preview`, "معاينة اختبار الطالب: الإجابات للعرض فقط (لا يُرسل تسليم من وضع المشرف).")
    : t(`${SQ}.lede_student`, "تُحفظ الإجابات بحالة completed كما في تطبيق الجوال، ثم تُراجع (graded) لاحقاً.");
  const layoutRole = isAdminPreview ? "admin" : "student";
  const lessonPageHref = isAdminPreview
    ? `/admin/preview/course/${courseId}/lesson/${lessonId}`
    : `/student/course/${courseId}/lesson/${lessonId}`;

  if (!ready) {
    return (
      <DashboardLayout role={layoutRole} title={t(`${SQ}.title_fallback`, "اختبار")} lede={ledeText}>
        <PageLoadHint text={t(`${SQ}.initializing`, "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const title = String(
    quiz?.title ??
      (quiz as { name?: string } | null)?.name ??
      (quiz as { quizTitle?: string } | null)?.quizTitle ??
      t(`${SQ}.title_fallback`, "اختبار"),
  );
  const desc = String(quiz?.description ?? (quiz as { body?: string } | null)?.body ?? "");
  const mediaUrl = String(
    (quiz as { videoUrl?: string; mediaUrl?: string } | null)?.videoUrl ?? (quiz as { mediaUrl?: string }).mediaUrl ?? "",
  );

  return (
    <DashboardLayout
      role={layoutRole}
      title={
        isAdminPreview
          ? `${t("web_pages.student_lesson.preview_prefix", "معاينة")}: ${title}`
          : title
      }
      lede={ledeText}
    >
      {isAdminPreview ? (
        <p className="admin-preview-banner" role="status">
          <strong>{t(`${SQ}.preview_banner_strong`, "معاينة واجهة الطالب")}</strong> —{" "}
          {t(`${SQ}.preview_banner_rest`, "الإجابات للمراجعة البصرية فقط.")}{" "}
          <Link to={`/admin/course/${courseId}/lessons/${lessonId}/quizzes`} className="inline-link">
            {t(`${SQ}.edit_quiz_link`, "تحرير الاختبار")}
          </Link>
        </p>
      ) : null}
      <p>
        <Link to={lessonPageHref} className="inline-link">
          {t(`${SQ}.back_lesson`, "← العودة لصفحة الدرس")}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : err ? (
        <AlertMessage kind="error">{err}</AlertMessage>
      ) : (
        <div className="quiz-view-card">
          <AppTabs
            groupId={`quiz-${quizId}`}
            ariaLabel={t(`${SQ}.tabs_aria`, "أقسام الاختبار")}
            value={quizTab}
            onChange={(id) => handleQuizTabChange(id as "intro" | "questions" | "results")}
            tabs={[
              { id: "intro" as const, label: t(`${SQ}.tab_intro`, "المقدمة") },
              { id: "questions" as const, label: t(`${SQ}.tab_questions`, "الأسئلة") },
              ...(hasStructuredQuestions ? ([{ id: "results" as const, label: t(`${SQ}.tab_results`, "النتيجة") }] as const) : []),
            ]}
          />

          <AppTabPanel tabId="intro" groupId={`quiz-${quizId}`} hidden={quizTab !== "intro"} className="lesson-tab-panel">
            <div className="quiz-hero" aria-label={t(`${SQ}.quiz_info_aria`, "معلومات الاختبار")}>
              <div className="quiz-hero-icon" aria-hidden>
                <span className="quiz-hero-icon-inner">?</span>
              </div>
              <div className="quiz-hero-text">
                <h2 className="quiz-hero-title">{title}</h2>
                <p className="quiz-hero-meta muted small">
                  {hasStructuredQuestions ? (
                    <>
                      {rows.length} {t(`${SQ}.questions_count_suffix`, "سؤال")} ·{" "}
                      {durationMin != null ? (
                        <>
                          {Math.round(durationMin)} {t(`${SQ}.minute_abbr`, "د")}{" "}
                          {t(`${SQ}.approx_duration`, "مدة تقريبية")}
                        </>
                      ) : (
                        t(`${SQ}.no_time_limit`, "بدون حد زمني مُعرّف")
                      )}
                    </>
                  ) : (
                    t(`${SQ}.no_structured_questions`, "بدون أسئلة مُهيأة")
                  )}
                  {quiz?.createdAt != null ? (
                    <>
                      {" "}
                      · {t(`${SQ}.created_prefix`, "أُنشئ")} {formatFirestoreTime(quiz.createdAt)}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="quiz-status-row" aria-label={t(`${SQ}.quiz_status_aria`, "حالة الاختبار")}>
              <span
                className={
                  isGraded || status === "approved"
                    ? "meta-pill meta-pill--ok"
                    : status === "rejected"
                      ? "meta-pill meta-pill--warn"
                      : status === "pending"
                        ? "meta-pill meta-pill--info"
                        : "meta-pill meta-pill--muted"
                }
              >
                {isGraded
                  ? t(`${SQ}.status_graded`, "تم التصحيح")
                  : status === "approved"
                    ? t(`${SQ}.status_approved`, "مقبول")
                    : status === "rejected"
                      ? t(`${SQ}.status_rejected`, "مرفوض")
                      : status === "pending"
                        ? t(`${SQ}.status_pending`, "بانتظار التصحيح")
                        : t(`${SQ}.status_none`, "لم يُرسل بعد")}
              </span>
              <span className="meta-pill meta-pill--muted">
                {hasStructuredQuestions
                  ? `${answeredCount}/${rows.length} ${t(`${SQ}.answered_ratio`, "مجاب")}`
                  : t(`${SQ}.no_questions_short`, "بدون أسئلة")}
              </span>
              {durationMin != null ? (
                <span className="meta-pill meta-pill--muted">
                  {t(`${SQ}.duration_label`, "المدة")}: {Math.round(durationMin)} {t(`${SQ}.minute_abbr`, "د")}
                </span>
              ) : null}
            </div>
            {hasStructuredQuestions ? (
              <div className="quiz-progress-wrap" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
                <div className="quiz-progress-bar" style={{ width: `${progressPct}%` }} />
              </div>
            ) : null}
            {scheduleBlocks && schedule.messageAr ? (
              <AlertMessage kind="error">{schedule.messageAr}</AlertMessage>
            ) : null}
            {quizTimeUp && !isFinalized && !isAdminPreview && hasStructuredQuestions ? (
              <AlertMessage kind="error">
                <strong>{t(`${SQ}.timer_expired_title`, "انتهى وقت الاختبار")}</strong>{" "}
                {t(`${SQ}.timer_expired_body`, "لم يعد بإمكانك تعديل الإجابات. إن كان ذلك خطأً فاتصل بالإدارة.")}
              </AlertMessage>
            ) : null}
            {desc.length > 0 ? <p className="quiz-desc">{desc}</p> : null}
            {mediaUrl.trim() ? (
              <VideoIntroBlock mediaUrl={mediaUrl} title={t(`${SQ}.quiz_media_title`, "مقطع الاختبار")} />
            ) : null}
            {answer != null && (answer.score != null || answer.grade != null) ? (
              <p className="quiz-score">
                {t(`${SQ}.grade_label`, "الدرجة")}:{" "}
                {String((answer as { score?: unknown }).score ?? (answer as { grade?: unknown }).grade)}
              </p>
            ) : null}
            {durationMin != null && hasStructuredQuestions && !isAdminPreview && !scheduleBlocks ? (
              <p className="muted small quiz-timer-intro-hint">{t(`${SQ}.timer_starts_on_questions`, "يبدأ العد عند فتح تبويب الأسئلة.")}</p>
            ) : null}
            {hasStructuredQuestions ? (
              <p className="muted small quiz-intro-nav-hint">
                {t(`${SQ}.intro_tabs_hint`, "استخدم تبويب «الأسئلة» للإجابة، و«النتيجة» لملخص التصحيح وإجاباتك بعد الإرسال.")}
              </p>
            ) : null}
          </AppTabPanel>

          <AppTabPanel tabId="questions" groupId={`quiz-${quizId}`} hidden={quizTab !== "questions"} className="lesson-tab-panel">
            {hasStructuredQuestions ? (
              <>
                <SectionTitle as="h3">{t(`${SQ}.tab_questions`, "الأسئلة")}</SectionTitle>
                {durationMin != null && !isAdminPreview && timerRemainingSec != null ? (
                  <div className="quiz-timer-row" role="timer" aria-live="polite">
                    <span
                      className={
                        timerRemainingSec > 0 && timerRemainingSec <= 120
                          ? "meta-pill meta-pill--warn"
                          : "meta-pill meta-pill--muted"
                      }
                    >
                      {t(`${SQ}.timer_remaining`, "الوقت المتبقي")}: {formatCountdown(timerRemainingSec)}
                    </span>
                  </div>
                ) : null}
                {quizTimeUp && !isFinalized && !isAdminPreview ? (
                  <AlertMessage kind="error">
                    <strong>{t(`${SQ}.timer_expired_title`, "انتهى وقت الاختبار")}</strong>{" "}
                    {t(`${SQ}.timer_expired_body`, "لم يعد بإمكانك تعديل الإجابات. إن كان ذلك خطأً فاتصل بالإدارة.")}
                  </AlertMessage>
                ) : null}
                {isFinalized ? (
                  <p className="muted small">
                    {t(
                      `${SQ}.finalized_questions_hint`,
                      "تم إغلاق التسليم — عرض إجاباتك أدناه. للدرجات والملاحظات راجع تبويب «النتيجة».",
                    )}
                  </p>
                ) : null}
                <QuizTakerForm
                  rows={rows}
                  values={values}
                  onChange={onChange}
                  onSubmit={onSubmit}
                  submitting={submitting}
                  readonly={formLockedEffective}
                  submitLabel={
                    status === "pending"
                      ? t(`${SQ}.update_answers`, "تحديث الإجابات")
                      : t(`${SQ}.submit_answers`, "إرسال الإجابات")
                  }
                  answeredPill={t(`${SQ}.answered_pill`, "تم الإجابة")}
                  trueLabel={t(`${SQ}.true_label`, "صح")}
                  falseLabel={t(`${SQ}.false_label`, "خطأ")}
                  answerPlaceholder={t(`${SQ}.your_answer_ph`, "إجابتك")}
                />
                {formErr ? <AlertMessage kind="error">{formErr}</AlertMessage> : null}
              </>
            ) : (
              <p className="muted small quiz-hint">
                {t(
                  `${SQ}.no_questions_body`,
                  "لا توجد أسئلة مضافة لهذا الاختبار حالياً. يرجى مراجعة الإدارة لإضافة الأسئلة ثم إعادة المحاولة.",
                )}
              </p>
            )}
          </AppTabPanel>

          {hasStructuredQuestions ? (
            <AppTabPanel tabId="results" groupId={`quiz-${quizId}`} hidden={quizTab !== "results"} className="lesson-tab-panel">
              <QuizStudentResultsView questions={questionDefs} answer={answer} t={t} />
            </AppTabPanel>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  );
}
