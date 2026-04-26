import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DashboardLayout } from "./DashboardLayout";
import { authService } from "../services/authService";
import { coursesService } from "../services/coursesService";
import { notificationsService } from "../services/notificationsService";
import { postsService } from "../services/postsService";
import { userProfileService } from "../services/userProfileService";
import { usersService } from "../services/usersService";
import type { UserRole, UserFirestoreProfile } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";

// ——— الرئيسية ———

export function HomePage({ role }: { role: UserRole }) {
  const [loading, setLoading] = useState(true);
  const [courseCount, setCourseCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const user = authService.getLocalUser();
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
    void load();
  }, [load]);

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

// ——— المنشورات ———

export function PostsPage({ role }: { role: UserRole }) {
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof postsService.listForRole>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publish, setPublish] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const user = authService.getLocalUser();

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

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || role !== "admin") {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await postsService.create(user, { title, body, publish });
      setTitle("");
      setBody("");
      setMessage("تم حفظ المنشور.");
      setIsError(false);
      await load();
    } catch {
      setMessage("تعذر إنشاء المنشور.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role={role} title="المنشورات">
      {role === "admin" && user ? (
        <form className="course-form" onSubmit={onCreate}>
          <h3 className="form-section-title">إنشاء منشور</h3>
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
          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? "جاري الحفظ..." : "نشر"}
          </button>
        </form>
      ) : null}

      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}

      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : (
        <div className="course-list">
          {posts.length === 0 ? (
            <p className="muted">لا توجد منشورات.</p>
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
                      disabled={submitting}
                      onClick={async () => {
                        setSubmitting(true);
                        try {
                          await postsService.updatePublish(p.id, !p.isPublished);
                          await load();
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      {p.isPublished ? "إلغاء النشر" : "نشر"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={submitting}
                      onClick={async () => {
                        if (!window.confirm("حذف المنشور؟")) {
                          return;
                        }
                        setSubmitting(true);
                        try {
                          await postsService.remove(p.id);
                          await load();
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      حذف
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

// ——— الإشعارات ———

export function NotificationsPage({ role }: { role: UserRole }) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof notificationsService.listForUser>>>([]);
  const [usersPick, setUsersPick] = useState<{ uid: string; displayName: string; role: UserRole }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetUid, setTargetUid] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const u = authService.getLocalUser();

  const load = useCallback(async () => {
    if (!u) {
      return;
    }
    setLoading(true);
    try {
      const data = await notificationsService.listForUser(u.uid);
      setItems(data);
    } catch {
      setMessage("تعذر تحميل الإشعارات.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [u]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (role !== "admin") {
      return;
    }
    void (async () => {
      try {
        const list = await usersService.listRecentUsers();
        setUsersPick(list);
        if (list.length > 0) {
          setTargetUid((prev) => (prev ? prev : list[0].uid));
        }
      } catch {
        setUsersPick([]);
      }
    })();
  }, [role]);

  const onMarkRead = async (id: string) => {
    setSubmitting(true);
    try {
      await notificationsService.markRead(id);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const onMarkAll = async () => {
    if (!u) {
      return;
    }
    setSubmitting(true);
    try {
      await notificationsService.markAllReadForUser(u.uid);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!u || role !== "admin") {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await notificationsService.sendToUser(role, targetUid, nTitle, nBody);
      setNTitle("");
      setNBody("");
      setMessage("تم إرسال الإشعار.");
      setIsError(false);
    } catch {
      setMessage("تعذر الإرسال. تأكد من معرّف المستخدم وصلاحياتك.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role={role} title="الإشعارات">
      {role === "admin" && u ? (
        <form className="course-form" onSubmit={onSend}>
          <h3 className="form-section-title">إرسال إشعار لمستخدم</h3>
          <label>
            <span>المستلم</span>
            {usersPick.length > 0 ? (
              <select
                className="text-input"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                required
              >
                {usersPick.map((x) => (
                  <option key={x.uid} value={x.uid}>
                    {x.displayName} ({x.role === "admin" ? "مسؤول" : "طالب"}) — {x.uid}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="text-input"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                placeholder="user UID"
                required
              />
            )}
          </label>
          <label>
            <span>العنوان</span>
            <input
              className="text-input"
              value={nTitle}
              onChange={(e) => setNTitle(e.target.value)}
              required
            />
          </label>
          <label>
            <span>النص</span>
            <textarea
              className="text-input textarea"
              value={nBody}
              onChange={(e) => setNBody(e.target.value)}
              required
              rows={3}
            />
          </label>
          <button className="primary-btn" type="submit" disabled={submitting}>
            إرسال
          </button>
        </form>
      ) : null}

      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}

      <div className="toolbar notif-toolbar">
        <p className="muted">الإشعارات الخاصة بك</p>
        {items.some((i) => !i.read) ? (
          <button type="button" className="ghost-btn toolbar-btn" onClick={() => void onMarkAll()} disabled={submitting}>
            تعليم الكل كمقروء
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <p className="muted">لا توجد إشعارات.</p>
      ) : (
        <div className="course-list">
          {items.map((n) => (
            <article className={`course-item notif-item ${n.read ? "read" : "unread"}`} key={n.id}>
              <h2 className="post-title">{n.title}</h2>
              <p className="muted post-meta">{formatFirestoreTime(n.createdAt)}</p>
              <p className="post-body">{n.body}</p>
              {!n.read ? (
                <div className="course-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void onMarkRead(n.id)}
                    disabled={submitting}
                  >
                    تعليم كمقروء
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

// ——— الملف الشخصي ———

export function ProfilePage({ role }: { role: UserRole }) {
  const { user: u, ready, syncUserFromStorage } = useAuth();
  const [profile, setProfile] = useState<UserFirestoreProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!ready || !u) {
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const p = await userProfileService.getProfile(u.uid, u.role);
        setProfile(p);
        setDisplayName(p.displayName || u.displayName || "");
        setPhoneNumber(p.phoneNumber || u.phoneNumber || "");
      } catch {
        setMessage("تعذر تحميل الملف.");
        setIsError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, u]);

  if (!ready) {
    return (
      <DashboardLayout role={role} title="الملف الشخصي">
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!u) {
    return null;
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const next = await userProfileService.updateProfile(u, { displayName, phoneNumber });
      authService.persistLocalUser(next);
      syncUserFromStorage();
      setMessage("تم حفظ التعديلات.");
      setIsError(false);
    } catch {
      setMessage("تعذر الحفظ.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role={role} title="الملف الشخصي">
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : (
        <form className="course-form" onSubmit={onSave}>
          <p className="muted small">المعرّف: {u.uid}</p>
          <p className="muted small">البريد: {u.email || profile?.email || "—"}</p>
          <label>
            <span>الاسم الظاهر</span>
            <input
              className="text-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            <span>رقم الجوال (للتوثيق داخل التطبيق)</span>
            <input
              className="text-input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              type="tel"
            />
          </label>
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </form>
      )}
      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
    </DashboardLayout>
  );
}
