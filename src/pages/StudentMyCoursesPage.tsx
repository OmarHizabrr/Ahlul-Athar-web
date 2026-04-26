import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { useAuth } from "../context/AuthContext";
import { DashboardLayout } from "./DashboardLayout";
import { myCoursesService } from "../services/myCoursesService";
import type { MyCourseEntry } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";

export function StudentMyCoursesPage() {
  const { user, ready } = useAuth();
  const [rows, setRows] = useState<MyCourseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
      <div className="toolbar">
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
      </div>
      {message ? <p className="message error">{message}</p> : null}
      {loading ? (
        <PageLoadHint />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-card">
            <p className="muted">لا يوجد مقررات مسجّل بها بعد.</p>
            <p className="empty-state-actions">
              <Link to="/student/courses" className="primary-btn">
                الذهاب لصفحة الدورات وطلب الانضمام
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="course-list">
          {rows.map((c) => (
            <article className="course-item" key={c.courseId}>
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
              </div>
              <div className="course-actions">
                <Link to={`/student/course/${c.courseId}`} className="primary-btn">
                  فتح المقرر والدروس
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
