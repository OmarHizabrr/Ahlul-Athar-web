import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
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
  const { tr } = useI18n();

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
      setMessage(tr("تعذر تحميل بيانات الدرس أو الاختبارات."));
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
      setMessage(tr("عند تفعيل الجدولة: حدّد تاريخي البداية والنهاية (مع الوقت)."));
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
      setMessage(tr("تم إنشاء الاختبار. يمكنك فتح «الأسئلة والتعديل» لإضافة الأسئلة."));
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
          ? tr("تعذر حفظ الجدولة. تحقق من التواريخ.")
          : tr("فشل إنشاء الاختبار. تحقق من القواعد وصلاحيات المشرف."),
      );
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (quizFileId: string, quizTitle: string) => {
    if (!window.confirm(`${tr("حذف الاختبار")} «${quizTitle}» ${tr("وكل أسئلته وإجابات الطلاب؟")}`)) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await adminDeleteQuizFile(lessonId, quizFileId);
      setMessage(tr("تم حذف الاختبار."));
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
      <DashboardLayout role="admin" title={tr("اختبارات الدرس")} lede={tr(lede)}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }
  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role="admin"
      title={lesson ? `${tr("اختبارات")}: ${lesson.title}` : tr("اختبارات الدرس")}
      lede={tr(lede)}
    >
      <p>
        <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
          {tr("← العودة لدروس")} {course ? `«${course.title}»` : tr("المقرر")}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !lesson ? (
        <AlertMessage kind="error">{tr("الدرس غير موجود.")}</AlertMessage>
      ) : (
        <>
          {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
          <div className="grid-2 home-stats-grid admin-lessons-stats">
            <StatTile title={tr("إجمالي الاختبارات")} highlight={quizzes.length} />
            <StatTile title={tr("اختبارات مجدولة")} highlight={scheduledQuizzes} />
            <StatTile title={tr("اختبارات بفيديو")} highlight={quizzesWithVideo} />
            <StatTile title={tr("إجمالي الأسئلة")} highlight={totalQuestions} />
            <StatTile title={tr("متوسط مدة الاختبار")} highlight={avgDuration != null ? `${avgDuration} ${tr("د")}` : tr("—")} />
          </div>
          <PageToolbar>
            <button
              type="button"
              className="primary-btn toolbar-btn"
              onClick={() => setQuizModalOpen(true)}
            >
              {tr("إضافة اختبار")}
            </button>
          </PageToolbar>

          <SectionTitle as="h3" className="form-section-title--spaced-15">
            {tr("اختبارات هذا الدرس")}
          </SectionTitle>
          {quizzes.length === 0 ? (
            <EmptyState message={tr("لا اختبارات بعد.")} />
          ) : (
            <ContentList>
              {quizzes.map((q) => {
                const t = String(
                  q.data.title ?? q.data.name ?? q.data.quizTitle ?? (q.data as { label?: string }).label ?? tr("بدون عنوان"),
                );
                const n = (q.data as { questionsCount?: number }).questionsCount;
                return (
                  <ContentListItem key={q.id}>
                    <h4 className="post-title">{t}</h4>
                    <p className="muted post-meta small">
                      {tr("معرّف المستند")}: {q.id} · {tr("أسئلة")}: {typeof n === "number" ? n : tr("—")}
                    </p>
                    <div className="course-actions lesson-admin-actions">
                      <Link
                        className="ghost-btn"
                        to={`/admin/preview/course/${courseId}/lesson/${lessonId}/quiz/${q.id}`}
                        title={tr("معاينة الاختبار كطالب")}
                      >
                        <IoEyeOutline size={18} style={{ verticalAlign: "middle", marginLeft: "0.35rem" }} aria-hidden />
                        {tr("معاينة")}
                      </Link>
                      <Link
                        className="ghost-btn"
                        to={`/admin/course/${courseId}/lessons/${lessonId}/quiz/${q.id}/edit`}
                      >
                        <IoListCircleOutline size={18} style={{ verticalAlign: "middle", marginLeft: "0.35rem" }} aria-hidden />
                        {tr("الأسئلة والتعديل")}
                      </Link>
                      <button
                        type="button"
                        className="icon-tool-btn danger"
                        onClick={() => void onDelete(q.id, t)}
                        disabled={submitting}
                        title={tr("حذف")}
                      >
                        <IoTrashOutline size={20} />
                        <span className="icon-tool-label">{tr("حذف")}</span>
                      </button>
                    </div>
                  </ContentListItem>
                );
              })}
            </ContentList>
          )}

          <AppModal
            open={quizModalOpen}
            title={tr("إضافة اختبار جديد")}
            onClose={() => {
              if (!submitting) {
                setQuizModalOpen(false);
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onCreate} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">{tr("إضافة اختبار جديد")}</SectionTitle>
              <label>
                <span>{tr("عنوان الاختبار")}</span>
                <input
                  className="text-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder={tr("مثال: اختبار الوحدة الأولى")}
                />
              </label>
              <label>
                <span>{tr("وصف (اختياري)")}</span>
                <textarea
                  className="text-input textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tr("تعليمات للطالب")}
                />
              </label>
              <div className="form-row-2">
                <label>
                  <span>{tr("المدة (دقائق)")}</span>
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
                  <span>{tr("رابط فيديو (اختياري — YouTube)")}</span>
                  <input
                    className="text-input"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder={tr("https://")}
                  />
                </label>
              </div>
              <label className="switch-line">
                <input type="checkbox" checked={hasSched} onChange={(e) => setHasSched(e.target.checked)} />
                <span>{tr("فترة زمنية للاختبار")}</span>
              </label>
              {hasSched ? (
                <div className="form-row-2">
                  <label>
                    <span>{tr("بداية النافذة")}</span>
                    <input
                      className="text-input"
                      type="datetime-local"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      required={hasSched}
                    />
                  </label>
                  <label>
                    <span>{tr("نهاية النافذة")}</span>
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
                  <ButtonBusyLabel busy={submitting}>{tr("إنشاء اختبار")}</ButtonBusyLabel>
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setQuizModalOpen(false)}
                  disabled={submitting}
                >
                  {tr("إغلاق")}
                </button>
              </div>
            </FormPanel>
          </AppModal>
        </>
      )}
    </DashboardLayout>
  );
}
