import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import {
  adminCreateQuizFile,
  adminDeleteQuizFile,
  adminListQuizFiles,
  type AdminQuizListItem,
} from "../services/adminQuizService";
import { lessonsService } from "../services/lessonsService";
import type { Course, Lesson } from "../types";
import { dispatchQuizUpdated } from "../utils/quizEvents";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { IoEyeOutline, IoTrashOutline, IoListCircleOutline } from "react-icons/io5";
import {
  AlertMessage,
  AppModal,
  ContentList,
  ContentListItem,
  EmptyState,
  FormPanel,
  PageToolbar,
  SectionTitle,
  StatTile,
} from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";

export function AdminLessonQuizzesPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const { user, ready } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quizzes, setQuizzes] = useState<AdminQuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [hasSched, setHasSched] = useState(false);
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [quizModalOpen, setQuizModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!courseId || !lessonId) {
      return;
    }
    setLoading(true);
    try {
      const [c, L, list] = await Promise.all([
        coursesService.getCourseById(courseId),
        lessonsService.getById(courseId, lessonId),
        adminListQuizFiles(lessonId),
      ]);
      setCourse(c);
      setLesson(L);
      setQuizzes(list);
    } catch {
      setMessage("تعذر تحميل بيانات الدرس أو الاختبارات.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [ready, load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    const d = duration.trim() ? Number(duration) : 0;
    if (hasSched && (!schedStart.trim() || !schedEnd.trim())) {
      setMessage("عند تفعيل الجدولة: حدّد تاريخي البداية والنهاية (مع الوقت).");
      setIsError(true);
      setSubmitting(false);
      return;
    }
    try {
      await adminCreateQuizFile(lessonId, user, {
        title: title.trim(),
        description: description.trim(),
        duration: Number.isFinite(d) && d >= 0 ? d : 0,
        videoUrl: videoUrl.trim(),
        schedule: { hasScheduledTime: hasSched, start: schedStart, end: schedEnd },
      });
      setMessage("تم إنشاء الاختبار. يمكنك فتح «الأسئلة والتعديل» لإضافة الأسئلة.");
      setIsError(false);
      setTitle("");
      setDescription("");
      setDuration("");
      setVideoUrl("");
      setHasSched(false);
      setSchedStart("");
      setSchedEnd("");
      setQuizModalOpen(false);
      await load();
      dispatchQuizUpdated();
    } catch (err) {
      setMessage(
        err instanceof Error && err.message === "invalid schedule"
          ? "تعذر حفظ الجدولة. تحقق من التواريخ."
          : "فشل إنشاء الاختبار. تحقق من القواعد وصلاحيات المشرف.",
      );
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (quizFileId: string, quizTitle: string) => {
    if (!window.confirm(`حذف الاختبار «${quizTitle}» وكل أسئلته وإجابات الطلاب؟`)) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await adminDeleteQuizFile(lessonId, quizFileId);
      setMessage("تم حذف الاختبار.");
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

  const lede = "إنشاء وإدارة ملفات الاختبار لدرس (مسار Firestore: quiz_files كما في تطبيق الجوال).";
  const scheduledQuizzes = quizzes.filter((q) => q.data.hasScheduledTime === true).length;
  const quizzesWithVideo = quizzes.filter((q) => {
    const s = String((q.data.videoUrl ?? q.data.mediaUrl ?? "") as string).trim();
    return s.length > 0;
  }).length;
  const totalQuestions = quizzes.reduce((sum, q) => {
    const n = Number((q.data as { questionsCount?: unknown }).questionsCount);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const durationRows = quizzes
    .map((q) => Number((q.data as { duration?: unknown }).duration))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgDuration = durationRows.length > 0 ? Math.round(durationRows.reduce((a, b) => a + b, 0) / durationRows.length) : null;

  if (!ready) {
    return (
      <DashboardLayout role="admin" title="اختبارات الدرس" lede={lede}>
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }
  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role="admin"
      title={lesson ? `اختبارات: ${lesson.title}` : "اختبارات الدرس"}
      lede={lede}
    >
      <p>
        <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
          ← العودة لدروس {course ? `«${course.title}»` : "المقرر"}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !lesson ? (
        <AlertMessage kind="error">الدرس غير موجود.</AlertMessage>
      ) : (
        <>
          {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
          <div className="grid-2 home-stats-grid admin-lessons-stats">
            <StatTile title="إجمالي الاختبارات" highlight={quizzes.length} />
            <StatTile title="اختبارات مجدولة" highlight={scheduledQuizzes} />
            <StatTile title="اختبارات بفيديو" highlight={quizzesWithVideo} />
            <StatTile title="إجمالي الأسئلة" highlight={totalQuestions} />
            <StatTile title="متوسط مدة الاختبار" highlight={avgDuration != null ? `${avgDuration} د` : "—"} />
          </div>
          <PageToolbar>
            <button
              type="button"
              className="primary-btn toolbar-btn"
              onClick={() => setQuizModalOpen(true)}
            >
              إضافة اختبار
            </button>
          </PageToolbar>

          <SectionTitle as="h3" className="form-section-title--spaced-15">
            اختبارات هذا الدرس
          </SectionTitle>
          {quizzes.length === 0 ? (
            <EmptyState message="لا اختبارات بعد." />
          ) : (
            <ContentList>
              {quizzes.map((q) => {
                const t = String(
                  q.data.title ?? q.data.name ?? q.data.quizTitle ?? (q.data as { label?: string }).label ?? "بدون عنوان",
                );
                const n = (q.data as { questionsCount?: number }).questionsCount;
                return (
                  <ContentListItem key={q.id}>
                    <h4 className="post-title">{t}</h4>
                    <p className="muted post-meta small">
                      معرّف المستند: {q.id} · أسئلة: {typeof n === "number" ? n : "—"}
                    </p>
                    <div className="course-actions lesson-admin-actions">
                      <Link
                        className="ghost-btn"
                        to={`/admin/preview/course/${courseId}/lesson/${lessonId}/quiz/${q.id}`}
                        title="معاينة الاختبار كطالب"
                      >
                        <IoEyeOutline size={18} style={{ verticalAlign: "middle", marginLeft: "0.35rem" }} aria-hidden />
                        معاينة
                      </Link>
                      <Link
                        className="ghost-btn"
                        to={`/admin/course/${courseId}/lessons/${lessonId}/quiz/${q.id}/edit`}
                      >
                        <IoListCircleOutline size={18} style={{ verticalAlign: "middle", marginLeft: "0.35rem" }} aria-hidden />
                        الأسئلة والتعديل
                      </Link>
                      <button
                        type="button"
                        className="icon-tool-btn danger"
                        onClick={() => void onDelete(q.id, t)}
                        disabled={submitting}
                        title="حذف"
                      >
                        <IoTrashOutline size={20} />
                        <span className="icon-tool-label">حذف</span>
                      </button>
                    </div>
                  </ContentListItem>
                );
              })}
            </ContentList>
          )}

          <AppModal
            open={quizModalOpen}
            title="إضافة اختبار جديد"
            onClose={() => {
              if (!submitting) {
                setQuizModalOpen(false);
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onCreate} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">إضافة اختبار جديد</SectionTitle>
              <label>
                <span>عنوان الاختبار</span>
                <input
                  className="text-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="مثال: اختبار الوحدة الأولى"
                />
              </label>
              <label>
                <span>وصف (اختياري)</span>
                <textarea
                  className="text-input textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="تعليمات للطالب"
                />
              </label>
              <div className="form-row-2">
                <label>
                  <span>المدة (دقائق)</span>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  <span>رابط فيديو (اختياري — YouTube)</span>
                  <input
                    className="text-input"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://"
                  />
                </label>
              </div>
              <label className="switch-line">
                <input type="checkbox" checked={hasSched} onChange={(e) => setHasSched(e.target.checked)} />
                <span>فترة زمنية للاختبار</span>
              </label>
              {hasSched ? (
                <div className="form-row-2">
                  <label>
                    <span>بداية النافذة</span>
                    <input
                      className="text-input"
                      type="datetime-local"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      required={hasSched}
                    />
                  </label>
                  <label>
                    <span>نهاية النافذة</span>
                    <input
                      className="text-input"
                      type="datetime-local"
                      value={schedEnd}
                      onChange={(e) => setSchedEnd(e.target.value)}
                      required={hasSched}
                    />
                  </label>
                </div>
              ) : null}
              <div className="course-actions">
                <button
                  className="primary-btn"
                  type="submit"
                  disabled={submitting || !title.trim()}
                  aria-busy={submitting}
                >
                  <ButtonBusyLabel busy={submitting}>إنشاء اختبار</ButtonBusyLabel>
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setQuizModalOpen(false)}
                  disabled={submitting}
                >
                  إغلاق
                </button>
              </div>
            </FormPanel>
          </AppModal>
        </>
      )}
    </DashboardLayout>
  );
}
