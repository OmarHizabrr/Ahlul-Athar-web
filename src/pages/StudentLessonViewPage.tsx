import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
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
import { lessonsService } from "../services/lessonsService";
import type { Lesson, LessonComment, PlatformUser } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { AlertMessage, AppTabPanel, AppTabs, Avatar, EmptyState, PageToolbar, Panel, SectionTitle } from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  text: "نص",
  video: "فيديو",
  pdf: "PDF",
  audio: "صوت",
};

export function StudentLessonViewPage() {
  const { courseId = "", lessonId = "" } = useParams();
  const { user, ready } = useAuth();
  const isAdminPreview = useIsAdminPreview();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [quizzes, setQuizzes] = useState<LessonQuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const { tr } = useI18n();

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
          const L = await lessonsService.getById(courseId, lessonId);
          setLesson(L);
          const qz = await getLessonQuizzesForAdminPreview(lessonId);
          setQuizzes(qz);
        } catch {
          setErr(tr("تعذر تحميل الدرس (صلاحيات أو الدرس غير موجود)."));
          setLesson(null);
          setQuizzes([]);
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
        setErr(tr("ليس لديك صلاحية لعرض دروس هذا المقرر."));
        setLesson(null);
        setQuizzes([]);
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
        return;
      }
      const access = await canStudentOpenLesson(user.uid, courseId, lessonId);
      if (!access.ok) {
          setErr(tr(access.message ?? "لا يمكن فتح هذا الدرس."));
        setLesson(null);
        setQuizzes([]);
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
        return;
      }
      try {
        const L = await lessonsService.getById(courseId, lessonId);
        setLesson(L);
        const qz = await getLessonQuizzesForStudent(user.uid, lessonId);
        setQuizzes(qz);
      } catch {
        setErr(tr("تعذر تحميل الدرس (صلاحيات أو الدرس غير موجود)."));
        setLesson(null);
        setQuizzes([]);
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user, courseId, lessonId, isAdminPreview],
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
      <DashboardLayout role={layoutRole} title={tr("درس")} lede={undefined}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role={layoutRole}
      title={
        isAdminPreview
          ? lesson?.title
            ? `${tr("معاينة")}: ${lesson.title}`
            : tr("معاينة درس")
          : (lesson?.title ?? (loading ? "…" : tr("درس")))
      }
      lede={isAdminPreview ? tr("معاينة واجهة الطالب (مشرف).") : undefined}
    >
      {isAdminPreview ? (
        <p className="admin-preview-banner" role="status">
          <strong>{tr("معاينة واجهة الطالب")}</strong> —{" "}
          <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
            {tr("إدارة الدروس")}
          </Link>
        </p>
      ) : null}
      <p className="lesson-back">
        <Link to={courseListHref} className="inline-link">
          {tr("← العودة لقائمة دروس المقرر")}
        </Link>
      </p>
      {loading ? (
        <PageLoadHint />
      ) : err ? (
        <AlertMessage kind="error">{err}</AlertMessage>
      ) : !lesson ? (
        <EmptyState message={tr("الدرس غير موجود أو أُزيل.")} />
      ) : (
        <StudentLessonBody
          courseId={courseId}
          lessonId={lessonId}
          lesson={lesson}
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
  quizzes,
  onRefresh,
  refreshing,
}: {
  courseId: string;
  lessonId: string;
  lesson: Lesson;
  quizzes: LessonQuizItem[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { user } = useAuth();
  const { tr } = useI18n();
  const isAdminPreview = useIsAdminPreview();
  const viewRoot = isAdminPreview ? "/admin/preview" : "/student";
  const ct = lesson.contentType?.trim().toLowerCase() ?? "";
  const typeLabel = ct ? CONTENT_TYPE_LABEL[ct] ?? lesson.contentType : null;
  const [activeTab, setActiveTab] = useState<"view" | "attachments" | "comments" | "quizzes">("view");
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const mediaItems = [
    { key: "video", label: tr("فيديو"), value: lesson.videoUrl },
    { key: "pdf", label: "PDF", value: lesson.pdfUrl },
    { key: "audio", label: tr("صوت"), value: lesson.audioUrl },
  ].filter((x) => Boolean(x.value && String(x.value).trim()));

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError("");
    try {
      const rows = await lessonCommentsService.listByLesson(courseId, lessonId);
      setComments(rows);
    } catch {
      setComments([]);
      setCommentsError(tr("تعذر تحميل التعليقات حالياً."));
    } finally {
      setCommentsLoading(false);
    }
  }, [courseId, lessonId]);

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
      setCommentsError(tr("تعذر إرسال التعليق. تحقق من الاتصال ثم حاول مرة أخرى."));
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
          <ButtonBusyLabel busy={refreshing}>{tr("تحديث")}</ButtonBusyLabel>
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
          <div className="lesson-chips" aria-label={tr("معلومات الدرس")}>
            {typeLabel ? (
              <span className="meta-pill meta-pill--info" title={tr("نوع المحتوى")}>
                {typeLabel ? tr(typeLabel) : typeLabel}
              </span>
            ) : null}
            {lesson.duration != null ? <span className="meta-pill meta-pill--muted">{lesson.duration} {tr("دقيقة")}</span> : null}
            {lesson.difficulty ? <span className="meta-pill meta-pill--muted">{tr(lesson.difficulty)}</span> : null}
            {lesson.hasMandatoryQuiz ? (
              <span className="meta-pill meta-pill--ok" title={tr("للمتابعة إلى الدرس التالي")}>
                {tr("اختبار إجباري")}
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
          {tr("قد يُطلب اجتياز اختبار هذا الدرس حسب إعدادات المقرر للانتقال للدرس التالي.")}
        </p>
      ) : null}
      <AppTabs
        groupId={`lesson-${lessonId}`}
        ariaLabel={tr("أقسام الدرس")}
        value={activeTab}
        onChange={(id) => setActiveTab(id as "view" | "attachments" | "comments" | "quizzes")}
        tabs={[
          { id: "view" as const, label: tr("المشاهدة") },
          { id: "attachments" as const, label: tr("المرفقات") },
          { id: "comments" as const, label: tr("التعليقات") },
          { id: "quizzes" as const, label: tr("الاختبارات") },
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
          <SectionTitle as="h3">{tr("مرفقات الدرس")}</SectionTitle>
          {mediaItems.length === 0 ? (
            <EmptyState message={tr("لا توجد مرفقات مباشرة لهذا الدرس.")} />
          ) : (
            <ul className="lesson-attachments-list">
              {mediaItems.map((m) => (
                <li key={m.key} className="lesson-attachment-item">
                  <span className="meta-pill meta-pill--muted">{m.label}</span>
                  <a className="inline-link" href={String(m.value)} target="_blank" rel="noopener noreferrer">
                    {tr("فتح المرفق")}
                  </a>
                </li>
              ))}
            </ul>
          )}
      </AppTabPanel>

      <AppTabPanel tabId="comments" groupId={`lesson-${lessonId}`} hidden={activeTab !== "comments"} className="lesson-tab-panel">
          <SectionTitle as="h3">{tr("تعليقات الدرس")}</SectionTitle>
          <div className="lesson-comment-box">
            <textarea
              className="text-input textarea"
              rows={3}
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={tr("اكتب تعليقك هنا...")}
            />
            <button
              type="button"
              className="primary-btn"
              onClick={() => void onAddComment()}
              disabled={commentSubmitting || !commentBody.trim()}
              aria-busy={commentSubmitting}
            >
              <ButtonBusyLabel busy={commentSubmitting}>{tr("إرسال التعليق")}</ButtonBusyLabel>
            </button>
          </div>
          {commentsLoading ? (
            <PageLoadHint text={tr("جاري تحميل التعليقات...")} />
          ) : commentsError ? (
            <AlertMessage kind="error">{commentsError}</AlertMessage>
          ) : comments.length === 0 ? (
            <EmptyState message={tr("لا توجد تعليقات بعد.")} />
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
          <SectionTitle as="h3">{tr("اختبارات الدرس")}</SectionTitle>
          {quizzes.length > 0 ? (
            <ul className="lesson-quiz-list">
              {quizzes.map((q) => (
                <li key={q.quizFileId}>
                  <div className="lesson-quiz-row">
                    <span className="lesson-quiz-title">{q.title}</span>
                    <span className="lesson-quiz-pill" data-st={q.status === "none" ? "none" : q.status}>
                      {q.status === "graded"
                        ? tr("مُتاح / مقيّم")
                        : q.status === "pending"
                          ? tr("مُرسل — بانتظار التصحيح")
                          : tr("لم يُرسل بعد")}
                    </span>
                    <Link
                      className="ghost-btn"
                      to={`${viewRoot}/course/${courseId}/lesson/${lessonId}/quiz/${q.quizFileId}`}
                    >
                      {tr("فتح الاختبار")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message={tr("لا توجد اختبارات لهذا الدرس بعد.")} />
          )}
      </AppTabPanel>
    </article>
  );
}
