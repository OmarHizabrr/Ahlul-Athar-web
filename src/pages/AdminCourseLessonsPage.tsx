import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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
      setMessage("تعذر التحميل.");
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
      setMessage("المحتوى النصي مطلوب عند اختيار «نص».");
      setIsError(true);
      setSubmitting(false);
      return;
    }
    if (contentType === "video" && !videoUrl.trim()) {
      setMessage("أضف رابط الفيديو أو غيّر نوع المحتوى.");
      setIsError(true);
      setSubmitting(false);
      return;
    }
    if (contentType === "pdf" && !pdfUrl.trim()) {
      setMessage("أضف رابط ملف الـ PDF أو غيّر نوع المحتوى.");
      setIsError(true);
      setSubmitting(false);
      return;
    }
    if (contentType === "audio" && !audioUrl.trim()) {
      setMessage("أضف رابط الملف الصوتي أو غيّر نوع المحتوى.");
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
        setMessage("تم حفظ تعديلات الدرس.");
      } else {
        await lessonsService.createLesson(user, courseId, payload);
        setMessage("تم إضافة الدرس وتحديث العدد في المقرر.");
        resetForm();
      }
      setIsError(false);
      if (editingId) {
        resetForm();
      }
      await load();
    } catch {
      setMessage(editingId ? "فشل حفظ التعديل. تحقق من القواعد." : "فشلت الإضافة. تحقق من القواعد.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (L: Lesson) => {
    if (!window.confirm(`حذف الدرس: ${L.title}؟`)) {
      return;
    }
    setSubmitting(true);
    try {
      await lessonsService.deleteLesson(courseId, L.id);
      setMessage("تم حذف الدرس.");
      setIsError(false);
      await load();
    } catch {
      setMessage("فشل الحذف.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const lessonsLede =
    "إضافة وحذف الدروس، وتحديد اختبار إجباري قبل الدرس التالي عند الحاجة — كما في منطق التطبيق.";

  if (!ready) {
    return (
      <DashboardLayout role="admin" title="دروس المقرر" lede={lessonsLede}>
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="admin" title={course ? `دروس: ${course.title}` : "دروس المقرر"} lede={lessonsLede}>
      <p className="admin-lessons-back-row">
        <Link to="/admin/courses" className="inline-link">
          ← العودة لقائمة المقررات
        </Link>
        {courseId ? (
          <Link
            to={`/admin/preview/course/${courseId}`}
            className="icon-tool-btn admin-lessons-preview-course"
            title="معاينة المقرر كما يرى الطالب"
            aria-label="معاينة المقرر"
          >
            <IoEyeOutline size={20} />
            <span className="icon-tool-label">معاينة المقرر</span>
          </Link>
        ) : null}
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !course ? (
        <AlertMessage kind="error">المقرر غير موجود.</AlertMessage>
      ) : (
        <>
          {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
          <p className="muted small">نفس مسار التطبيق: مجموعة lessons ثم مُعرّف المقرر ثم وثائق الدرس.</p>
          <PageToolbar>
            <button type="button" className="primary-btn toolbar-btn" onClick={onOpenCreateModal}>
              إضافة درس
            </button>
          </PageToolbar>

          <SectionTitle as="h3" className="form-section-title--spaced">
            الدروس الحالية
          </SectionTitle>
          {lessons.length === 0 ? (
            <EmptyState message="لا دروس." />
          ) : (
            <ContentList>
              {lessons.map((L) => (
                <ContentListItem key={L.id}>
                  <div className="lesson-list-row">
                    {L.imageUrl ? <CoverImage variant="thumb" src={L.imageUrl} alt="" /> : null}
                    <div className="lesson-list-row__main">
                  <h4 className="post-title">{L.title}</h4>
                  <p className="muted post-meta">
                    {formatFirestoreTime(L.createdAt)} · {L.contentType || "نص"}
                    {L.hasMandatoryQuiz ? " · إجباري للتالي" : ""}
                    {L.duration != null ? ` · ${L.duration} د` : ""}
                    {L.difficulty ? ` · ${L.difficulty}` : ""}
                  </p>
                  <p className="lesson-asset-badges" aria-label="الوسائط">
                    {L.videoUrl ? <span className="asset-badge">فيديو</span> : null}
                    {L.pdfUrl ? <span className="asset-badge">PDF</span> : null}
                    {L.audioUrl ? <span className="asset-badge">صوت</span> : null}
                  </p>
                  <p className="muted">{L.description?.slice(0, 120) || "—"}</p>
                  <div className="course-actions lesson-admin-actions">
                    <Link
                      className="icon-tool-btn"
                      to={`/admin/preview/course/${courseId}/lesson/${L.id}`}
                      title="معاينة الدرس كطالب"
                      aria-label="معاينة الدرس"
                    >
                      <IoEyeOutline size={20} />
                      <span className="icon-tool-label">معاينة</span>
                    </Link>
                    <Link
                      className="icon-tool-btn"
                      to={`/admin/course/${courseId}/lessons/${L.id}/quizzes`}
                      title="اختبارات الدرس"
                      aria-label="اختبارات الدرس"
                    >
                      <IoListCircleOutline size={20} />
                      <span className="icon-tool-label">اختبارات</span>
                    </Link>
                    <button
                      type="button"
                      className="icon-tool-btn"
                      onClick={() => startEdit(L)}
                      disabled={submitting}
                      title="تعديل الدرس"
                      aria-label="تعديل الدرس"
                    >
                      <IoPencil size={20} />
                      <span className="icon-tool-label">تعديل</span>
                    </button>
                    <button
                      type="button"
                      className="icon-tool-btn danger"
                      onClick={() => void onDelete(L)}
                      disabled={submitting}
                      title="حذف الدرس"
                      aria-label="حذف الدرس"
                    >
                      <IoTrashOutline size={20} />
                      <span className="icon-tool-label">حذف</span>
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
            title={editingId ? "تعديل بيانات الدرس" : "إضافة درس جديد"}
            onClose={() => {
              if (!submitting) {
                resetForm();
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onSubmit} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">{editingId ? "تحديث الدرس" : "إضافة درس"}</SectionTitle>
              <label>
                <span>عنوان الدرس</span>
                <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                <span>وصف قصير</span>
                <input
                  className="text-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>نوع المحتوى</span>
                <select
                  className="text-input"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                >
                  {CONTENT_TYPES.map((x) => (
                    <option key={x.v} value={x.v}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-lesson-urls">
                <p className="muted small form-hint">
                  روابط الوسائط — تُحفظ في الحقول videoUrl / pdfUrl / audioUrl
                </p>
                <label>
                  <span>رابط الفيديو</span>
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
                  <span>رابط PDF</span>
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
                  <span>رابط الصوت</span>
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
                  <span>المدة (دقائق)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    step={1}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="مثال: 15"
                  />
                </label>
                <label>
                  <span>الصعوبة</span>
                  <input
                    className="text-input"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    placeholder="سهل / متوسط / صعب"
                  />
                </label>
              </div>
              <label>
                <span>
                  {contentType === "text"
                    ? "المحتوى النصي للدرس"
                    : "نص تعليمات / ملاحظات (اختياري — يظهر للطالب مع الرابط)"}
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
                <span>اختبار إجباري قبل الدرس التالي</span>
              </label>
              <div className="course-actions">
                <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                  <ButtonBusyLabel busy={submitting}>
                    {editingId ? "حفظ التعديلات" : "حفظ الدرس"}
                  </ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
                  إلغاء
                </button>
              </div>
            </FormPanel>
          </AppModal>
        </>
      )}
    </DashboardLayout>
  );
}
