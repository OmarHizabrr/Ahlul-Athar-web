import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLoadHint } from "../../components/ButtonBusyLabel";
import { AlertMessage, ShortcutNav, StatTile, WelcomeHeading } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { coursesService } from "../../services/coursesService";
import { foldersService } from "../../services/foldersService";
import { myCoursesService } from "../../services/myCoursesService";
import { notificationsService } from "../../services/notificationsService";
import { postsService } from "../../services/postsService";
import type { Course, EnrollmentRequest, MyCourseEntry, Post, UserRole } from "../../types";
import { formatFirestoreTime } from "../../utils/firestoreTime";

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

const SHORTCUTS_ADMIN = [
  { to: "/admin/courses", label: "الدورات" },
  { to: "/admin/posts", label: "المنشورات" },
  { to: "/admin/notifications", label: "الإشعارات" },
  { to: "/admin/settings", label: "الإعدادات" },
] as const;

const SHORTCUTS_STUDENT = [
  { to: "/student/mycourses", label: "مقرراتي" },
  { to: "/student/enrollment-requests", label: "طلباتي" },
  { to: "/student/courses", label: "الدورات" },
  { to: "/student/posts", label: "المنشورات" },
  { to: "/student/notifications", label: "الإشعارات" },
] as const;

export function HomePage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
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
        setLoadError("تم تحميل الإحصائيات جزئياً. تحقق من صلاحيات بعض المجموعات.");
      }
    } catch {
      setLoadError("تعذر تحميل بعض بيانات الصفحة. حاول التحديث لاحقاً.");
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useEffect(() => {
    if (!ready || !user) {
      return;
    }
    void load();
  }, [ready, user, load]);

  if (!ready) {
    return (
      <DashboardLayout role={role} title="الرئيسية" lede="نظرة سريعة على النشاط والأرقام.">
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  const displayName = user?.displayName?.trim() || user?.email || "زائر";
  const lede =
    role === "admin"
      ? "لوحة المسؤول: الدورات، الطلبات، والمنشورات."
      : "لوحة الطالب: مقرراتي، طلبات الانضمام، كتالوج الدورات، والإشعارات — كما في تطبيق الجوال.";

  return (
    <DashboardLayout role={role} title="الرئيسية" lede={lede}>
      {loading ? (
        <PageLoadHint />
      ) : (
        <>
          <WelcomeHeading>مرحباً، {displayName}.</WelcomeHeading>
          <ShortcutNav items={role === "admin" ? [...SHORTCUTS_ADMIN] : [...SHORTCUTS_STUDENT]} />
          {loadError ? <AlertMessage kind="error">{loadError}</AlertMessage> : null}
          <div className="grid-2 home-stats-grid">
            <StatTile
              title="الدورات في الكتالوج"
              highlight={courseCount}
              action={
                <Link to={`${base}/courses`} className="inline-link">
                  الانتقال للدورات
                </Link>
              }
            />
            {role === "admin" ? (
              <StatTile
                title="طلبات معلّقة"
                highlight={pendingCount}
                action={
                  <Link to={`${base}/courses`} className="inline-link">
                    معالجة من صفحة الدورات
                  </Link>
                }
              />
            ) : (
              <StatTile
                title="مقرراتي"
                highlight={myCoursesCount}
                action={
                  <Link to="/student/mycourses" className="inline-link">
                    فتح مقرراتي
                  </Link>
                }
              />
            )}
            {role === "student" ? <StatTile title="إجمالي دروس مقرراتي" highlight={myLessonsCount} /> : null}
            {role === "student" ? <StatTile title="المقررات المفعّلة" highlight={myActiveCoursesCount} /> : null}
            {role === "student" ? (
              <StatTile
                title="مجلداتي"
                highlight={myFoldersCount}
                action={
                  <Link to="/student/myfiles" className="inline-link">
                    فتح ملفاتي
                  </Link>
                }
              />
            ) : null}
            {role === "student" ? <StatTile title="إجمالي ملفاتي" highlight={myFilesCount} /> : null}
            {role === "admin" ? (
              <StatTile title="إجمالي الطلاب" highlight={totalStudents} />
            ) : null}
            {role === "admin" ? (
              <StatTile title="إجمالي الدروس" highlight={totalLessons} />
            ) : null}
            {role === "student" ? (
              <StatTile
                title="طلبات انضمام معلّقة"
                highlight={pendingEnrollmentCount}
                action={
                  <Link to="/student/enrollment-requests" className="inline-link">
                    سجل «طلباتي»
                  </Link>
                }
              />
            ) : null}
            {role === "student" ? (
              <StatTile
                title="آخر طلب انضمام"
                wide
                action={
                  <Link to="/student/enrollment-requests" className="inline-link">
                    عرض الطلبات
                  </Link>
                }
              >
                {latestRequest ? (
                  <p className="muted small">
                    {latestRequest.targetName} · {latestRequest.status} · {formatFirestoreTime(latestRequest.requestedAt ?? latestRequest.processedAt)}
                  </p>
                ) : (
                  <p className="muted small">لا يوجد طلبات بعد.</p>
                )}
              </StatTile>
            ) : null}
            {role === "student" ? (
              <StatTile
                title="آخر مقرر تم إضافته"
                wide
                action={
                  <Link to="/student/mycourses" className="inline-link">
                    فتح مقرراتي
                  </Link>
                }
              >
                {latestMyCourse ? (
                  <p className="muted small">
                    {latestMyCourse.courseTitle || latestMyCourse.courseId} · {formatFirestoreTime(latestMyCourse.enrolledAt)}
                  </p>
                ) : (
                  <p className="muted small">لا يوجد مقررات بعد.</p>
                )}
              </StatTile>
            ) : null}
            <StatTile
              title="إشعارات غير مقروءة"
              highlight={unread}
              action={
                <Link to={`${base}/notifications`} className="inline-link">
                  عرض الإشعارات
                </Link>
              }
            />
            <StatTile
              title="آخر المنشورات"
              wide
              action={
                <Link to={`${base}/posts`} className="inline-link">
                  كل المنشورات
                </Link>
              }
            >
              {recentTitles.length === 0 ? (
                <p className="muted small">لا توجد منشورات بعد.</p>
              ) : (
                <ul className="post-preview-list">
                  {recentTitles.map((t, i) => (
                    <li key={`${i}-${t}`}>{t}</li>
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
