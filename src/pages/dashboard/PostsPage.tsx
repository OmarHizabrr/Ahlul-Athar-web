import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { postsService } from "../../services/postsService";
import type { Post, UserRole } from "../../types";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import { formatFirestoreTime } from "../../utils/firestoreTime";

const postsLede: Record<UserRole, string> = {
  admin: "كتابة منشور ونشره للطلاب. الطلاب يرون المنشورات المفعّلة فقط (كما في التطبيق).",
  student: "الإعلانات والمنشورات التي نشرتها الإدارة للطلاب.",
};

export function PostsPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof postsService.listForRole>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await postsService.listForRole(role);
      setPosts(data);
    } catch {
      setMessage("تعذر تحميل المنشورات. تحقق من القواعد والفهارس في Firestore.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPublish(true);
  };

  const startEdit = (p: Post) => {
    setEditingId(p.id);
    setTitle(p.title);
    setBody(p.body);
    setPublish(p.isPublished);
    setMessage("");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || role !== "admin") {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      if (editingId) {
        await postsService.updatePost(editingId, { title, body, isPublished: publish });
        setMessage("تم حفظ تعديلات المنشور.");
        resetForm();
      } else {
        await postsService.create(user, { title, body, publish });
        setTitle("");
        setBody("");
        setPublish(true);
        setMessage("تم حفظ المنشور.");
      }
      setIsError(false);
      await load();
    } catch {
      setMessage(editingId ? "تعذر حفظ التعديل." : "تعذر إنشاء المنشور.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout role={role} title="المنشورات" lede={postsLede[role]}>
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role} title="المنشورات" lede={postsLede[role]}>
      {role === "admin" && user ? (
        <form className="course-form card-elevated" onSubmit={onSubmit}>
          <h3 className="form-section-title">{editingId ? "تعديل منشور" : "إنشاء منشور"}</h3>
          {editingId ? (
            <p className="muted small">
              تعديل المنشور الحالي.{" "}
              <button type="button" className="link-btn" onClick={resetForm} disabled={submitting}>
                إلغاء وإضافة منشور جديد
              </button>
            </p>
          ) : null}
          <label>
            <span>العنوان</span>
            <input
              className="text-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label>
            <span>النص</span>
            <textarea
              className="text-input textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
            />
          </label>
          <label className="switch-line">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            <span>نشر للطلاب (يظهر في التطبيق والويب)</span>
          </label>
          <div className="form-actions-row">
            <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
              <ButtonBusyLabel busy={submitting}>{editingId ? "حفظ التعديلات" : "نشر"}</ButtonBusyLabel>
            </button>
            {editingId ? (
              <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
                إلغاء
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}

      {loading ? (
        <PageLoadHint />
      ) : (
        <div className="course-list">
          {posts.length === 0 ? (
            <div className="empty-state-card" style={{ maxWidth: "100%" }}>
              <p className="muted" style={{ margin: 0 }}>
                لا توجد منشورات بعد.
              </p>
            </div>
          ) : (
            posts.map((p) => (
              <article className="course-item" key={p.id}>
                <h2 className="post-title">{p.title}</h2>
                <p className="muted post-meta">
                  {p.authorName} · {formatFirestoreTime(p.createdAt)}
                  {role === "admin" ? (p.isPublished ? " · منشور" : " · مسودة") : null}
                </p>
                <p className="post-body">{p.body}</p>
                {role === "admin" ? (
                  <div className="course-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => startEdit(p)}
                      disabled={submitting}
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={submitting}
                      aria-busy={submitting}
                      onClick={async () => {
                        setSubmitting(true);
                        try {
                          await postsService.updatePublish(p.id, !p.isPublished);
                          if (editingId === p.id) {
                            setPublish(!p.isPublished);
                          }
                          await load();
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      <ButtonBusyLabel busy={submitting}>
                        {p.isPublished ? "إلغاء النشر" : "نشر"}
                      </ButtonBusyLabel>
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={submitting}
                      aria-busy={submitting}
                      onClick={async () => {
                        if (!window.confirm("حذف المنشور؟")) {
                          return;
                        }
                        setSubmitting(true);
                        try {
                          if (editingId === p.id) {
                            resetForm();
                          }
                          await postsService.remove(p.id);
                          await load();
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      <ButtonBusyLabel busy={submitting}>حذف</ButtonBusyLabel>
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
