import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { coursesService } from "../../services/coursesService";
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
  const base = role === "admin" ? "/admin" : "/student";

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    try {
      const courses = await coursesService.listCoursesForRole(role);
      setCourseCount(courses.length);
      if (role === "admin") {
        const pending = await coursesService.listCourseEnrollmentRequests("pending");
        setPendingCount(pending.length);
      } else {
        setPendingCount(0);
      }
      const u = await notificationsService.countUnread(user.uid);
      setUnread(u);
      const posts = await postsService.listForRole(role);
      setRecentTitles(posts.slice(0, 3).map((p) => p.title));
    } catch {
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
      <DashboardLayout role={role} title="الرئيسية">
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role} title="الرئيسية">
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : (
        <div className="grid-2">
          <div className="mini-card stat-tile">
            <strong>الدورات</strong>
            <span className="stat-num">{courseCount}</span>
            <Link to={`${base}/courses`} className="inline-link">
              الانتقال للدورات
            </Link>
          </div>
          {role === "admin" ? (
            <div className="mini-card stat-tile">
              <strong>طلبات معلّقة</strong>
              <span className="stat-num">{pendingCount}</span>
              <Link to={`${base}/courses`} className="inline-link">
                معالجة من صفحة الدورات
              </Link>
            </div>
          ) : null}
          <div className="mini-card stat-tile">
            <strong>إشعارات غير مقروءة</strong>
            <span className="stat-num">{unread}</span>
            <Link to={`${base}/notifications`} className="inline-link">
              عرض الإشعارات
            </Link>
          </div>
          <div className="mini-card stat-tile stat-tile-wide">
            <strong>آخر المنشورات</strong>
            {recentTitles.length === 0 ? (
              <p className="muted small">لا توجد منشورات بعد.</p>
            ) : (
              <ul className="post-preview-list">
                {recentTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            <Link to={`${base}/posts`} className="inline-link">
              كل المنشورات
            </Link>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
