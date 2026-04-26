import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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

function formatAnswerPreview(v: unknown): string {
  if (typeof v === "boolean") {
    return v ? "صح" : "خطأ";
  }
  if (v == null) {
    return "—";
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
        setMessage("الاختبار غير موجود.");
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
      setMessage("تعذر التحميل.");
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
  };

  const resetQuestionForm = () => {
    setEditingId(null);
    setKind("open");
    setQTitle("");
    setQBody("");
    setQOpts("");
  };

  const onSaveMeta = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    if (metaHasSched && (!metaSchedStart.trim() || !metaSchedEnd.trim())) {
      setMessage("عند تفعيل الجدولة: حدّد تاريخي البداية والنهاية.");
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
      setMessage("تم حفظ بيانات الاختبار.");
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch (err) {
      setMessage(
        err instanceof Error && err.message === "invalid schedule"
          ? "تعذر حفظ الجدولة. تحقق من التواريخ."
          : "فشل حفظ بيانات الاختبار.",
      );
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !qTitle.trim() || !qBody.trim()) {
      setMessage("عنوان السؤال ونص السؤال مطلوبان.");
      setIsError(true);
      return;
    }
    const lines = parseOptionLines(qOpts);
    if (kind === "multiple_choice" && lines.length < 2) {
      setMessage("للاختيار من متعدد أضف سطرين على الأقل (خيار لكل سطر).");
      setIsError(true);
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      if (editingId) {
        await adminUpdateQuestion(lessonId, quizId, user, editingId, kind, qTitle, qBody, lines);
        setMessage("تم تحديث السؤال.");
      } else {
        await adminAddQuestion(lessonId, quizId, user, kind, qTitle, qBody, lines);
        setMessage("تمت إضافة السؤال.");
      }
      setIsError(false);
      resetQuestionForm();
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage("فشل حفظ السؤال.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteQ = async (Q: AdminQuestionDoc) => {
    if (!user) {
      return;
    }
    if (!window.confirm("حذف هذا السؤال وخياراته؟")) {
      return;
    }
    setSubmitting(true);
    try {
      await adminDeleteQuestion(lessonId, quizId, Q.id);
      if (editingId === Q.id) {
        resetQuestionForm();
      }
      setMessage("تم حذف السؤال.");
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage("فشل الحذف.");
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
      setMessage("تم اعتماد التصحيح. تُقفل/تُفتح الدروس حسب منطق الاجتياز لدى الطالب.");
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage("تعذر حفظ التصحيح. تحقق من القواعد.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onReopen = async (row: AdminQuizAnswerRow) => {
    if (!window.confirm(`إرجاع إجابة «${row.studentName}» إلى وضع «مُرسل»؟`)) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await adminReopenQuizAnswer(quizId, row.id);
      setMessage("أُعيدت الإجابة — يمكن للطالب الاطلاع وتحديثها إن سمحت القواعد.");
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage("تعذر التحديث.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const lede = "تعديل بيانات الاختبار وإدارة أسئلته (نفس المسارات subcollection في Firestore).";

  if (!ready) {
    return (
      <DashboardLayout role="admin" title="محرر الاختبار" lede={lede}>
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="admin" title="محرر الاختبار" lede={lede}>
      <p>
        <Link to={`/admin/course/${courseId}/lessons/${lessonId}/quizzes`} className="inline-link">
          ← اختبارات {lesson ? `«${lesson.title}»` : "الدرس"}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !quiz ? (
        <p className="message error">{message || "الاختبار غير موجود."}</p>
      ) : (
        <>
          {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
          <form className="course-form card-elevated" onSubmit={onSaveMeta}>
            <h3 className="form-section-title">بيانات الاختبار</h3>
            <label>
              <span>العنوان</span>
              <input
                className="text-input"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                required
              />
            </label>
            <label>
              <span>الوصف</span>
              <textarea
                className="text-input textarea"
                rows={2}
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
              />
            </label>
            <div className="form-row-2">
              <label>
                <span>المدة (دقائق)</span>
                <input
                  className="text-input"
                  type="number"
                  min={0}
                  value={metaDuration}
                  onChange={(e) => setMetaDuration(e.target.value)}
                />
              </label>
              <label>
                <span>رابط فيديو</span>
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
              <div className="admin-quiz-video-preview card-elevated">
                <p className="muted small" style={{ margin: "0 0 0.5rem" }}>
                  معاينة الفيديو (نفس الظهور لدى الطالب):
                </p>
                <VideoIntroBlock mediaUrl={metaVideo} title="معاينة فيديو الاختبار" compact />
              </div>
            ) : null}
            <label className="switch-line">
              <input
                type="checkbox"
                checked={metaHasSched}
                onChange={(e) => setMetaHasSched(e.target.checked)}
              />
              <span>فترة زمنية للاختبار (تُطبَّق عند حلول الطالب)</span>
            </label>
            {metaHasSched ? (
              <div className="form-row-2">
                <label>
                  <span>بداية النافذة</span>
                  <input
                    className="text-input"
                    type="datetime-local"
                    value={metaSchedStart}
                    onChange={(e) => setMetaSchedStart(e.target.value)}
                    required={metaHasSched}
                  />
                </label>
                <label>
                  <span>نهاية النافذة</span>
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
            <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
              <ButtonBusyLabel busy={submitting}>حفظ بيانات الاختبار</ButtonBusyLabel>
            </button>
          </form>

          <h3 className="form-section-title" style={{ marginTop: "1.5rem" }}>
            الأسئلة
          </h3>
          {questions.length === 0 ? (
            <p className="muted">لا أسئلة بعد. أضف سؤالاً أدناه.</p>
          ) : (
            <ul className="admin-quiz-question-list">
              {questions.map((Q) => {
                const ty = String(Q.data.type ?? "open");
                return (
                  <li key={Q.id} className="admin-quiz-question-item">
                    <div>
                      <strong>{String(Q.data.title ?? "—")}</strong>
                      <p className="muted small">نوع: {ty}</p>
                      <p className="admin-quiz-qpreview">{String(Q.data.question ?? "").slice(0, 200)}</p>
                    </div>
                    <div className="course-actions lesson-admin-actions">
                      <button
                        type="button"
                        className="icon-tool-btn"
                        onClick={() => startEdit(Q)}
                        disabled={submitting}
                        title="تعديل"
                      >
                        <IoPencil size={18} />
                        <span className="icon-tool-label">تعديل</span>
                      </button>
                      <button
                        type="button"
                        className="icon-tool-btn danger"
                        onClick={() => void onDeleteQ(Q)}
                        disabled={submitting}
                        title="حذف"
                      >
                        <IoTrashOutline size={18} />
                        <span className="icon-tool-label">حذف</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <form className="course-form card-elevated" onSubmit={onSaveQuestion} style={{ marginTop: "1rem" }}>
            <h3 className="form-section-title">{editingId ? "تعديل سؤال" : "سؤال جديد"}</h3>
            {editingId ? (
              <p className="muted small">
                <button type="button" className="link-btn" onClick={resetQuestionForm} disabled={submitting}>
                  إلغاء التعديل
                </button>
              </p>
            ) : null}
            <label>
              <span>نوع السؤال</span>
              <select
                className="text-input"
                value={kind}
                onChange={(e) => setKind(e.target.value as QuizQuestionKind)}
              >
                {KINDS.map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>عنوان السؤال (قصير)</span>
              <input className="text-input" value={qTitle} onChange={(e) => setQTitle(e.target.value)} required />
            </label>
            <label>
              <span>نص السؤال</span>
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
                <span>الخيارات (سطر لكل خيار)</span>
                <textarea
                  className="text-input textarea"
                  rows={5}
                  value={qOpts}
                  onChange={(e) => setQOpts(e.target.value)}
                  placeholder={"الخيار 1\nالخيار 2\nالخيار 3"}
                  required
                />
              </label>
            ) : null}
            <div className="form-actions-row">
              <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                <ButtonBusyLabel busy={submitting}>
                  {editingId ? "حفظ التعديل" : "إضافة السؤال"}
                </ButtonBusyLabel>
              </button>
            </div>
          </form>

          <h3 className="form-section-title" style={{ marginTop: "1.75rem" }}>
            إجابات الطلاب والتصحيح
          </h3>
          <p className="muted small">
            باعتماد حالة <strong>graded</strong> يُحتسب اجتياز الاختبار لفتح الدرس التالي عند تفعيل «اختبار
            إجباري».
          </p>
          {submissions.length === 0 ? (
            <p className="muted">لا إجابات مُرسلة بعد.</p>
          ) : (
            <ul className="admin-submissions-list">
              {submissions.map((S) => {
                const isGraded = S.status === "graded";
                return (
                  <li key={S.id} className="admin-submission-card">
                    <div className="admin-submission-head">
                      <div>
                        <strong>{S.studentName || "طالب"}</strong>
                        <span className="muted small"> · {S.studentId || S.id}</span>
                      </div>
                      <span className="lesson-quiz-pill" data-st={isGraded ? "graded" : "pending"}>
                        {isGraded ? "مُصحَّح" : S.status || "—"}
                      </span>
                    </div>
                    <p className="muted small">إرسال: {formatFirestoreTime(S.submittedAt)}</p>
                    <details className="admin-answer-details">
                      <summary>عرض الإجابات</summary>
                      <ul className="admin-answer-kv">
                        {Object.entries(S.answers).map(([k, v]) => (
                          <li key={k}>
                            <code>{k}</code>: {formatAnswerPreview(v)}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <div className="admin-grade-row">
                      <label className="admin-grade-label">
                        <span>الدرجة (اختياري)</span>
                        <input
                          className="text-input"
                          type="number"
                          step="any"
                          value={scoreDraft[S.id] ?? ""}
                          onChange={(e) => setScoreDraft((p) => ({ ...p, [S.id]: e.target.value }))}
                          disabled={submitting}
                          placeholder="—"
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
                          {isGraded ? "حفظ الدرجة" : "اعتماد التصحيح"}
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
                          <ButtonBusyLabel busy={submitting}>إعادة فتح</ButtonBusyLabel>
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
