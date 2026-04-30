import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { coursesService } from "../services/coursesService";
import { lessonsService } from "../services/lessonsService";
import type { Course, Lesson } from "../types";
import { IoEyeOutline, IoListCircleOutline, IoPencil, IoTrashOutline } from "react-icons/io5";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  AppModal,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  FormPanel,
  PageToolbar,
  SectionTitle,
  StatTile,
} from "../components/ui";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

const CONTENT_TYPES = [
  { v: "text", label: "نص" },
  { v: "video", label: "فيديو" },
  { v: "pdf", label: "PDF" },
  { v: "audio", label: "صوت" },
] as const;

function buildLessonPayload(
  title: string,
  description: string,
  content: string,
  contentType: string,
  hasMandatoryQuiz: boolean,
  videoUrl: string,
  pdfUrl: string,
  audioUrl: string,
  duration: string,
  difficulty: string,
) {
  return {
    title: title.trim(),
    description: description.trim(),
    content: content.trim(),
    contentType,
    hasMandatoryQuiz,
    videoUrl: videoUrl.trim(),
    pdfUrl: pdfUrl.trim(),
    audioUrl: audioUrl.trim(),
    duration: duration.trim(),
    difficulty: difficulty.trim(),
  };
}

export function AdminCourseLessonsPage() {
  const { courseId = "" } = useParams();
  const { user, ready } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<string>("text");
  const [hasMandatoryQuiz, setHasMandatoryQuiz] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const { tr } = useI18n();

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setContent("");
    setContentType("text");
    setHasMandatoryQuiz(false);
    setVideoUrl("");
    setPdfUrl("");
    setAudioUrl("");
    setDuration("");
    setDifficulty("");
    setLessonModalOpen(false);
  };

  const startEdit = (L: Lesson) => {
    setEditingId(L.id);
    setTitle(L.title);
    setDescription(L.description ?? "");
    setContent(String(L.txtContent ?? L.content ?? ""));
    setContentType(L.contentType || "text");
    setHasMandatoryQuiz(L.hasMandatoryQuiz === true);
    setVideoUrl(L.videoUrl ?? "");
    setPdfUrl(L.pdfUrl ?? "");
    setAudioUrl(L.audioUrl ?? "");
    setDuration(L.duration != null && !Number.isNaN(L.duration) ? String(L.duration) : "");
    setDifficulty(L.difficulty ?? "");
    setMessage("");
    setLessonModalOpen(true);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const onOpenCreateModal = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setContent("");
    setContentType("text");
    setHasMandatoryQuiz(false);
    setVideoUrl("");
    setPdfUrl("");
    setAudioUrl("");
    setDuration("");
    setDifficulty("");
    setLessonModalOpen(true);
  };

  const load = useCallback(async () => {
    if (!courseId) {
      return;
    }
    setLoading(true);
    try {
      const c = await coursesService.getCourseById(courseId);
      setCourse(c);
      const L = await lessonsService.listByCourseId(courseId);
      setLessons(L);
    } catch {
      setMessage(tr("تعذر التحميل."));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [ready, load]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    if (contentType === "text" && !content.trim()) {
      setMessage(tr("المحتوى النصي مطلوب عند اختيار «نص»."));
      setIsError(true);
      setSubmitting(false);
      return;
    }
    if (contentType === "video" && !videoUrl.trim()) {
      setMessage(tr("أضف رابط الفيديو أو غيّر نوع المحتوى."));
      setIsError(true);
      setSubmitting(false);
      return;
    }
    if (contentType === "pdf" && !pdfUrl.trim()) {
      setMessage(tr("أضف رابط ملف الـ PDF أو غيّر نوع المحتوى."));
      setIsError(true);
      setSubmitting(false);
      return;
    }
    if (contentType === "audio" && !audioUrl.trim()) {
      setMessage(tr("أضف رابط الملف الصوتي أو غيّر نوع المحتوى."));
      setIsError(true);
      setSubmitting(false);
      return;
    }
    const payload = buildLessonPayload(
      title,
      description,
      content,
      contentType,
      hasMandatoryQuiz,
      videoUrl,
      pdfUrl,
      audioUrl,
      duration,
      difficulty,
    );
    try {
      if (editingId) {
        await lessonsService.updateLesson(courseId, editingId, payload);
        setMessage(tr("تم حفظ تعديلات الدرس."));
      } else {
        await lessonsService.createLesson(user, courseId, payload);
        setMessage(tr("تم إضافة الدرس وتحديث العدد في المقرر."));
        resetForm();
      }
      setIsError(false);
      if (editingId) {
        resetForm();
      }
      await load();
    } catch {
      setMessage(editingId ? tr("فشل حفظ التعديل. تحقق من القواعد.") : tr("فشلت الإضافة. تحقق من القواعد."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (L: Lesson) => {
    if (!window.confirm(`${tr("حذف الدرس")}: ${L.title}؟`)) {
      return;
    }
    setSubmitting(true);
    try {
      await lessonsService.deleteLesson(courseId, L.id);
      setMessage(tr("تم حذف الدرس."));
      setIsError(false);
      await load();
    } catch {
      setMessage(tr("فشل الحذف."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const lessonsLede =
    "إضافة وحذف الدروس، وتحديد اختبار إجباري قبل الدرس التالي عند الحاجة — كما في منطق التطبيق.";

  if (!ready) {
    return (
      <DashboardLayout role="admin" title={tr("دروس المقرر")} lede={tr(lessonsLede)}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout role="admin" title={course ? `${tr("دروس")}: ${course.title}` : tr("دروس المقرر")} lede={tr(lessonsLede)}>
      <p className="admin-lessons-back-row">
        <Link to="/admin/courses" className="inline-link">
          {tr("← العودة لقائمة المقررات")}
        </Link>
        {courseId ? (
          <Link
            to={`/admin/preview/course/${courseId}`}
            className="icon-tool-btn admin-lessons-preview-course"
            title={tr("معاينة المقرر كما يرى الطالب")}
            aria-label={tr("معاينة المقرر")}
          >
            <IoEyeOutline size={20} />
            <span className="icon-tool-label">{tr("معاينة المقرر")}</span>
          </Link>
        ) : null}
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !course ? (
        <AlertMessage kind="error">{tr("المقرر غير موجود.")}</AlertMessage>
      ) : (
        <>
          {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
          <p className="muted small">{tr("نفس مسار التطبيق: مجموعة lessons ثم مُعرّف المقرر ثم وثائق الدرس.")}</p>
          <div className="grid-2 home-stats-grid admin-lessons-stats">
            <StatTile title={tr("إجمالي الدروس")} highlight={lessons.length} />
            <StatTile
              title={tr("دروس باختبار إجباري")}
              highlight={lessons.filter((l) => l.hasMandatoryQuiz).length}
            />
            <StatTile
              title={tr("دروس بوسائط")}
              highlight={lessons.filter((l) => l.videoUrl || l.pdfUrl || l.audioUrl).length}
            />
            <StatTile
              title={tr("متوسط المدة")}
              highlight={
                lessons.some((l) => typeof l.duration === "number")
                  ? `${Math.round(
                      lessons.reduce((sum, l) => sum + (typeof l.duration === "number" ? l.duration : 0), 0) /
                        Math.max(1, lessons.filter((l) => typeof l.duration === "number").length),
                    )} د`
                  : tr("—")
              }
            />
          </div>
          <PageToolbar>
            <button type="button" className="primary-btn toolbar-btn" onClick={onOpenCreateModal}>
              {tr("إضافة درس")}
            </button>
          </PageToolbar>

          <SectionTitle as="h3" className="form-section-title--spaced">
            {tr("الدروس الحالية")}
          </SectionTitle>
          {lessons.length === 0 ? (
            <EmptyState message={tr("لا دروس.")} />
          ) : (
            <ContentList>
              {lessons.map((L) => (
                <ContentListItem key={L.id}>
                  <div className="lesson-list-row">
                    {L.imageUrl ? <CoverImage variant="thumb" src={L.imageUrl} alt="" /> : null}
                    <div className="lesson-list-row__main">
                  <h4 className="post-title">{L.title}</h4>
                  <p className="muted post-meta">
                    {formatFirestoreTime(L.createdAt)} · {tr(L.contentType || "نص")}
                    {L.hasMandatoryQuiz ? ` · ${tr("إجباري للتالي")}` : ""}
                    {L.duration != null ? ` · ${L.duration} ${tr("د")}` : ""}
                    {L.difficulty ? ` · ${L.difficulty}` : ""}
                  </p>
                  <p className="lesson-asset-badges" aria-label={tr("الوسائط")}>
                    {L.videoUrl ? <span className="asset-badge">{tr("فيديو")}</span> : null}
                    {L.pdfUrl ? <span className="asset-badge">PDF</span> : null}
                    {L.audioUrl ? <span className="asset-badge">{tr("صوت")}</span> : null}
                  </p>
                  <p className="muted">{L.description?.slice(0, 120) || tr("—")}</p>
                  <div className="course-actions lesson-admin-actions">
                    <Link
                      className="icon-tool-btn"
                      to={`/admin/preview/course/${courseId}/lesson/${L.id}`}
                      title={tr("معاينة الدرس كطالب")}
                      aria-label={tr("معاينة الدرس")}
                    >
                      <IoEyeOutline size={20} />
                      <span className="icon-tool-label">{tr("معاينة")}</span>
                    </Link>
                    <Link
                      className="icon-tool-btn"
                      to={`/admin/course/${courseId}/lessons/${L.id}/quizzes`}
                      title={tr("اختبارات الدرس")}
                      aria-label={tr("اختبارات الدرس")}
                    >
                      <IoListCircleOutline size={20} />
                      <span className="icon-tool-label">{tr("اختبارات")}</span>
                    </Link>
                    <button
                      type="button"
                      className="icon-tool-btn"
                      onClick={() => startEdit(L)}
                      disabled={submitting}
                      title={tr("تعديل الدرس")}
                      aria-label={tr("تعديل الدرس")}
                    >
                      <IoPencil size={20} />
                      <span className="icon-tool-label">{tr("تعديل")}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-tool-btn danger"
                      onClick={() => void onDelete(L)}
                      disabled={submitting}
                      title={tr("حذف الدرس")}
                      aria-label={tr("حذف الدرس")}
                    >
                      <IoTrashOutline size={20} />
                      <span className="icon-tool-label">{tr("حذف")}</span>
                    </button>
                  </div>
                    </div>
                  </div>
                </ContentListItem>
              ))}
            </ContentList>
          )}

          <AppModal
            open={lessonModalOpen}
            title={editingId ? tr("تعديل بيانات الدرس") : tr("إضافة درس جديد")}
            onClose={() => {
              if (!submitting) {
                resetForm();
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onSubmit} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">{editingId ? tr("تحديث الدرس") : tr("إضافة درس")}</SectionTitle>
              <label>
                <span>{tr("عنوان الدرس")}</span>
                <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                <span>{tr("وصف قصير")}</span>
                <input
                  className="text-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>{tr("نوع المحتوى")}</span>
                <select
                  className="text-input"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                >
                  {CONTENT_TYPES.map((x) => (
                    <option key={x.v} value={x.v}>
                      {tr(x.label)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-lesson-urls">
                <p className="muted small form-hint">
                  {tr("روابط الوسائط — تُحفظ في الحقول videoUrl / pdfUrl / audioUrl")}
                </p>
                <label>
                  <span>{tr("رابط الفيديو")}</span>
                  <input
                    className="text-input"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </label>
                <label>
                  <span>{tr("رابط PDF")}</span>
                  <input
                    className="text-input"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                  />
                </label>
                <label>
                  <span>{tr("رابط الصوت")}</span>
                  <input
                    className="text-input"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                  />
                </label>
              </div>
              <div className="form-row-2">
                <label>
                  <span>{tr("المدة (دقائق)")}</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step={1}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder={tr("مثال: 15")}
                  />
                </label>
                <label>
                  <span>{tr("الصعوبة")}</span>
                  <input
                    className="text-input"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    placeholder={tr("سهل / متوسط / صعب")}
                  />
                </label>
              </div>
              <label>
                <span>
                  {contentType === "text"
                    ? tr("المحتوى النصي للدرس")
                    : tr("نص تعليمات / ملاحظات (اختياري — يظهر للطالب مع الرابط)")}
                </span>
                <textarea
                  className="text-input textarea"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  required={contentType === "text"}
                />
              </label>
              <label className="switch-line">
                <input
                  type="checkbox"
                  checked={hasMandatoryQuiz}
                  onChange={(e) => setHasMandatoryQuiz(e.target.checked)}
                />
                <span>{tr("اختبار إجباري قبل الدرس التالي")}</span>
              </label>
              <div className="course-actions">
                <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                  <ButtonBusyLabel busy={submitting}>
                    {editingId ? tr("حفظ التعديلات") : tr("حفظ الدرس")}
                  </ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
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
