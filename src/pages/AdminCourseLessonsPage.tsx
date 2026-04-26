import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { lessonsService } from "../services/lessonsService";
import type { Course, Lesson } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

const CONTENT_TYPES = [
  { v: "text", label: "نص" },
  { v: "video", label: "فيديو" },
  { v: "pdf", label: "PDF" },
  { v: "audio", label: "صوت" },
] as const;

export function AdminCourseLessonsPage() {
  const { courseId = "" } = useParams();
  const { user, ready } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<string>("text");

  const load = useCallback(async () => {
    if (!courseId) {
      return;
    }
    setLoading(true);
    try {
      const c = await coursesService.getCourseById(courseId);
      setCourse(c);
      const L = await lessonsService.listByCourseId(courseId);
      setLessons(L);
    } catch {
      setMessage("تعذر التحميل.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (ready) {
      void load();
    }
  }, [ready, load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await lessonsService.createLesson(user, courseId, {
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        contentType,
      });
      setTitle("");
      setDescription("");
      setContent("");
      setMessage("تم إضافة الدرس وتحديث العدد في المقرر.");
      setIsError(false);
      await load();
    } catch {
      setMessage("فشلت الإضافة. تحقق من القواعد.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (L: Lesson) => {
    if (!window.confirm(`حذف الدرس: ${L.title}؟`)) {
      return;
    }
    setSubmitting(true);
    try {
      await lessonsService.deleteLesson(courseId, L.id);
      setMessage("تم حذف الدرس.");
      setIsError(false);
      await load();
    } catch {
      setMessage("فشل الحذف.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout role="admin" title="دروس المقرر">
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="admin" title={course ? `دروس: ${course.title}` : "دروس المقرر"}>
      <p>
        <Link to="/admin/courses" className="inline-link">
          ← العودة لقائمة المقررات
        </Link>
      </p>
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : !course ? (
        <p className="message error">المقرر غير موجود.</p>
      ) : (
        <>
          {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
          <p className="muted small">نفس مسار التطبيق: مجموعة lessons ثم مُعرّف المقرر ثم وثائق الدرس.</p>
          <form className="course-form" onSubmit={onCreate}>
            <h3 className="form-section-title">إضافة درس</h3>
            <label>
              <span>عنوان الدرس</span>
              <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              <span>وصف قصير</span>
              <input
                className="text-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </label>
            <label>
              <span>نوع المحتوى</span>
              <select
                className="text-input"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                {CONTENT_TYPES.map((x) => (
                  <option key={x.v} value={x.v}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>المحتوى (نص / تعليمات — للفيديو أضف الرابط لاحقاً من التطبيق عند الحاجة)</span>
              <textarea
                className="text-input textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                required
              />
            </label>
            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "جاري..." : "حفظ الدرس"}
            </button>
          </form>

          <h3 className="form-section-title" style={{ marginTop: "1rem" }}>
            الدروس الحالية
          </h3>
          {lessons.length === 0 ? (
            <p className="muted">لا دروس.</p>
          ) : (
            <div className="course-list">
              {lessons.map((L) => (
                <article className="course-item" key={L.id}>
                  <h4 className="post-title">{L.title}</h4>
                  <p className="muted post-meta">
                    {formatFirestoreTime(L.createdAt)} · {L.contentType || "نص"}
                  </p>
                  <p className="muted">{L.description?.slice(0, 120) || "—"}</p>
                  <div className="course-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void onDelete(L)}
                      disabled={submitting}
                    >
                      حذف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
