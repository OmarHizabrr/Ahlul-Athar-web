import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { LessonAttachmentsView } from "../components/LessonAttachmentsView";
import { LessonContentView } from "../components/LessonContentView";
import { useIsAdminPreview } from "../context/AdminPreviewContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  canStudentOpenLesson,
  getLessonQuizzesForAdminPreview,
  getLessonQuizzesForStudent,
  type LessonQuizItem,
} from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import { lessonCommentsService } from "../services/lessonCommentsService";
import { lessonAttachmentsService } from "../services/lessonAttachmentsService";
import { lessonsService } from "../services/lessonsService";
import type { Lesson, LessonAttachment, LessonComment, PlatformUser } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { lessonContentTypeLabel } from "../utils/lessonContentTypeLabel";
import { AlertMessage, AppTabPanel, AppTabs, Avatar, EmptyState, PageToolbar, Panel, SectionTitle } from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";

export function StudentLessonViewPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const { user, ready } = useAuth();
  const isAdminPreview = useIsAdminPreview();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonAttachments, setLessonAttachments] = useState<LessonAttachment[]>([]);
  const [quizzes, setQuizzes] = useState<LessonQuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const { t } = useI18n();

  const runLoad = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!user || !courseId || !lessonId) {
        return;
      }
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setErr("");
      if (isAdminPreview) {
        try {
          const [L, qz, att] = await Promise.all([
            lessonsService.getById(courseId, lessonId),
            getLessonQuizzesForAdminPreview(lessonId),
            lessonAttachmentsService.listByLessonId(lessonId).catch(() => [] as LessonAttachment[]),
          ]);
          setLesson(L);
          setQuizzes(qz);
          setLessonAttachments(att);
        } catch {
          setErr(t("web_pages.student_lesson.load_failed", "تعذر تحميل الدرس (صلاحيات أو الدرس غير موجود)."));
          setLesson(null);
          setQuizzes([]);
          setLessonAttachments([]);
        } finally {
          if (mode === "initial") {
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        }
        return;
      }
      const ok = await isStudentEnrolledInCourse(user.uid, courseId);
      if (!ok) {
        setErr(t("web_pages.student_lesson.not_enrolled", "ليس لديك صلاحية لعرض دروس هذا المقرر."));
        setLesson(null);
        setQuizzes([]);
        setLessonAttachments([]);
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
        return;
      }
      const access = await canStudentOpenLesson(user.uid, courseId, lessonId);
      if (!access.ok) {
        setErr(access.message ?? t("web_pages.student_lesson.cannot_open", "لا يمكن فتح هذا الدرس."));
        setLesson(null);
        setQuizzes([]);
        setLessonAttachments([]);
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
        return;
      }
      try {
        const [L, qz, att] = await Promise.all([
          lessonsService.getById(courseId, lessonId),
          getLessonQuizzesForStudent(user.uid, lessonId),
          lessonAttachmentsService.listByLessonId(lessonId).catch(() => [] as LessonAttachment[]),
        ]);
        setLesson(L);
        setQuizzes(qz);
        setLessonAttachments(att);
      } catch {
        setErr(t("web_pages.student_lesson.load_failed", "تعذر تحميل الدرس (صلاحيات أو الدرس غير موجود)."));
        setLesson(null);
        setQuizzes([]);
        setLessonAttachments([]);
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user, courseId, lessonId, isAdminPreview, t],
  );

  useEffect(() => {
    if (ready && user) {
      void runLoad("initial");
    }
  }, [ready, user, runLoad]);

  useEffect(() => {
    const onQuiz = () => {
      if (user) {
        void runLoad("refresh");
      }
    };
    window.addEventListener("ah:quiz-updated", onQuiz);
    return () => window.removeEventListener("ah:quiz-updated", onQuiz);
  }, [user, runLoad]);

  const layoutRole = isAdminPreview ? "admin" : "student";
  const courseListHref = isAdminPreview
    ? `/admin/preview/course/${courseId}`
    : `/student/course/${courseId}`;

  if (!ready) {
    return (
      <DashboardLayout role={layoutRole} title={t("web_pages.student_lesson.title_fallback", "درس")} lede={undefined}>
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout
      role={layoutRole}
      title={
        isAdminPreview
          ? lesson?.title
            ? `${t("web_pages.student_lesson.preview_prefix", "معاينة")}: ${lesson.title}`
            : t("web_pages.student_lesson.preview_title_fallback", "معاينة درس")
          : (lesson?.title ??
            (loading ? t("web_pages.student_lesson.loading_title", "…") : t("web_pages.student_lesson.title_fallback", "درس")))
      }
      lede={isAdminPreview ? t("web_pages.student_lesson.lede_preview", "معاينة واجهة الطالب (مشرف).") : undefined}
    >
      {isAdminPreview ? (
        <p className="admin-preview-banner" role="status">
          <strong>{t("web_pages.student_lesson.preview_banner_title", "معاينة واجهة الطالب")}</strong> —{" "}
          <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
            {t("web_pages.student_lesson.manage_lessons", "إدارة الدروس")}
          </Link>
        </p>
      ) : null}
      <p className="lesson-back">
        <Link to={courseListHref} className="inline-link">
          {t("web_pages.student_lesson.back_to_course", "← العودة لقائمة دروس المقرر")}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : err ? (
        <AlertMessage kind="error">{err}</AlertMessage>
      ) : !lesson ? (
        <EmptyState message={t("web_pages.student_lesson.not_found", "الدرس غير موجود أو أُزيل.")} />
      ) : (
        <StudentLessonBody
          courseId={courseId}
          lessonId={lessonId}
          lesson={lesson}
          lessonAttachments={lessonAttachments}
          quizzes={quizzes}
          onRefresh={() => void runLoad("refresh")}
          refreshing={refreshing}
        />
      )}
    </DashboardLayout>
  );
}

function StudentLessonBody({
  courseId,
  lessonId,
  lesson,
  lessonAttachments,
  quizzes,
  onRefresh,
  refreshing,
}: {
  courseId: string;
  lessonId: string;
  lesson: Lesson;
  lessonAttachments: LessonAttachment[];
  quizzes: LessonQuizItem[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdminPreview = useIsAdminPreview();
  const viewRoot = isAdminPreview ? "/admin/preview" : "/student";
  const contentTypeTrimmed = lesson.contentType?.trim() ?? "";
  const typeLabel = lessonContentTypeLabel(lesson.contentType, t);
  const [activeTab, setActiveTab] = useState<"view" | "attachments" | "comments" | "quizzes">("view");
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const mediaItems = [
    { key: "video", label: t("web_pages.student_lesson.media_video", "فيديو"), value: lesson.videoUrl },
    { key: "pdf", label: t("web_pages.student_lesson.media_pdf", "PDF"), value: lesson.pdfUrl },
    { key: "audio", label: t("web_pages.student_lesson.media_audio", "صوت"), value: lesson.audioUrl },
  ].filter((x) => Boolean(x.value && String(x.value).trim()));

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError("");
    try {
      const rows = await lessonCommentsService.listByLesson(courseId, lessonId);
      setComments(rows);
    } catch {
      setComments([]);
      setCommentsError(t("web_pages.student_lesson.comments_load_failed", "تعذر تحميل التعليقات حالياً."));
    } finally {
      setCommentsLoading(false);
    }
  }, [courseId, lessonId, t]);

  useEffect(() => {
    if (activeTab === "comments") {
      void loadComments();
    }
  }, [activeTab, loadComments]);

  const onAddComment = async () => {
    if (!user || !commentBody.trim()) {
      return;
    }
    setCommentSubmitting(true);
    setCommentsError("");
    try {
      await lessonCommentsService.addComment(user as PlatformUser, courseId, lessonId, commentBody);
      setCommentBody("");
      await loadComments();
    } catch {
      setCommentsError(t("web_pages.student_lesson.comment_send_failed", "تعذر إرسال التعليق. تحقق من الاتصال ثم حاول مرة أخرى."));
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <article className="lesson-reader">
      <PageToolbar className="lesson-toolbar">
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <ButtonBusyLabel busy={refreshing}>{t("web_pages.student_lesson.refresh", "تحديث")}</ButtonBusyLabel>
        </button>
      </PageToolbar>

      <Panel className="lesson-hero">
        {lesson.imageUrl ? (
          <div className="lesson-hero-cover">
            <img
              src={lesson.imageUrl}
              alt={lesson.title}
              className="lesson-hero-img"
              loading="eager"
              decoding="async"
            />
          </div>
        ) : null}
        <div className="lesson-hero-inner">
          {lesson.description ? <p className="lesson-hero-sub">{lesson.description}</p> : null}
          <div className="lesson-chips" aria-label={t("web_pages.student_lesson.lesson_meta_aria", "معلومات الدرس")}>
            {contentTypeTrimmed ? (
              <span className="meta-pill meta-pill--info" title={t("web_pages.student_lesson.content_type", "نوع المحتوى")}>
                {typeLabel}
              </span>
            ) : null}
            {lesson.duration != null ? (
              <span className="meta-pill meta-pill--muted">
                {lesson.duration} {t("web_pages.student_lesson.minute", "دقيقة")}
              </span>
            ) : null}
            {lesson.difficulty ? <span className="meta-pill meta-pill--muted">{lesson.difficulty}</span> : null}
            {lesson.hasMandatoryQuiz ? (
              <span
                className="meta-pill meta-pill--ok"
                title={t("web_pages.student_lesson.mandatory_quiz_badge_title", "للمتابعة إلى الدرس التالي")}
              >
                {t("web_pages.student_lesson.mandatory_quiz_badge", "اختبار إجباري")}
              </span>
            ) : null}
          </div>
          <p className="lesson-hero-meta muted small">
            {formatFirestoreTime(lesson.createdAt)}
            {lesson.createdByName ? ` · ${lesson.createdByName}` : ""}
          </p>
        </div>
      </Panel>

      {lesson.hasMandatoryQuiz ? (
        <p className="lesson-mandatory-hint muted small" role="note">
          {t(
            "web_pages.student_lesson.mandatory_quiz_note",
            "قد يُطلب اجتياز اختبار هذا الدرس حسب إعدادات المقرر للانتقال للدرس التالي.",
          )}
        </p>
      ) : null}
      <AppTabs
        groupId={`lesson-${lessonId}`}
        ariaLabel={t("web_pages.student_lesson.tabs_aria", "أقسام الدرس")}
        value={activeTab}
        onChange={(id) => setActiveTab(id as "view" | "attachments" | "comments" | "quizzes")}
        tabs={[
          { id: "view" as const, label: t("web_pages.student_lesson.tab_view", "المشاهدة") },
          { id: "attachments" as const, label: t("web_pages.student_lesson.tab_attachments", "المرفقات") },
          { id: "comments" as const, label: t("web_pages.student_lesson.tab_comments", "التعليقات") },
          { id: "quizzes" as const, label: t("web_pages.student_lesson.tab_quizzes", "الاختبارات") },
        ]}
      />

      <AppTabPanel
        tabId="view"
        groupId={`lesson-${lessonId}`}
        hidden={activeTab !== "view"}
        className="lesson-tab-panel"
      >
        <LessonContentView lesson={lesson} />
      </AppTabPanel>

      <AppTabPanel tabId="attachments" groupId={`lesson-${lessonId}`} hidden={activeTab !== "attachments"} className="lesson-tab-panel">
        <SectionTitle as="h3">{t("web_pages.student_lesson.attachments_heading", "مرفقات الدرس")}</SectionTitle>
        <p className="muted small lesson-attach-tab-lede">
          {t(
            "web_pages.student_lesson.attachments_firestore_hint",
            "القائمة أدناه من مرفقات الدرس في السحابة (نفس تطبيق الجوال). روابط الفيديو/الPDF/الصوت في حقول الدرس تظهر في تبويب «المشاهدة».",
          )}
        </p>
        {lessonAttachments.length > 0 ? (
          <LessonAttachmentsView items={lessonAttachments} />
        ) : mediaItems.length === 0 ? (
          <EmptyState
            message={t(
              "web_pages.student_lesson.attachments_empty_all",
              "لا توجد مرفقات في قائمة الدرس ولا روابط وسائط في بيانات الدرس.",
            )}
          />
        ) : (
          <p className="muted small lesson-attach-tab-lede">
            {t(
              "web_pages.student_lesson.attachments_only_fields",
              "لا توجد مرفقات في قائمة السحابة؛ الروابط أدناه من حقول الدرس (يمكن أيضاً مشاهدتها من تبويب «المشاهدة»).",
            )}
          </p>
        )}
        {mediaItems.length > 0 ? (
          <>
            <SectionTitle as="h4" className="lesson-attach-secondary-title">
              {t("web_pages.student_lesson.attachments_lesson_fields", "روابط إضافية من بيانات الدرس")}
            </SectionTitle>
            <ul className="lesson-attachments-list">
              {mediaItems.map((m) => (
                <li key={m.key} className="lesson-attachment-item">
                  <span className="meta-pill meta-pill--muted">{m.label}</span>
                  <a className="inline-link" href={String(m.value)} target="_blank" rel="noopener noreferrer">
                    {t("web_pages.student_lesson.open_attachment", "فتح المرفق")}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </AppTabPanel>

      <AppTabPanel tabId="comments" groupId={`lesson-${lessonId}`} hidden={activeTab !== "comments"} className="lesson-tab-panel">
        <SectionTitle as="h3">{t("web_pages.student_lesson.comments_heading", "تعليقات الدرس")}</SectionTitle>
        <div className="lesson-comment-box">
          <textarea
            className="text-input textarea"
            rows={3}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder={t("web_pages.student_lesson.comment_placeholder", "اكتب تعليقك هنا...")}
          />
          <button
            type="button"
            className="primary-btn"
            onClick={() => void onAddComment()}
            disabled={commentSubmitting || !commentBody.trim()}
            aria-busy={commentSubmitting}
          >
            <ButtonBusyLabel busy={commentSubmitting}>{t("web_pages.student_lesson.send_comment", "إرسال التعليق")}</ButtonBusyLabel>
          </button>
        </div>
        {commentsLoading ? (
          <PageLoadHint text={t("web_pages.student_lesson.comments_loading", "جاري تحميل التعليقات...")} />
        ) : commentsError ? (
          <AlertMessage kind="error">{commentsError}</AlertMessage>
        ) : comments.length === 0 ? (
          <EmptyState message={t("web_pages.student_lesson.comments_empty", "لا توجد تعليقات بعد.")} />
        ) : (
          <ul className="lesson-comments-list">
            {comments.map((c) => (
              <li key={c.id} className="lesson-comment-item">
                <div className="person-meta-row">
                  <Avatar
                    photoURL={c.userPhotoURL}
                    displayName={c.userName}
                    email={null}
                    imageClassName="person-meta-avatar"
                    fallbackClassName="person-meta-avatar person-meta-avatar--fallback"
                    size={28}
                  />
                  <p className="muted small">
                    <strong>{c.userName}</strong> · {formatFirestoreTime(c.createdAt)}
                  </p>
                </div>
                <p className="post-body">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </AppTabPanel>

      <AppTabPanel tabId="quizzes" groupId={`lesson-${lessonId}`} hidden={activeTab !== "quizzes"} className="lesson-quiz-section lesson-tab-panel">
        <SectionTitle as="h3">{t("web_pages.student_lesson.quizzes_heading", "اختبارات الدرس")}</SectionTitle>
        {quizzes.length > 0 ? (
          <ul className="lesson-quiz-list">
            {quizzes.map((q) => {
              const structured = q.hasStructuredQuestions === true;
              const hasSubmission = q.status !== "none";
              const useSplitLinks = structured && hasSubmission;
              const singleLinkTab =
                structured &&
                (q.status === "graded" || q.status === "approved" || q.status === "rejected")
                  ? "results"
                  : q.status === "pending"
                    ? "questions"
                    : "intro";
              const primaryTab = useSplitLinks ? "questions" : singleLinkTab;
              const statusLabel =
                q.status === "graded"
                  ? t("web_pages.student_lesson.quiz_graded", "مُتاح / مقيّم")
                  : q.status === "approved"
                    ? t("web_pages.student_lesson.quiz_approved", "مقبول")
                    : q.status === "rejected"
                      ? t("web_pages.student_lesson.quiz_rejected", "مرفوض")
                      : q.status === "pending"
                        ? t("web_pages.student_lesson.quiz_pending", "مُرسل — بانتظار التصحيح")
                        : t("web_pages.student_lesson.quiz_none", "لم يُرسل بعد");
              const quizBase = `${viewRoot}/course/${courseId}/lesson/${lessonId}/quiz/${q.quizFileId}`;
              return (
                <li key={q.quizFileId}>
                  <div className="lesson-quiz-row">
                    <span className="lesson-quiz-title">{q.title}</span>
                    <span className="lesson-quiz-pill" data-st={q.status === "none" ? "none" : q.status}>
                      {statusLabel}
                    </span>
                    <div className="lesson-quiz-actions">
                      <Link className="ghost-btn" to={`${quizBase}?tab=${primaryTab}`}>
                        {t("web_pages.student_lesson.open_quiz", "فتح الاختبار")}
                      </Link>
                      {useSplitLinks ? (
                        <Link className="ghost-btn lesson-quiz-results-btn" to={`${quizBase}?tab=results`}>
                          {t("web_pages.student_lesson.open_quiz_results", "النتيجة")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState message={t("web_pages.student_lesson.quizzes_empty", "لا توجد اختبارات لهذا الدرس بعد.")} />
        )}
      </AppTabPanel>
    </article>
  );
}
