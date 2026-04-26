import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { lessonsService } from "../services/lessonsService";
import type { Course, Lesson } from "../types";
import { IoPencil, IoTrashOutline } from "react-icons/io5";
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
  const [hasMandatoryQuiz, setHasMandatoryQuiz] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setContent("");
    setContentType("text");
    setHasMandatoryQuiz(false);
  };

  const startEdit = (L: Lesson) => {
    setEditingId(L.id);
    setTitle(L.title);
    setDescription(L.description ?? "");
    setContent(String(L.txtContent ?? L.content ?? ""));
    setContentType(L.contentType || "text");
    setHasMandatoryQuiz(L.hasMandatoryQuiz === true);
    setMessage("");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      if (editingId) {
        await lessonsService.updateLesson(courseId, editingId, {
          title: title.trim(),
          description: description.trim(),
          content: content.trim(),
          contentType,
          hasMandatoryQuiz,
        });
        setMessage("تم حفظ تعديلات الدرس.");
      } else {
        await lessonsService.createLesson(user, courseId, {
          title: title.trim(),
          description: description.trim(),
          content: content.trim(),
          contentType,
          hasMandatoryQuiz,
        });
        setMessage("تم إضافة الدرس وتحديث العدد في المقرر.");
        resetForm();
      }
      setIsError(false);
      if (editingId) {
        resetForm();
      }
      await load();
    } catch {
      setMessage(editingId ? "فشل حفظ التعديل. تحقق من القواعد." : "فشلت الإضافة. تحقق من القواعد.");
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

  const lessonsLede =
    "إضافة وحذف الدروس، وتحديد اختبار إجباري قبل الدرس التالي عند الحاجة — كما في منطق التطبيق.";

  if (!ready) {
    return (
      <DashboardLayout role="admin" title="دروس المقرر" lede={lessonsLede}>
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="admin" title={course ? `دروس: ${course.title}` : "دروس المقرر"} lede={lessonsLede}>
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
          <form className="course-form" onSubmit={onSubmit}>
            <h3 className="form-section-title">{editingId ? "تعديل الدرس" : "إضافة درس"}</h3>
            {editingId ? (
              <p className="muted small">
                تعديل الدرس الحالي.{" "}
                <button type="button" className="link-btn" onClick={resetForm} disabled={submitting}>
                  إلغاء والعودة لإضافة درس جديد
                </button>
              </p>
            ) : null}
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
            <label className="switch-line">
              <input
                type="checkbox"
                checked={hasMandatoryQuiz}
                onChange={(e) => setHasMandatoryQuiz(e.target.checked)}
              />
              <span>اختبار إجباري قبل الدرس التالي (hasMandatoryQuiz)</span>
            </label>
            <div className="form-actions-row">
              <button className="primary-btn" type="submit" disabled={submitting}>
                {submitting ? "جاري..." : editingId ? "حفظ التعديلات" : "حفظ الدرس"}
              </button>
              {editingId ? (
                <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
                  إلغاء التعديل
                </button>
              ) : null}
            </div>
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
                    {L.hasMandatoryQuiz ? " · إجباري للتالي" : ""}
                  </p>
                  <p className="muted">{L.description?.slice(0, 120) || "—"}</p>
                  <div className="course-actions lesson-admin-actions">
                    <button
                      type="button"
                      className="icon-tool-btn"
                      onClick={() => startEdit(L)}
                      disabled={submitting}
                      title="تعديل الدرس"
                      aria-label="تعديل الدرس"
                    >
                      <IoPencil size={20} />
                      <span className="icon-tool-label">تعديل</span>
                    </button>
                    <button
                      type="button"
                      className="icon-tool-btn danger"
                      onClick={() => void onDelete(L)}
                      disabled={submitting}
                      title="حذف الدرس"
                      aria-label="حذف الدرس"
                    >
                      <IoTrashOutline size={20} />
                      <span className="icon-tool-label">حذف</span>
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
