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
  const { tr } = useI18n();
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
      setMessage(tr("تعذر تحميل مقرراتك. تحقق من القواعد في Firestore."));
    } finally {
      setLoading(false);
    }
  }, [user]);

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
      <DashboardLayout role="student" title={tr("مقرراتي")} lede={tr("مقرراتك بعد قبول طلبات الانضمام.")}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role="student"
      title={tr("مقرراتي")}
      lede={tr("الدورات التي وافقت الإدارة على انضمامك إليها — يطابق تبويب «دوراتي» في تطبيق الجوال.")}
    >
      <PageToolbar>
        <input
          className="course-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("بحث في مقرراتي...")}
        />
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>{tr("تحديث القائمة")}</ButtonBusyLabel>
        </button>
        <Link to="/student/courses" className="ghost-btn toolbar-btn">
          {tr("تصفح الكتالوج")}
        </Link>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => setShowActivatedOnly((v) => !v)}
        >
          {showActivatedOnly ? tr("عرض كل المقررات") : tr("المفعلة فقط")}
        </button>
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={tr("عدد مقرراتي")} highlight={rows.length} />
          <StatTile
            title={tr("إجمالي الدروس")}
            highlight={rows.reduce((sum, c) => sum + (typeof c.lessonCount === "number" ? c.lessonCount : 0), 0)}
          />
          <StatTile
            title={tr("مقررات مفعلة")}
            highlight={rows.filter((c) => c.isActivated).length}
          />
          <StatTile
            title={tr("مقررات دائمة")}
            highlight={rows.filter((c) => c.isLifetime).length}
          />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visibleRows.length === 0 ? (
        <EmptyState className="empty-state" message={tr("لا يوجد مقررات مسجّل بها بعد.")}>
          <p className="empty-state-actions">
            <Link to="/student/courses" className="primary-btn">
              {tr("الذهاب لصفحة الدورات وطلب الانضمام")}
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
                <h3>{c.courseTitle || tr("مقرر")}</h3>
                <p className="muted">{c.courseDescription?.slice(0, 200) || tr("—")}</p>
                <div className="course-meta" style={{ marginTop: "0.5rem" }}>
                  <span className="meta-pill meta-pill--muted" title={tr("تاريخ التسجيل")}>
                    {tr("مسجّل")}: {formatFirestoreTime(c.enrolledAt)}
                  </span>
                  <span className={c.isActivated ? "meta-pill meta-pill--ok" : "meta-pill meta-pill--muted"}>
                    {c.isActivated ? tr("مفعّل") : tr("غير مفعّل")}
                  </span>
                  {c.isLifetime ? <span className="meta-pill meta-pill--info">{tr("تفعيل دائم")}</span> : null}
                  {c.lessonCount != null ? (
                    <span className="meta-pill meta-pill--muted">{c.lessonCount} {tr("درس")}</span>
                  ) : null}
                  {c.isActiveOnCatalog === false ? (
                    <span className="meta-pill meta-pill--warn" title={tr("قد لا يظهر في الكتالوج العام")}>
                      {tr("المقرر موقف في الكتالوج")}
                    </span>
                  ) : null}
                </div>
                <div className="course-actions">
                  <Link to={`/student/course/${c.courseId}`} className="primary-btn">
                    {tr("فتح المقرر والدروس")}
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
