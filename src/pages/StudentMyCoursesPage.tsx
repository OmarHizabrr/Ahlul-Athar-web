import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { cn } from "../utils/cn";
import { DashboardLayout } from "./DashboardLayout";
import { myCoursesService } from "../services/myCoursesService";
import type { MyCourseEntry } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";

export function StudentMyCoursesPage() {
  const { user, ready } = useAuth();
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
      setMessage("تعذر تحميل مقرراتك. تحقق من القواعد في Firestore.");
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
      <DashboardLayout role="student" title="مقرراتي" lede="مقرراتك بعد قبول طلبات الانضمام.">
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout
      role="student"
      title="مقرراتي"
      lede="الدورات التي وافقت الإدارة على انضمامك إليها — يطابق تبويب «دوراتي» في تطبيق الجوال."
    >
      <PageToolbar>
        <input
          className="course-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في مقرراتي..."
        />
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>تحديث القائمة</ButtonBusyLabel>
        </button>
        <Link to="/student/courses" className="ghost-btn toolbar-btn">
          تصفح الكتالوج
        </Link>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => setShowActivatedOnly((v) => !v)}
        >
          {showActivatedOnly ? "عرض كل المقررات" : "المفعلة فقط"}
        </button>
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title="عدد مقرراتي" highlight={rows.length} />
          <StatTile
            title="إجمالي الدروس"
            highlight={rows.reduce((sum, c) => sum + (typeof c.lessonCount === "number" ? c.lessonCount : 0), 0)}
          />
          <StatTile
            title="مقررات مفعلة"
            highlight={rows.filter((c) => c.isActivated).length}
          />
          <StatTile
            title="مقررات دائمة"
            highlight={rows.filter((c) => c.isLifetime).length}
          />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visibleRows.length === 0 ? (
        <EmptyState className="empty-state" message="لا يوجد مقررات مسجّل بها بعد.">
          <p className="empty-state-actions">
            <Link to="/student/courses" className="primary-btn">
              الذهاب لصفحة الدورات وطلب الانضمام
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
                <h3>{c.courseTitle || "مقرر"}</h3>
                <p className="muted">{c.courseDescription?.slice(0, 200) || "—"}</p>
                <div className="course-meta" style={{ marginTop: "0.5rem" }}>
                  <span className="meta-pill meta-pill--muted" title="تاريخ التسجيل">
                    مسجّل: {formatFirestoreTime(c.enrolledAt)}
                  </span>
                  <span className={c.isActivated ? "meta-pill meta-pill--ok" : "meta-pill meta-pill--muted"}>
                    {c.isActivated ? "مفعّل" : "غير مفعّل"}
                  </span>
                  {c.isLifetime ? <span className="meta-pill meta-pill--info">تفعيل دائم</span> : null}
                  {c.lessonCount != null ? (
                    <span className="meta-pill meta-pill--muted">{c.lessonCount} درس</span>
                  ) : null}
                  {c.isActiveOnCatalog === false ? (
                    <span className="meta-pill meta-pill--warn" title="قد لا يظهر في الكتالوج العام">
                      المقرر موقف في الكتالوج
                    </span>
                  ) : null}
                </div>
                <div className="course-actions">
                  <Link to={`/student/course/${c.courseId}`} className="primary-btn">
                    فتح المقرر والدروس
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
