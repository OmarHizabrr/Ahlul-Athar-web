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

const QZ = "web_pages.admin_lesson_quizzes" as const;

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
  const { t } = useI18n();

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
      setMessage(t(`${QZ}.load_failed`, "تعذر تحميل بيانات الدرس أو الاختبارات."));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId, t]);

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
      setMessage(t(`${QZ}.sched_need_dates`, "عند تفعيل الجدولة: حدّد تاريخي البداية والنهاية (مع الوقت)."));
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
      setMessage(
        t(`${QZ}.created_ok`, "تم إنشاء الاختبار. يمكنك فتح «الأسئلة والتعديل» لإضافة الأسئلة."),
      );
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
          ? t(`${QZ}.sched_invalid`, "تعذر حفظ الجدولة. تحقق من التواريخ.")
          : t(`${QZ}.create_failed`, "فشل إنشاء الاختبار. تحقق من القواعد وصلاحيات المشرف."),
      );
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (quizFileId: string, quizTitle: string) => {
    if (
      !window.confirm(
        `${t(`${QZ}.delete_confirm_a`, "حذف الاختبار")} «${quizTitle}» ${t(`${QZ}.delete_confirm_b`, "وكل أسئلته وإجابات الطلاب؟")}`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await adminDeleteQuizFile(lessonId, quizFileId);
      setMessage(t(`${QZ}.deleted_ok`, "تم حذف الاختبار."));
      setIsError(false);
      await load();
      dispatchQuizUpdated();
    } catch {
      setMessage(t(`${QZ}.delete_failed`, "فشل الحذف."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const lede = t(
    `${QZ}.lede`,
    "إنشاء وإدارة ملفات الاختبار لدرس (مسار Firestore: quiz_files كما في تطبيق الجوال).",
  );
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
  const dash = t("web_shell.dash_em", "—");

  if (!ready) {
    return (
      <DashboardLayout role="admin" title={t(`${QZ}.page_title`, "اختبارات الدرس")} lede={lede}>
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }
  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role="admin"
      title={lesson ? `${t(`${QZ}.quizzes_prefix`, "اختبارات")}: ${lesson.title}` : t(`${QZ}.page_title`, "اختبارات الدرس")}
      lede={lede}
    >
      <p>
        <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
          {t(`${QZ}.back_lessons`, "← العودة لدروس")} {course ? `«${course.title}»` : t(`${QZ}.course_fallback`, "المقرر")}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : !lesson ? (
        <AlertMessage kind="error">{t(`${QZ}.lesson_missing`, "الدرس غير موجود.")}</AlertMessage>
      ) : (
        <>
          {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
          <div className="grid-2 home-stats-grid admin-lessons-stats">
            <StatTile title={t(`${QZ}.stat_total`, "إجمالي الاختبارات")} highlight={quizzes.length} />
            <StatTile title={t(`${QZ}.stat_scheduled`, "اختبارات مجدولة")} highlight={scheduledQuizzes} />
            <StatTile title={t(`${QZ}.stat_with_video`, "اختبارات بفيديو")} highlight={quizzesWithVideo} />
            <StatTile title={t(`${QZ}.stat_questions`, "إجمالي الأسئلة")} highlight={totalQuestions} />
            <StatTile
              title={t(`${QZ}.stat_avg_duration`, "متوسط مدة الاختبار")}
              highlight={avgDuration != null ? `${avgDuration} ${t(`${QZ}.min_short`, "د")}` : dash}
            />
          </div>
          <PageToolbar>
            <button type="button" className="primary-btn toolbar-btn" onClick={() => setQuizModalOpen(true)}>
              {t(`${QZ}.add_quiz`, "إضافة اختبار")}
            </button>
          </PageToolbar>

          <SectionTitle as="h3" className="form-section-title--spaced-15">
            {t(`${QZ}.list_heading`, "اختبارات هذا الدرس")}
          </SectionTitle>
          {quizzes.length === 0 ? (
            <EmptyState message={t(`${QZ}.empty`, "لا اختبارات بعد.")} />
          ) : (
            <ContentList>
              {quizzes.map((q) => {
                const quizTitleStr = String(
                  q.data.title ??
                    q.data.name ??
                    q.data.quizTitle ??
                    (q.data as { label?: string }).label ??
                    t(`${QZ}.untitled`, "بدون عنوان"),
                );
                const n = (q.data as { questionsCount?: number }).questionsCount;
                return (
                  <ContentListItem key={q.id}>
                    <h4 className="post-title">{quizTitleStr}</h4>
                    <p className="muted post-meta small">
                      {t(`${QZ}.doc_id`, "معرّف المستند")}: {q.id} · {t(`${QZ}.questions`, "أسئلة")}:{" "}
                      {typeof n === "number" ? n : dash}
                    </p>
                    <div className="course-actions lesson-admin-actions">
                      <Link
                        className="ghost-btn"
                        to={`/admin/preview/course/${courseId}/lesson/${lessonId}/quiz/${q.id}`}
                        title={t(`${QZ}.preview_student_aria`, "معاينة الاختبار كطالب")}
                      >
                        <IoEyeOutline size={18} style={{ verticalAlign: "middle", marginLeft: "0.35rem" }} aria-hidden />
                        {t(`${QZ}.preview`, "معاينة")}
                      </Link>
                      <Link className="ghost-btn" to={`/admin/course/${courseId}/lessons/${lessonId}/quiz/${q.id}/edit`}>
                        <IoListCircleOutline size={18} style={{ verticalAlign: "middle", marginLeft: "0.35rem" }} aria-hidden />
                        {t(`${QZ}.questions_edit`, "الأسئلة والتعديل")}
                      </Link>
                      <button
                        type="button"
                        className="icon-tool-btn danger"
                        onClick={() => void onDelete(q.id, quizTitleStr)}
                        disabled={submitting}
                        title={t(`${QZ}.delete`, "حذف")}
                      >
                        <IoTrashOutline size={20} />
                        <span className="icon-tool-label">{t(`${QZ}.delete`, "حذف")}</span>
                      </button>
                    </div>
                  </ContentListItem>
                );
              })}
            </ContentList>
          )}

          <AppModal
            open={quizModalOpen}
            title={t(`${QZ}.modal_new_title`, "إضافة اختبار جديد")}
            onClose={() => {
              if (!submitting) {
                setQuizModalOpen(false);
              }
            }}
            contentClassName="course-form-modal"
          >
            <FormPanel onSubmit={onCreate} elevated={false} className="course-form-modal__form">
              <SectionTitle as="h4">{t(`${QZ}.modal_new_title`, "إضافة اختبار جديد")}</SectionTitle>
              <label>
                <span>{t(`${QZ}.field_title`, "عنوان الاختبار")}</span>
                <input
                  className="text-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder={t(`${QZ}.ph_title`, "مثال: اختبار الوحدة الأولى")}
                />
              </label>
              <label>
                <span>{t(`${QZ}.field_desc`, "وصف (اختياري)")}</span>
                <textarea
                  className="text-input textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(`${QZ}.ph_desc`, "تعليمات للطالب")}
                />
              </label>
              <div className="form-row-2">
                <label>
                  <span>{t(`${QZ}.field_duration`, "المدة (دقائق)")}</span>
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
                  <span>{t(`${QZ}.field_video`, "رابط فيديو (اختياري — YouTube)")}</span>
                  <input
                    className="text-input"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder={t(`${QZ}.ph_url`, "https://")}
                  />
                </label>
              </div>
              <label className="switch-line">
                <input type="checkbox" checked={hasSched} onChange={(e) => setHasSched(e.target.checked)} />
                <span>{t(`${QZ}.sched_toggle`, "فترة زمنية للاختبار")}</span>
              </label>
              {hasSched ? (
                <div className="form-row-2">
                  <label>
                    <span>{t(`${QZ}.sched_start`, "بداية النافذة")}</span>
                    <input
                      className="text-input"
                      type="datetime-local"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      required={hasSched}
                    />
                  </label>
                  <label>
                    <span>{t(`${QZ}.sched_end`, "نهاية النافذة")}</span>
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
                <button className="primary-btn" type="submit" disabled={submitting || !title.trim()} aria-busy={submitting}>
                  <ButtonBusyLabel busy={submitting}>{t(`${QZ}.create_submit`, "إنشاء اختبار")}</ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={() => setQuizModalOpen(false)} disabled={submitting}>
                  {t("web_shell.btn_close", "إغلاق")}
                </button>
              </div>
            </FormPanel>
          </AppModal>
        </>
      )}
    </DashboardLayout>
  );
}
