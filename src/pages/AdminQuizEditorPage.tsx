import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  adminAddQuestion,
  adminDeleteQuestion,
  adminListQuestionDocs,
  adminListQuizAnswers,
  adminGradeQuizAnswer,
  adminReopenQuizAnswer,
  adminUpdateQuestion,
  adminUpdateQuizFile,
  type AdminQuizAnswerRow,
  type AdminQuestionDoc,
  type QuizQuestionKind,
} from "../services/adminQuizService";
import { getQuizFileById } from "../services/lessonAccessService";
import { lessonsService } from "../services/lessonsService";
import type { Lesson } from "../types";
import { dispatchQuizUpdated } from "../utils/quizEvents";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { quizDocumentToScheduleFormStrings } from "../utils/quizScheduleFields";
import { IoPencil, IoTrashOutline } from "react-icons/io5";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { VideoIntroBlock } from "../components/VideoIntroBlock";
import {
  AlertMessage,
  AppModal,
  EmptyState,
  FormPanel,
  PageToolbar,
  Panel,
  SectionTitle,
  StatTile,
} from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";

const KINDS: { v: QuizQuestionKind; label: string }[] = [
  { v: "open", label: "سؤال مفتوح (نص)" },
  { v: "true_false", label: "صح / خطأ" },
  { v: "multiple_choice", label: "اختيار من متعدد" },
];

function parseOptionLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function formatAnswerPreview(v: unknown, tr: (text: string) => string): string {
  if (typeof v === "boolean") {
    return v ? tr("صح") : tr("خطأ");
  }
  if (v == null) {
    return tr("—");
  }
  return String(v);
}

export function AdminQuizEditorPage() {
  const { courseId = "", lessonId = "", quizId = "" } = useParams();
  const { user, ready } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quiz, setQuiz] = useState<Record<string, unknown> | null>(null);
  const [questions, setQuestions] = useState<AdminQuestionDoc[]>([]);
  const [submissions, setSubmissions] = useState<AdminQuizAnswerRow[]>([]);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaDuration, setMetaDuration] = useState("");
  const [metaVideo, setMetaVideo] = useState("");
  const [metaHasSched, setMetaHasSched] = useState(false);
  const [metaSchedStart, setMetaSchedStart] = useState("");
  const [metaSchedEnd, setMetaSchedEnd] = useState("");

  const [kind, setKind] = useState<QuizQuestionKind>("open");
  const [qTitle, setQTitle] = useState("");
  const [qBody, setQBody] = useState("");
  const [qOpts, setQOpts] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const { tr } = useI18n();

  const load = useCallback(async () => {
    if (!courseId || !lessonId || !quizId) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const L = await lessonsService.getById(courseId, lessonId);
      setLesson(L);
      const qd = await getQuizFileById(lessonId, quizId);
      if (qd == null) {
        setQuiz(null);
        setQuestions([]);
        setMessage(tr("الاختبار غير موجود."));
        setIsError(true);
        return;
      }
      setQuiz({ ...qd });
      setMetaTitle(String(qd.title ?? (qd as { name?: string }).name ?? ""));
      setMetaDesc(String(qd.description ?? ""));
      setMetaDuration(
        qd.duration != null && qd.duration !== "" && !Number.isNaN(Number(qd.duration)) ? String(qd.duration) : "",
      );
      setMetaVideo(String((qd as { videoUrl?: string }).videoUrl ?? ""));
      const sch = quizDocumentToScheduleFormStrings(qd as Record<string, unknown>);
      setMetaHasSched(sch.hasScheduledTime);
      setMetaSchedStart(sch.start);
      setMetaSchedEnd(sch.end);
      const [list, answers] = await Promise.all([adminListQuestionDocs(quizId), adminListQuizAnswers(quizId)]);
      setQuestions(list);
      setSubmissions(answers);
      const draft: Record<string, string> = {};
      for (const a of answers) {
        if (a.status === "graded" && a.score != null && a.score !== "") {
          draft[a.id] = String(a.score);
        } else {
          draft[a.id] = "";
        }
      }
      setScoreDraft(draft);
    } catch {
      setMessage(tr("تعذر التحميل."));
      setIsError(true);
      setQuestions([]);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, quizId]);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [ready, load]);

  const startEdit = (Q: AdminQuestionDoc) => {
    const t = String(Q.data.type ?? "open");
    const k: QuizQuestionKind =
      t === "multiple_choice" || t === "true_false" || t === "open" ? (t as QuizQuestionKind) : "open";
    setEditingId(Q.id);
    setKind(k);
    setQTitle(String(Q.data.title ?? ""));
    setQBody(String(Q.data.question ?? ""));
    setQOpts(Q.options.map((o) => o.text).join("\n"));
    setMessage("");
    setQuestionModalOpen(true);
  };

  const resetQuestionForm = () => {
    setEditingId(null);
    setKind("open");
    setQTitle("");
    setQBody("");
    setQOpts("");
    setQuestionModalOpen(false);
  };

  const onSaveMeta = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    if (metaHasSched && (!metaSchedStart.trim() || !metaSchedEnd.trim())) {
      setMessage(tr("عند تفعيل الجدولة: حدّد تاريخي البداية والنهاية."));
      setIsError(true);
      return;
    }
    setSubmitting(true);
    setMessage("");
    const d = metaDuration.trim() ? Number(metaDuration) : 0;
    try {
      await adminUpdateQuizFile(lessonId, quizId, {
        title: metaTitle,
        description: metaDesc,
        duration: Number.isFinite(d) && d >= 0 ? d : 0,
        videoUrl: metaVideo,
        schedule: { hasScheduledTime: metaHasSched, start: metaSchedStart, end: metaSchedEnd },
      });
      setMessage(tr("تم حفظ بيانات الاختبار."));
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch (err) {
      setMessage(
        err instanceof Error && err.message === "invalid schedule"
          ? tr("تعذر حفظ الجدولة. تحقق من التواريخ.")
          : tr("فشل حفظ بيانات الاختبار."),
      );
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !qTitle.trim() || !qBody.trim()) {
      setMessage(tr("عنوان السؤال ونص السؤال مطلوبان."));
      setIsError(true);
      return;
    }
    const lines = parseOptionLines(qOpts);
    if (kind === "multiple_choice" && lines.length < 2) {
      setMessage(tr("للاختيار من متعدد أضف سطرين على الأقل (خيار لكل سطر)."));
      setIsError(true);
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      if (editingId) {
        await adminUpdateQuestion(lessonId, quizId, user, editingId, kind, qTitle, qBody, lines);
        setMessage(tr("تم تحديث السؤال."));
      } else {
        await adminAddQuestion(lessonId, quizId, user, kind, qTitle, qBody, lines);
        setMessage(tr("تمت إضافة السؤال."));
      }
      setIsError(false);
      resetQuestionForm();
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage(tr("فشل حفظ السؤال."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteQ = async (Q: AdminQuestionDoc) => {
    if (!user) {
      return;
    }
    if (!window.confirm(tr("حذف هذا السؤال وخياراته؟"))) {
      return;
    }
    setSubmitting(true);
    try {
      await adminDeleteQuestion(lessonId, quizId, Q.id);
      if (editingId === Q.id) {
        resetQuestionForm();
      }
      setMessage(tr("تم حذف السؤال."));
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage(tr("فشل الحذف."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onGrade = async (row: AdminQuizAnswerRow) => {
    if (!user) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    const raw = (scoreDraft[row.id] ?? "").trim();
    const n = raw === "" ? null : Number(raw);
    const score = n != null && Number.isFinite(n) ? n : null;
    try {
      await adminGradeQuizAnswer(quizId, row.id, user, score);
      setMessage(tr("تم اعتماد التصحيح. تُقفل/تُفتح الدروس حسب منطق الاجتياز لدى الطالب."));
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage(tr("تعذر حفظ التصحيح. تحقق من القواعد."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onReopen = async (row: AdminQuizAnswerRow) => {
    if (!window.confirm(`${tr("إرجاع إجابة")} «${row.studentName}» ${tr("إلى وضع «مُرسل»؟")}`)) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await adminReopenQuizAnswer(quizId, row.id);
      setMessage(tr("أُعيدت الإجابة — يمكن للطالب الاطلاع وتحديثها إن سمحت القواعد."));
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage(tr("تعذر التحديث."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const lede = "تعديل بيانات الاختبار وإدارة أسئلته (نفس المسارات subcollection في Firestore).";
  const gradedSubmissions = submissions.filter((s) => s.status === "graded").length;
  const pendingSubmissions = Math.max(submissions.length - gradedSubmissions, 0);
  const mcqQuestions = questions.filter((q) => String(q.data.type ?? "") === "multiple_choice").length;
  const trueFalseQuestions = questions.filter((q) => String(q.data.type ?? "") === "true_false").length;
  const openQuestions = questions.filter((q) => String(q.data.type ?? "open") === "open").length;

  if (!ready) {
    return (
      <DashboardLayout role="admin" title={tr("محرر الاختبار")} lede={tr(lede)}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }
  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout role="admin" title={tr("محرر الاختبار")} lede={tr(lede)}>
      <p className="admin-lessons-back-row">
        <Link to={`/admin/course/${courseId}/lessons/${lessonId}/quizzes`} className="inline-link">
          {tr("← اختبارات")} {lesson ? `«${lesson.title}»` : tr("الدرس")}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !quiz ? (
        <AlertMessage kind="error">{message || tr("الاختبار غير موجود.")}</AlertMessage>
      ) : (
        <>
          {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
          <PageToolbar className="admin-quiz-toolbar">
            <button type="button" className="primary-btn toolbar-btn" onClick={() => setMetaModalOpen(true)}>
              {tr("تعديل بيانات الاختبار")}
            </button>
            <button
              type="button"
              className="ghost-btn toolbar-btn"
              onClick={() => {
                setEditingId(null);
                setKind("open");
                setQTitle("");
                setQBody("");
                setQOpts("");
                setQuestionModalOpen(true);
              }}
            >
              {tr("إضافة سؤال")}
            </button>
          </PageToolbar>
          <div className="grid-2 home-stats-grid admin-lessons-stats">
            <StatTile title={tr("إجمالي الأسئلة")} highlight={questions.length} />
            <StatTile title={tr("اختيار من متعدد")} highlight={mcqQuestions} />
            <StatTile title={tr("صح/خطأ")} highlight={trueFalseQuestions} />
            <StatTile title={tr("مفتوحة")} highlight={openQuestions} />
            <StatTile title={tr("إجابات الطلاب")} highlight={submissions.length} />
            <StatTile title={tr("مصحّحة/معلّقة")} highlight={`${gradedSubmissions}/${pendingSubmissions}`} />
          </div>

          <SectionTitle as="h3" className="form-section-title--spaced-15">
            {tr("الأسئلة")}
          </SectionTitle>
          {questions.length === 0 ? (
            <EmptyState message={tr("لا أسئلة بعد. أضف سؤالاً أدناه.")} />
          ) : (
            <ul className="admin-quiz-question-list">
              {questions.map((Q) => {
                const ty = String(Q.data.type ?? "open");
                return (
                  <li key={Q.id} className="admin-quiz-question-item">
                    <div>
                      <strong>{String(Q.data.title ?? tr("—"))}</strong>
                      <p className="muted small">{tr("نوع")}: {tr(ty)}</p>
                      <p className="admin-quiz-qpreview">{String(Q.data.question ?? "").slice(0, 200)}</p>
                    </div>
                    <div className="course-actions lesson-admin-actions">
                      <button
                        type="button"
                        className="icon-tool-btn"
                        onClick={() => startEdit(Q)}
                        disabled={submitting}
                        title={tr("تعديل")}
                      >
                        <IoPencil size={18} />
                        <span className="icon-tool-label">{tr("تعديل")}</span>
                      </button>
                      <button
                        type="button"
                        className="icon-tool-btn danger"
                        onClick={() => void onDeleteQ(Q)}
                        disabled={submitting}
                        title={tr("حذف")}
                      >
                        <IoTrashOutline size={18} />
                        <span className="icon-tool-label">{tr("حذف")}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <SectionTitle as="h3" className="form-section-title--spaced-175">
            {tr("إجابات الطلاب والتصحيح")}
          </SectionTitle>
          <p className="muted small">
            {tr("باعتماد حالة")} <strong>graded</strong> {tr("يُحتسب اجتياز الاختبار لفتح الدرس التالي عند تفعيل «اختبار إجباري».")}
          </p>
          {submissions.length === 0 ? (
            <EmptyState message={tr("لا إجابات مُرسلة بعد.")} />
          ) : (
            <ul className="admin-submissions-list">
              {submissions.map((S) => {
                const isGraded = S.status === "graded";
                return (
                  <li key={S.id} className="admin-submission-card">
                    <div className="admin-submission-head">
                      <div>
                        <strong>{S.studentName || tr("طالب")}</strong>
                        <span className="muted small"> · {S.studentId || S.id}</span>
                      </div>
                      <span className="lesson-quiz-pill" data-st={isGraded ? "graded" : "pending"}>
                        {isGraded ? tr("مُصحَّح") : (S.status ? tr(S.status) : tr("—"))}
                      </span>
                    </div>
                    <p className="muted small">{tr("إرسال")}: {formatFirestoreTime(S.submittedAt)}</p>
                    <details className="admin-answer-details">
                      <summary>{tr("عرض الإجابات")}</summary>
                      <ul className="admin-answer-kv">
                        {Object.entries(S.answers).map(([k, v]) => (
                          <li key={k}>
                            <code>{k}</code>: {formatAnswerPreview(v, tr)}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="admin-grade-row admin-grade-actions">
                      <label className="admin-grade-label">
                        <span>{tr("الدرجة (اختياري)")}</span>
                        <input
                          className="text-input"
                          type="number"
                          step="any"
                          value={scoreDraft[S.id] ?? ""}
                          onChange={(e) => setScoreDraft((p) => ({ ...p, [S.id]: e.target.value }))}
                          disabled={submitting}
                          placeholder={tr("—")}
                        />
                      </label>
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => void onGrade(S)}
                        disabled={submitting}
                        aria-busy={submitting}
                      >
                        <ButtonBusyLabel busy={submitting}>
                          {isGraded ? tr("حفظ الدرجة") : tr("اعتماد التصحيح")}
                        </ButtonBusyLabel>
                      </button>
                      {isGraded ? (
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => void onReopen(S)}
                          disabled={submitting}
                          aria-busy={submitting}
                        >
                          <ButtonBusyLabel busy={submitting}>{tr("إعادة فتح")}</ButtonBusyLabel>
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <AppModal
            open={metaModalOpen}
            title={tr("بيانات الاختبار")}
            onClose={() => {
              if (!submitting) {
                setMetaModalOpen(false);
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onSaveMeta} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">{tr("تحديث بيانات الاختبار")}</SectionTitle>
              <label>
                <span>{tr("العنوان")}</span>
                <input
                  className="text-input"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>{tr("الوصف")}</span>
                <textarea
                  className="text-input textarea"
                  rows={2}
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                />
              </label>
              <div className="form-row-2">
                <label>
                  <span>{tr("المدة (دقائق)")}</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    value={metaDuration}
                    onChange={(e) => setMetaDuration(e.target.value)}
                  />
                </label>
                <label>
                  <span>{tr("رابط فيديو")}</span>
                  <input
                    className="text-input"
                    type="url"
                    value={metaVideo}
                    onChange={(e) => setMetaVideo(e.target.value)}
                    placeholder="https://"
                  />
                </label>
              </div>
              {metaVideo.trim() ? (
                <Panel className="admin-quiz-video-preview">
                  <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
                    {tr("معاينة الفيديو (نفس الظهور لدى الطالب):")}
                  </p>
                  <VideoIntroBlock mediaUrl={metaVideo} title={tr("معاينة فيديو الاختبار")} compact />
                </Panel>
              ) : null}
              <label className="switch-line">
                <input
                  type="checkbox"
                  checked={metaHasSched}
                  onChange={(e) => setMetaHasSched(e.target.checked)}
                />
                <span>{tr("فترة زمنية للاختبار (تُطبَّق عند حلول الطالب)")}</span>
              </label>
              {metaHasSched ? (
                <div className="form-row-2">
                  <label>
                    <span>{tr("بداية النافذة")}</span>
                    <input
                      className="text-input"
                      type="datetime-local"
                      value={metaSchedStart}
                      onChange={(e) => setMetaSchedStart(e.target.value)}
                      required={metaHasSched}
                    />
                  </label>
                  <label>
                    <span>{tr("نهاية النافذة")}</span>
                    <input
                      className="text-input"
                      type="datetime-local"
                      value={metaSchedEnd}
                      onChange={(e) => setMetaSchedEnd(e.target.value)}
                      required={metaHasSched}
                    />
                  </label>
                </div>
              ) : null}
              <div className="course-actions">
                <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                  <ButtonBusyLabel busy={submitting}>{tr("حفظ بيانات الاختبار")}</ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={() => setMetaModalOpen(false)} disabled={submitting}>
                  {tr("إلغاء")}
                </button>
              </div>
            </FormPanel>
          </AppModal>

          <AppModal
            open={questionModalOpen}
            title={editingId ? tr("تعديل سؤال") : tr("إضافة سؤال جديد")}
            onClose={() => {
              if (!submitting) {
                resetQuestionForm();
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onSaveQuestion} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">{editingId ? tr("تحديث السؤال") : tr("سؤال جديد")}</SectionTitle>
              <label>
                <span>{tr("نوع السؤال")}</span>
                <select
                  className="text-input"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as QuizQuestionKind)}
                >
                      {KINDS.map((k) => (
                    <option key={k.v} value={k.v}>
                      {tr(k.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{tr("عنوان السؤال (قصير)")}</span>
                <input className="text-input" value={qTitle} onChange={(e) => setQTitle(e.target.value)} required />
              </label>
              <label>
                <span>{tr("نص السؤال")}</span>
                <textarea
                  className="text-input textarea"
                  rows={3}
                  value={qBody}
                  onChange={(e) => setQBody(e.target.value)}
                  required
                />
              </label>
              {kind === "multiple_choice" ? (
                <label>
                  <span>{tr("الخيارات (سطر لكل خيار)")}</span>
                  <textarea
                    className="text-input textarea"
                    rows={5}
                    value={qOpts}
                    onChange={(e) => setQOpts(e.target.value)}
                    placeholder={`${tr("الخيار")} 1\n${tr("الخيار")} 2\n${tr("الخيار")} 3`}
                    required
                  />
                </label>
              ) : null}
              <div className="course-actions">
                <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                  <ButtonBusyLabel busy={submitting}>
                    {editingId ? tr("حفظ التعديل") : tr("إضافة السؤال")}
                  </ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={resetQuestionForm} disabled={submitting}>
                  {tr("إلغاء")}
                </button>
              </div>
            </FormPanel>
          </AppModal>
        </>
      )}
    </DashboardLayout>
  );
}
