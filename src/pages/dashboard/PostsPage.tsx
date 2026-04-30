import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { DashboardLayout } from "../DashboardLayout";
import { postsService } from "../../services/postsService";
import type { Post, UserRole } from "../../types";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import {
  AlertMessage,
  AppModal,
  ContentList,
  ContentListItem,
  EmptyState,
  FormPanel,
  PageToolbar,
  SectionTitle,
  StatTile,
} from "../../components/ui";
import { formatFirestoreTime } from "../../utils/firestoreTime";

const postsLede: Record<UserRole, string> = {
  admin: "كتابة منشور ونشره للطلاب. الطلاب يرون المنشورات المفعّلة فقط (كما في التطبيق).",
  student: "الإعلانات والمنشورات التي نشرتها الإدارة للطلاب.",
};

export function PostsPage({ role }: { role: UserRole }) {
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof postsService.listForRole>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPublishedOnly, setShowPublishedOnly] = useState(role === "student");

  const visiblePosts =
    role === "admin" && showPublishedOnly ? posts.filter((p) => p.isPublished) : posts;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await postsService.listForRole(role);
      setPosts(data);
    } catch {
      setMessage(tr("تعذر تحميل المنشورات. تحقق من القواعد والفهارس في Firestore."));
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
    setPostModalOpen(false);
  };

  const startEdit = (p: Post) => {
    setEditingId(p.id);
    setTitle(p.title);
    setBody(p.body);
    setPublish(p.isPublished);
    setMessage("");
    setPostModalOpen(true);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const onOpenCreateModal = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setPublish(true);
    setPostModalOpen(true);
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
        setMessage(tr("تم حفظ تعديلات المنشور."));
        resetForm();
      } else {
        await postsService.create(user, { title, body, publish });
        setTitle("");
        setBody("");
        setPublish(true);
        setMessage(tr("تم حفظ المنشور."));
      }
      setIsError(false);
      await load();
    } catch {
      setMessage(editingId ? tr("تعذر حفظ التعديل.") : tr("تعذر إنشاء المنشور."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout role={role} title={tr("المنشورات")} lede={tr(postsLede[role])}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role} title={tr("المنشورات")} lede={tr(postsLede[role])}>
      {role === "admin" && user ? (
        <PageToolbar>
          <button type="button" className="primary-btn toolbar-btn" onClick={onOpenCreateModal}>
            {tr("إضافة منشور")}
          </button>
        </PageToolbar>
      ) : null}

      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={tr("إجمالي المنشورات")} highlight={posts.length} />
          <StatTile title={tr("منشورة")} highlight={posts.filter((p) => p.isPublished).length} />
          {role === "admin" ? (
            <StatTile title={tr("مسودات")} highlight={posts.filter((p) => !p.isPublished).length} />
          ) : null}
        </div>
      ) : null}
      {role === "admin" ? (
        <PageToolbar>
          <button
            type="button"
            className="ghost-btn toolbar-btn"
            onClick={() => setShowPublishedOnly((v) => !v)}
          >
            {showPublishedOnly ? tr("عرض كل المنشورات") : tr("عرض المنشور فقط")}
          </button>
        </PageToolbar>
      ) : null}

      {loading ? (
        <PageLoadHint />
      ) : (
        <ContentList>
          {visiblePosts.length === 0 ? (
            <EmptyState message={tr("لا توجد منشورات بعد.")} />
          ) : (
            visiblePosts.map((p) => (
              <ContentListItem key={p.id}>
                <h2 className="post-title">{p.title}</h2>
                <p className="muted post-meta">
                  {p.authorName} · {formatFirestoreTime(p.createdAt)}
                  {role === "admin" ? (p.isPublished ? ` · ${tr("منشور")}` : ` · ${tr("مسودة")}`) : null}
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
                      {tr("تعديل")}
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
                        {p.isPublished ? tr("إلغاء النشر") : tr("نشر")}
                      </ButtonBusyLabel>
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={submitting}
                      aria-busy={submitting}
                      onClick={async () => {
                        if (!window.confirm(tr("حذف المنشور؟"))) {
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
                      <ButtonBusyLabel busy={submitting}>{tr("حذف")}</ButtonBusyLabel>
                    </button>
                  </div>
                ) : null}
              </ContentListItem>
            ))
          )}
        </ContentList>
      )}

      {role === "admin" && user ? (
        <AppModal
          open={postModalOpen}
          title={editingId ? tr("تعديل منشور") : tr("إنشاء منشور")}
          onClose={() => {
            if (!submitting) {
              resetForm();
            }
          }}
          contentClassName="course-form-modal"
        >
          <FormPanel onSubmit={onSubmit} elevated={false} className="course-form-modal__form">
            <SectionTitle as="h4">{editingId ? tr("تحديث المنشور") : tr("منشور جديد")}</SectionTitle>
            <label>
              <span>{tr("العنوان")}</span>
              <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              <span>{tr("النص")}</span>
              <textarea
                className="text-input textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={4}
              />
            </label>
            <label className="switch-line">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
              <span>{tr("نشر للطلاب (يظهر في التطبيق والويب)")}</span>
            </label>
            <div className="course-actions">
              <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                <ButtonBusyLabel busy={submitting}>{editingId ? tr("حفظ التعديلات") : tr("نشر")}</ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={resetForm} disabled={submitting}>
                {tr("إلغاء")}
              </button>
            </div>
          </FormPanel>
        </AppModal>
      ) : null}
    </DashboardLayout>
  );
}
