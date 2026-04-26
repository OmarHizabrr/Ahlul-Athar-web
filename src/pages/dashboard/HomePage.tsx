import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLoadHint } from "../../components/ButtonBusyLabel";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { coursesService } from "../../services/coursesService";
import { myCoursesService } from "../../services/myCoursesService";
import { notificationsService } from "../../services/notificationsService";
import { postsService } from "../../services/postsService";
import type { UserRole } from "../../types";

export function HomePage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courseCount, setCourseCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [myCoursesCount, setMyCoursesCount] = useState(0);
  const [pendingEnrollmentCount, setPendingEnrollmentCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const base = role === "admin" ? "/admin" : "/student";

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const courses = await coursesService.listCoursesForRole(role);
      setCourseCount(courses.length);
      if (role === "admin") {
        const pending = await coursesService.listCourseEnrollmentRequests("pending");
        setPendingCount(pending.length);
        setPendingEnrollmentCount(0);
      } else {
        setPendingCount(0);
        const mine = await myCoursesService.listForStudent(user.uid);
        setMyCoursesCount(mine.length);
        try {
          const myReqs = await coursesService.listStudentEnrollmentRequests(user.uid);
          setPendingEnrollmentCount(myReqs.filter((r) => r.status === "pending").length);
        } catch {
          setPendingEnrollmentCount(0);
        }
      }
      const u = await notificationsService.countUnread(user.uid);
      setUnread(u);
      const posts = await postsService.listForRole(role);
      setRecentTitles(posts.slice(0, 3).map((p) => p.title));
    } catch {
      setLoadError("تعذر تحميل بعض بيانات الصفحة. حاول التحديث لاحقاً.");
      setRecentTitles([]);
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
          <p className="home-welcome">مرحباً، {displayName}.</p>
          {loadError ? <p className="message error">{loadError}</p> : null}
          <div className="grid-2 home-stats-grid">
            <div className="card-stat stat-tile">
              <strong>الدورات في الكتالوج</strong>
              <span className="stat-num">{courseCount}</span>
              <Link to={`${base}/courses`} className="inline-link">
                الانتقال للدورات
              </Link>
            </div>
            {role === "admin" ? (
              <div className="card-stat stat-tile">
                <strong>طلبات معلّقة</strong>
                <span className="stat-num">{pendingCount}</span>
                <Link to={`${base}/courses`} className="inline-link">
                  معالجة من صفحة الدورات
                </Link>
              </div>
            ) : (
              <div className="card-stat stat-tile">
                <strong>مقرراتي</strong>
                <span className="stat-num">{myCoursesCount}</span>
                <Link to="/student/mycourses" className="inline-link">
                  فتح مقرراتي
                </Link>
              </div>
            )}
            {role === "student" ? (
              <div className="card-stat stat-tile">
                <strong>طلبات انضمام معلّقة</strong>
                <span className="stat-num">{pendingEnrollmentCount}</span>
                <Link to="/student/enrollment-requests" className="inline-link">
                  سجل «طلباتي»
                </Link>
              </div>
            ) : null}
            <div className="card-stat stat-tile">
              <strong>إشعارات غير مقروءة</strong>
              <span className="stat-num">{unread}</span>
              <Link to={`${base}/notifications`} className="inline-link">
                عرض الإشعارات
              </Link>
            </div>
            <div className="card-stat stat-tile stat-tile-wide">
              <strong>آخر المنشورات</strong>
              {recentTitles.length === 0 ? (
                <p className="muted small">لا توجد منشورات بعد.</p>
              ) : (
                <ul className="post-preview-list">
                  {recentTitles.map((t, i) => (
                    <li key={`${i}-${t}`}>{t}</li>
                  ))}
                </ul>
              )}
              <Link to={`${base}/posts`} className="inline-link">
                كل المنشورات
              </Link>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
