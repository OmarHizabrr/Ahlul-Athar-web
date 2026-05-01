import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLoadHint } from "../../components/ButtonBusyLabel";
import { AlertMessage, ShortcutNav, StatTile, WelcomeHeading } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { DashboardLayout } from "../DashboardLayout";
import { coursesService } from "../../services/coursesService";
import { foldersService } from "../../services/foldersService";
import { myCoursesService } from "../../services/myCoursesService";
import { notificationsService } from "../../services/notificationsService";
import { postsService } from "../../services/postsService";
import type { Course, EnrollmentRequest, MyCourseEntry, Post, UserRole } from "../../types";
import { formatFirestoreTime } from "../../utils/firestoreTime";
import { requestStatusLabel } from "../course/EnrollmentRequestHelpers";

function toMillis(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  if (typeof v === "object" && "toDate" in (v as Record<string, unknown>) && typeof (v as { toDate?: unknown }).toDate === "function") {
    return ((v as { toDate: () => Date }).toDate()).getTime();
  }
  return 0;
}

export function HomePage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [courseCount, setCourseCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalLessons, setTotalLessons] = useState(0);
  const [unread, setUnread] = useState(0);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [myCoursesCount, setMyCoursesCount] = useState(0);
  const [myLessonsCount, setMyLessonsCount] = useState(0);
  const [myActiveCoursesCount, setMyActiveCoursesCount] = useState(0);
  const [pendingEnrollmentCount, setPendingEnrollmentCount] = useState(0);
  const [myFoldersCount, setMyFoldersCount] = useState(0);
  const [myFilesCount, setMyFilesCount] = useState(0);
  const [latestRequest, setLatestRequest] = useState<EnrollmentRequest | null>(null);
  const [latestMyCourse, setLatestMyCourse] = useState<MyCourseEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const base = role === "admin" ? "/admin" : "/student";
  const shortcuts = role === "admin"
    ? [
        { to: "/admin/courses", label: t("web_pages.nav.courses", "الدورات") },
        { to: "/admin/posts", label: t("web_pages.nav.posts", "المنشورات") },
        { to: "/admin/notifications", label: t("web_pages.nav.notifications", "الإشعارات") },
        { to: "/admin/settings", label: t("web_pages.nav.settings", "الإعدادات") },
      ]
    : [
        { to: "/student/mycourses", label: t("web_pages.nav.my_courses", "مقرراتي") },
        { to: "/student/enrollment-requests", label: t("web_pages.nav.my_requests", "طلباتي") },
        { to: "/student/courses", label: t("web_pages.nav.courses", "الدورات") },
        { to: "/student/posts", label: t("web_pages.nav.posts", "المنشورات") },
        { to: "/student/notifications", label: t("web_pages.nav.notifications", "الإشعارات") },
      ];

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    let hasPartialFailure = false;
    try {
      const coursesResult = await coursesService.listCoursesForRole(role).catch(() => {
        hasPartialFailure = true;
        return [] as Course[];
      });
      const courses = coursesResult;
      setCourseCount(courses.length);
      setTotalStudents(courses.reduce((sum, c) => sum + (Number.isFinite(c.studentCount) ? c.studentCount : 0), 0));
      setTotalLessons(courses.reduce((sum, c) => sum + (Number.isFinite(c.lessonCount) ? c.lessonCount : 0), 0));
      if (role === "admin") {
        const pending = await coursesService.listCourseEnrollmentRequests("pending").catch(() => {
          hasPartialFailure = true;
          return [] as EnrollmentRequest[];
        });
        setPendingCount(pending.length);
        setPendingEnrollmentCount(0);
        setMyFoldersCount(0);
        setMyFilesCount(0);
        setLatestRequest(null);
        setLatestMyCourse(null);
      } else {
        setPendingCount(0);
        const mine = await myCoursesService.listForStudent(user.uid).catch(() => {
          hasPartialFailure = true;
          return [] as MyCourseEntry[];
        });
        setMyCoursesCount(mine.length);
        setLatestMyCourse(
          mine.slice().sort((a, b) => toMillis(b.enrolledAt) - toMillis(a.enrolledAt))[0] ?? null,
        );
        setMyLessonsCount(
          mine.reduce((sum, c) => sum + (typeof c.lessonCount === "number" && Number.isFinite(c.lessonCount) ? c.lessonCount : 0), 0),
        );
        setMyActiveCoursesCount(mine.filter((c) => c.isActiveOnCatalog !== false).length);
        const myReqs = await coursesService.listStudentEnrollmentRequests(user.uid).catch(() => {
          hasPartialFailure = true;
          return [] as EnrollmentRequest[];
        });
        setPendingEnrollmentCount(myReqs.filter((r) => r.status === "pending").length);
        setLatestRequest(
          myReqs
            .slice()
            .sort((a, b) => toMillis(b.requestedAt ?? b.processedAt) - toMillis(a.requestedAt ?? a.processedAt))[0] ?? null,
        );

        const myFolders = await foldersService.listMyFoldersForStudent(user.uid).catch(() => {
          hasPartialFailure = true;
          return [];
        });
        setMyFoldersCount(myFolders.length);
        const filesTotal = await Promise.all(
          myFolders.map(async (f) => {
            if (typeof f.fileCount === "number") return f.fileCount;
            const files = await foldersService.listFolderFiles(f.id).catch(() => {
              hasPartialFailure = true;
              return [];
            });
            return files.length;
          }),
        );
        setMyFilesCount(filesTotal.reduce((sum, n) => sum + n, 0));
      }
      const u = await notificationsService.countUnread(user.uid).catch(() => {
        hasPartialFailure = true;
        return 0;
      });
      setUnread(u);
      const posts = await postsService.listForRole(role).catch(() => {
        hasPartialFailure = true;
        return [] as Post[];
      });
      setRecentTitles(posts.slice(0, 3).map((p) => p.title));
      if (hasPartialFailure) {
        setLoadError(t("web_pages.home.load_partial", "تم تحميل الإحصائيات جزئياً. تحقق من صلاحيات بعض المجموعات."));
      }
    } catch {
      setLoadError(t("web_pages.home.load_failed", "تعذر تحميل بعض بيانات الصفحة. حاول التحديث لاحقاً."));
    } finally {
      setLoading(false);
    }
  }, [role, user, t]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void load();
  }, [ready, user, load]);

  if (!ready) {
    return (
      <DashboardLayout role={role} title={t("web_pages.home.title", "الرئيسية")} lede={t("web_pages.home.subtitle_short", "نظرة سريعة على النشاط والأرقام.")}>
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  const displayName = user?.displayName?.trim() || user?.email || t("web_pages.home.guest", "زائر");
  const lede =
    role === "admin"
      ? t("web_pages.home.lede_admin", "لوحة المسؤول: الدورات، الطلبات، والمنشورات.")
      : t("web_pages.home.lede_student", "لوحة الطالب: مقرراتي، طلبات الانضمام، كتالوج الدورات، والإشعارات — كما في تطبيق الجوال.");

  return (
    <DashboardLayout role={role} title={t("web_pages.home.title", "الرئيسية")} lede={lede}>
      {loading ? (
        <PageLoadHint />
      ) : (
        <>
          <WelcomeHeading>
            {t("web_pages.home.welcome_prefix", "مرحباً،")} {displayName}.
          </WelcomeHeading>
          <ShortcutNav items={shortcuts} />
          {loadError ? <AlertMessage kind="error">{loadError}</AlertMessage> : null}
          <div className="grid-2 home-stats-grid">
            <StatTile
              title={t("web_pages.home.catalog_courses", "الدورات في الكتالوج")}
              highlight={courseCount}
              action={
                <Link to={`${base}/courses`} className="inline-link">
                  {t("web_pages.home.go_courses", "الانتقال للدورات")}
                </Link>
              }
            />
            {role === "admin" ? (
              <StatTile
                title={t("web_pages.home.pending_requests", "طلبات معلّقة")}
                highlight={pendingCount}
                action={
                  <Link to={`${base}/courses`} className="inline-link">
                    {t("web_pages.home.process_from_courses", "معالجة من صفحة الدورات")}
                  </Link>
                }
              />
            ) : (
              <StatTile
                title={t("web_pages.nav.my_courses", "مقرراتي")}
                highlight={myCoursesCount}
                action={
                  <Link to="/student/mycourses" className="inline-link">
                    {t("web_pages.home.open_mycourses", "فتح مقرراتي")}
                  </Link>
                }
              />
            )}
            {role === "student" ? <StatTile title={t("web_pages.home.total_my_lessons", "إجمالي دروس مقرراتي")} highlight={myLessonsCount} /> : null}
            {role === "student" ? <StatTile title={t("web_pages.home.active_catalog_courses", "المقررات المفعّلة")} highlight={myActiveCoursesCount} /> : null}
            {role === "student" ? (
              <StatTile
                title={t("web_pages.home.my_folders", "مجلداتي")}
                highlight={myFoldersCount}
                action={
                  <Link to="/student/myfiles" className="inline-link">
                    {t("web_pages.home.open_myfiles", "فتح ملفاتي")}
                  </Link>
                }
              />
            ) : null}
            {role === "student" ? <StatTile title={t("web_pages.home.total_my_files", "إجمالي ملفاتي")} highlight={myFilesCount} /> : null}
            {role === "admin" ? (
              <StatTile title={t("web_pages.home.total_students", "إجمالي الطلاب")} highlight={totalStudents} />
            ) : null}
            {role === "admin" ? (
              <StatTile title={t("web_pages.home.total_lessons", "إجمالي الدروس")} highlight={totalLessons} />
            ) : null}
            {role === "student" ? (
              <StatTile
                title={t("web_pages.home.pending_enrollment", "طلبات انضمام معلّقة")}
                highlight={pendingEnrollmentCount}
                action={
                  <Link to="/student/enrollment-requests" className="inline-link">
                    {t("web_pages.home.my_requests_log", "سجل «طلباتي»")}
                  </Link>
                }
              />
            ) : null}
            {role === "student" ? (
              <StatTile
                title={t("web_pages.home.last_enrollment_request", "آخر طلب انضمام")}
                wide
                action={
                  <Link to="/student/enrollment-requests" className="inline-link">
                    {t("web_pages.home.view_requests", "عرض الطلبات")}
                  </Link>
                }
              >
                {latestRequest ? (
                  <p className="muted small">
                    {latestRequest.targetName} · {requestStatusLabel(latestRequest.status, t)} ·{" "}
                    {formatFirestoreTime(latestRequest.requestedAt ?? latestRequest.processedAt)}
                  </p>
                ) : (
                  <p className="muted small">{t("web_pages.home.no_requests_yet", "لا يوجد طلبات بعد.")}</p>
                )}
              </StatTile>
            ) : null}
            {role === "student" ? (
              <StatTile
                title={t("web_pages.home.last_added_course", "آخر مقرر تم إضافته")}
                wide
                action={
                  <Link to="/student/mycourses" className="inline-link">
                    {t("web_pages.home.open_mycourses", "فتح مقرراتي")}
                  </Link>
                }
              >
                {latestMyCourse ? (
                  <p className="muted small">
                    {latestMyCourse.courseTitle || latestMyCourse.courseId} · {formatFirestoreTime(latestMyCourse.enrolledAt)}
                  </p>
                ) : (
                  <p className="muted small">{t("web_pages.home.no_courses_yet", "لا يوجد مقررات بعد.")}</p>
                )}
              </StatTile>
            ) : null}
            <StatTile
              title={t("web_pages.home.unread_notifications", "إشعارات غير مقروءة")}
              highlight={unread}
              action={
                <Link to={`${base}/notifications`} className="inline-link">
                  {t("web_pages.home.view_notifications", "عرض الإشعارات")}
                </Link>
              }
            />
            <StatTile
              title={t("web_pages.home.latest_posts", "آخر المنشورات")}
              wide
              action={
                <Link to={`${base}/posts`} className="inline-link">
                  {t("web_pages.home.all_posts", "كل المنشورات")}
                </Link>
              }
            >
              {recentTitles.length === 0 ? (
                <p className="muted small">{t("web_pages.home.no_posts_yet", "لا توجد منشورات بعد.")}</p>
              ) : (
                <ul className="post-preview-list">
                  {recentTitles.map((postTitle, i) => (
                    <li key={`${i}-${postTitle}`}>{postTitle}</li>
                  ))}
                </ul>
              )}
            </StatTile>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
