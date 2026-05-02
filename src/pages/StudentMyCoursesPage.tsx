import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  PageToolbar,
  StatTile,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { cn } from "../utils/cn";
import { DashboardLayout } from "./DashboardLayout";
import { myCoursesService } from "../services/myCoursesService";
import type { MyCourseEntry } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";

export function StudentMyCoursesPage() {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<MyCourseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showActivatedOnly, setShowActivatedOnly] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await myCoursesService.listForStudent(user.uid);
      setRows(data);
    } catch {
      setMessage(t("web_pages.student_mycourses.load_failed", "تعذر تحميل مقرراتك. تحقق من القواعد في Firestore."));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = showActivatedOnly ? rows.filter((r) => r.isActivated) : rows;
    if (!q) {
      return base;
    }
    return base.filter(
      (r) =>
        (r.courseTitle ?? "").toLowerCase().includes(q) ||
        (r.courseDescription ?? "").toLowerCase().includes(q),
    );
  }, [rows, search, showActivatedOnly]);

  if (!ready) {
    return (
      <DashboardLayout
        role="student"
        title={t("web_pages.nav.my_courses", "مقرراتي")}
        lede={t("web_pages.student_mycourses.lede_short", "مقرراتك بعد قبول طلبات الانضمام.")}
      >
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout
      role="student"
      title={t("web_pages.nav.my_courses", "مقرراتي")}
      lede={t(
        "web_pages.student_mycourses.lede",
        "الدورات التي وافقت الإدارة على انضمامك إليها — يطابق تبويب «دوراتي» في تطبيق الجوال.",
      )}
    >
      <PageToolbar>
        <input
          className="course-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("web_pages.student_mycourses.search_ph", "بحث في مقرراتي...")}
        />
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>
            {t("web_pages.student_mycourses.refresh_list", "تحديث القائمة")}
          </ButtonBusyLabel>
        </button>
        <Link to="/student/courses" className="ghost-btn toolbar-btn">
          {t("web_pages.student_mycourses.browse_catalog", "تصفح الكتالوج")}
        </Link>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => setShowActivatedOnly((v) => !v)}
        >
          {showActivatedOnly
            ? t("web_pages.student_mycourses.show_all_courses", "عرض كل المقررات")
            : t("web_pages.student_mycourses.activated_only", "المفعلة فقط")}
        </button>
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t("web_pages.student_mycourses.stat_my_count", "عدد مقرراتي")} highlight={rows.length} />
          <StatTile
            title={t("web_pages.student_mycourses.stat_total_lessons", "إجمالي الدروس")}
            highlight={rows.reduce((sum, c) => sum + (typeof c.lessonCount === "number" ? c.lessonCount : 0), 0)}
          />
          <StatTile
            title={t("web_pages.student_mycourses.stat_activated", "مقررات مفعلة")}
            highlight={rows.filter((c) => c.isActivated).length}
          />
          <StatTile
            title={t("web_pages.student_mycourses.stat_lifetime", "مقررات دائمة")}
            highlight={rows.filter((c) => c.isLifetime).length}
          />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visibleRows.length === 0 ? (
        <EmptyState className="empty-state" message={t("web_pages.student_mycourses.empty", "لا يوجد مقررات مسجّل بها بعد.")}>
          <p className="empty-state-actions">
            <Link to="/student/courses" className="primary-btn">
              {t("web_pages.student_mycourses.empty_cta", "الذهاب لصفحة الدورات وطلب الانضمام")}
            </Link>
          </p>
        </EmptyState>
      ) : (
        <ContentList>
          {visibleRows.map((c) => (
            <ContentListItem
              key={c.courseId}
              className={cn("mycourse-card", c.courseImageURL && "mycourse-card--cover")}
            >
              {c.courseImageURL ? (
                <CoverImage variant="catalog" src={c.courseImageURL} alt={c.courseTitle} />
              ) : null}
              <div className="mycourse-card-body">
                <h3>{c.courseTitle || t("web_pages.student_mycourses.fallback_title", "مقرر")}</h3>
                <p className="muted">
                  {c.courseDescription?.slice(0, 200) || t("web_shell.dash_em", "—")}
                </p>
                <div className="course-meta" style={{ marginTop: "0.5rem" }}>
                  <span
                    className="meta-pill meta-pill--muted"
                    title={t("web_pages.student_mycourses.enrolled_on", "تاريخ التسجيل")}
                  >
                    {t("web_pages.student_mycourses.enrolled_label", "مسجّل")}: {formatFirestoreTime(c.enrolledAt)}
                  </span>
                  <span className={c.isActivated ? "meta-pill meta-pill--ok" : "meta-pill meta-pill--muted"}>
                    {c.isActivated
                      ? t("web_pages.student_mycourses.status_activated", "مفعّل")
                      : t("web_pages.student_mycourses.status_not_activated", "غير مفعّل")}
                  </span>
                  {c.isLifetime ? (
                    <span className="meta-pill meta-pill--info">
                      {t("web_pages.student_mycourses.lifetime_badge", "تفعيل دائم")}
                    </span>
                  ) : null}
                  {c.lessonCount != null ? (
                    <span className="meta-pill meta-pill--muted">
                      {c.lessonCount} {t("web_pages.student_mycourses.lesson_word", "درس")}
                    </span>
                  ) : null}
                  {c.isActiveOnCatalog === false ? (
                    <span
                      className="meta-pill meta-pill--warn"
                      title={t("web_pages.student_mycourses.catalog_paused_title", "قد لا يظهر في الكتالوج العام")}
                    >
                      {t("web_pages.student_mycourses.catalog_paused_badge", "المقرر موقف في الكتالوج")}
                    </span>
                  ) : null}
                </div>
                <div className="course-actions">
                  <Link to={`/student/course/${c.courseId}`} className="primary-btn">
                    {t("web_pages.student_mycourses.open_course_lessons", "فتح المقرر والدروس")}
                  </Link>
                </div>
              </div>
            </ContentListItem>
          ))}
        </ContentList>
      )}
    </DashboardLayout>
  );
}
