import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  PageToolbar,
  Panel,
  SectionTitle,
  AppTabPanel,
  AppTabs,
  StatTile,
  cn,
} from "../components/ui";
import { useIsAdminPreview } from "../context/AdminPreviewContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { coursesService } from "../services/coursesService";
import { getLessonsForAdminPreview, getLessonsWithAccessForStudent } from "../services/lessonAccessService";
import { isStudentEnrolledInCourse } from "../services/myCoursesService";
import type { Course, LessonWithAccess } from "../types";
import { DashboardLayout } from "./DashboardLayout";
import { lessonContentTypeLabel } from "../utils/lessonContentTypeLabel";

export function StudentCourseViewPage() {
  const { courseId = "" } = useParams();
  const { user, ready } = useAuth();
  const isAdminPreview = useIsAdminPreview();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<LessonWithAccess[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [courseTab, setCourseTab] = useState<"overview" | "lessons">("overview");
  const { t } = useI18n();

  const runLoad = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!user || !courseId) {
        return;
      }
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setMessage("");
      try {
        const c = await coursesService.getCourseById(courseId);
        setCourse(c);
        if (isAdminPreview) {
          setEnrolled(true);
          const L = await getLessonsForAdminPreview(courseId);
          setLessons(L);
        } else {
          const e = await isStudentEnrolledInCourse(user.uid, courseId);
          setEnrolled(e);
          if (e) {
            const L = await getLessonsWithAccessForStudent(user.uid, courseId);
            setLessons(L);
          } else {
            setLessons([]);
          }
        }
      } catch {
        setMessage(t("web_pages.student_course_view.load_failed", "تعذر التحميل."));
      } finally {
        if (mode === "initial") {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user, courseId, isAdminPreview, t],
  );

  useEffect(() => {
    if (ready && user && courseId) {
      void runLoad("initial");
    }
  }, [ready, user, courseId, runLoad]);

  useEffect(() => {
    const onQuiz = () => {
      if (user && courseId) {
        void runLoad("refresh");
      }
    };
    window.addEventListener("ah:quiz-updated", onQuiz);
    return () => window.removeEventListener("ah:quiz-updated", onQuiz);
  }, [user, courseId, runLoad]);

  const courseLede = useMemo(
    () =>
      isAdminPreview
        ? t(
            "web_pages.student_course_view.lede_preview",
            "معاينة واجهة الطالب: الدروس كما تظهر بلا قيود تسجيل (للمشرف فقط).",
          )
        : t(
            "web_pages.student_course_view.lede_student",
            "تفاصيل المقرر وقائمة الدروس مع القفل والتقدم — كما في تطبيق الجوال.",
          ),
    [isAdminPreview, t],
  );
  const layoutRole = isAdminPreview ? "admin" : "student";

  if (!ready) {
    return (
      <DashboardLayout role={layoutRole} title={t("web_pages.student_course_view.title_fallback", "مقرر")} lede={courseLede}>
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const title = isAdminPreview
    ? course?.title
      ? `${t("web_pages.student_course_view.preview_prefix", "معاينة")}: ${course.title}`
      : t("web_pages.student_course_view.preview_title_fallback", "معاينة مقرر")
    : (course?.title ?? t("web_pages.student_course_view.title_fallback", "مقرر"));
  const viewRoot = isAdminPreview ? "/admin/preview" : "/student";
  const courseCoverUrl = course?.imageUrl?.trim() ?? "";
  const unlockedLessons = lessons.filter((row) => row.isUnlocked).length;
  const lockedLessons = Math.max(lessons.length - unlockedLessons, 0);
  const mandatoryQuizLessons = lessons.filter((row) => row.lesson.hasMandatoryQuiz).length;
  const completionPct = lessons.length > 0 ? Math.round((unlockedLessons / lessons.length) * 100) : 0;

  return (
    <DashboardLayout role={layoutRole} title={title} lede={courseLede}>
      {loading ? (
        <PageLoadHint />
      ) : !course ? (
        <AlertMessage kind="error" role="alert">
          {t("web_pages.student_course_view.not_found", "المقرر غير موجود.")}
        </AlertMessage>
      ) : (
        <>
          {isAdminPreview ? (
            <p className="admin-preview-banner" role="status">
              <strong>{t("web_pages.student_course_view.preview_banner_title", "معاينة واجهة الطالب")}</strong> —{" "}
              {t("web_pages.student_course_view.preview_banner_body", "الروابط أدناه كما يراها طالب.")}{" "}
              <Link to={`/admin/course/${courseId}/lessons`} className="inline-link">
                {t("web_pages.student_course_view.back_lessons_admin", "العودة لإدارة الدروس")}
              </Link>
            </p>
          ) : null}
          {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
          <PageToolbar className="course-view-toolbar">
            <button
              type="button"
              className="ghost-btn toolbar-btn"
              onClick={() => void runLoad("refresh")}
              disabled={refreshing}
              aria-busy={refreshing}
            >
              <ButtonBusyLabel busy={refreshing}>
                {t("web_pages.student_course_view.refresh", "تحديث المقرر")}
              </ButtonBusyLabel>
            </button>
            {isAdminPreview ? (
              <Link to={`/admin/course/${courseId}/lessons`} className="ghost-btn toolbar-btn">
                {t("web_pages.student_course_view.manage_lessons", "إدارة الدروس")}
              </Link>
            ) : (
              <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
                {t("web_pages.nav.my_courses", "مقرراتي")}
              </Link>
            )}
          </PageToolbar>
          <Panel
            className={cn("course-hero-surface", courseCoverUrl && "course-hero-surface--flush")}
          >
            {courseCoverUrl ? (
              <>
                <CoverImage variant="hero" src={courseCoverUrl} alt={course.title} />
                <div className="course-hero-surface__inner">
                  <p className="muted course-hero-lead">{course.description}</p>
                  <div className="course-meta lesson-course-meta">
                    <span>
                      {course.lessonCount} {t("web_pages.student_course_view.lesson_word", "درس")}
                    </span>
                    <span>
                      {course.studentCount} {t("web_pages.student_course_view.student_word", "طالب")}
                    </span>
                    <span>
                      {course.isActive
                        ? t("web_pages.student_course_view.catalog_active", "نشط في الكتالوج")
                        : t("web_pages.student_course_view.catalog_paused", "موقف")}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="muted course-hero-lead">{course.description}</p>
                <div className="course-meta lesson-course-meta">
                  <span>
                    {course.lessonCount} {t("web_pages.student_course_view.lesson_word", "درس")}
                  </span>
                  <span>
                    {course.studentCount} {t("web_pages.student_course_view.student_word", "طالب")}
                  </span>
                  <span>
                    {course.isActive
                      ? t("web_pages.student_course_view.catalog_active", "نشط في الكتالوج")
                      : t("web_pages.student_course_view.catalog_paused", "موقف")}
                  </span>
                </div>
              </>
            )}
          </Panel>
          {!enrolled ? (
            <AlertMessage kind="error" role="alert">
              {t(
                "web_pages.student_course_view.not_enrolled",
                "أنت لست مسجّلاً في هذا المقرر. أرسل طلب انضمام من «الدورات» ثم بعد قبول الإدارة ستظهر الدروس هنا.",
              )}
            </AlertMessage>
          ) : (
            <>
              <AppTabs
                groupId={`course-${courseId}`}
                ariaLabel={t("web_pages.student_course_view.tabs_aria", "أقسام المقرر")}
                value={courseTab}
                onChange={(id) => setCourseTab(id as "overview" | "lessons")}
                tabs={[
                  { id: "overview", label: t("web_pages.student_course_view.tab_overview", "نظرة عامة") },
                  { id: "lessons", label: t("web_pages.student_course_view.tab_lessons", "الدروس") },
                ]}
              />
              <AppTabPanel tabId="overview" groupId={`course-${courseId}`} hidden={courseTab !== "overview"} className="lesson-tab-panel">
                <div className="grid-2 home-stats-grid">
                  <StatTile title={t("web_pages.student_course_view.stat_lessons_total", "إجمالي الدروس")} highlight={lessons.length} />
                  <StatTile title={t("web_pages.student_course_view.stat_unlocked", "الدروس المفتوحة")} highlight={unlockedLessons} />
                  <StatTile title={t("web_pages.student_course_view.stat_locked", "الدروس المقفلة")} highlight={lockedLessons} />
                  <StatTile
                    title={t("web_pages.student_course_view.stat_mandatory_quiz", "دروس باختبار إجباري")}
                    highlight={mandatoryQuizLessons}
                  />
                  <StatTile title={t("web_pages.student_course_view.stat_progress", "نسبة التقدّم")} highlight={`${completionPct}%`} />
                </div>
              </AppTabPanel>
              <AppTabPanel tabId="lessons" groupId={`course-${courseId}`} hidden={courseTab !== "lessons"} className="lesson-tab-panel">
                {lessons.length === 0 ? (
                  <EmptyState message={t("web_pages.student_course_view.empty_lessons", "لا توجد دروس مضافة لهذا المقرر بعد.")} />
                ) : (
                  <ContentList>
                    <SectionTitle as="h3" className="content-list-section-title">
                      {t("web_pages.student_course_view.tab_lessons", "الدروس")}
                    </SectionTitle>
                    {lessons.map((row, idx) => {
                      const ctype = row.lesson.contentType?.trim();
                      const typeLabel = lessonContentTypeLabel(ctype, t);
                      return (
                        <ContentListItem
                          key={row.lesson.id}
                          className={cn(
                            !row.isUnlocked && "course-item--locked",
                            !row.isUnlocked && "lesson-locked-card",
                          )}
                        >
                          <div className="lesson-list-row">
                            {row.lesson.imageUrl ? (
                              <CoverImage variant="thumb" src={row.lesson.imageUrl} alt="" />
                            ) : null}
                            <div className="lesson-list-row__main">
                              <h4 className="post-title">
                                <span className="lesson-index-pill" aria-hidden>
                                  {idx + 1}
                                </span>{" "}
                                {row.lesson.title}
                              </h4>
                              {row.lesson.hasMandatoryQuiz ? (
                                <p className="muted small">
                                  {t("web_pages.student_course_view.mandatory_quiz_hint", "يحتوي على اختبار إجباري (للدرس التالي)")}
                                </p>
                              ) : null}
                              {row.lesson.description ? <p className="muted">{row.lesson.description}</p> : null}
                              <p className="muted post-meta">
                                {t("web_pages.student_course_view.content_type", "نوع المحتوى")}: {typeLabel}
                                {row.lesson.videoUrl
                                  ? ` · ${t("web_pages.student_course_view.ctype_video", "فيديو")}`
                                  : ""}
                                {row.lesson.pdfUrl
                                  ? ` · ${t("web_pages.student_course_view.ctype_pdf", "PDF")}`
                                  : ""}
                                {row.lesson.audioUrl
                                  ? ` · ${t("web_pages.student_course_view.ctype_audio", "صوت")}`
                                  : ""}
                              </p>
                              {row.isUnlocked ? null : (
                                <AlertMessage kind="error" className="lock-hint">
                                  {row.blockHint ?? t("web_pages.student_course_view.lock_default", "الدرس مقفل")}
                                </AlertMessage>
                              )}
                              <div className="course-actions">
                                {row.isUnlocked ? (
                                  <Link
                                    className="primary-btn"
                                    to={`${viewRoot}/course/${courseId}/lesson/${row.lesson.id}`}
                                  >
                                    {t("web_pages.student_course_view.open_lesson", "فتح الدرس")}
                                  </Link>
                                ) : (
                                  <span className="ghost-btn lesson-locked-pill" aria-disabled>
                                    {t("web_pages.student_course_view.locked", "مقفل")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </ContentListItem>
                      );
                    })}
                  </ContentList>
                )}
              </AppTabPanel>
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
