import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { notificationsService } from "../../services/notificationsService";
import { usersService } from "../../services/usersService";
import type { UserRole } from "../../types";
import { formatFirestoreTime } from "../../utils/firestoreTime";

export function NotificationsPage({ role }: { role: UserRole }) {
  const { user: u, ready } = useAuth();
  const [items, setItems] = useState<Awaited<ReturnType<typeof notificationsService.listForUser>>>([]);
  const [usersPick, setUsersPick] = useState<{ uid: string; displayName: string; role: UserRole }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetUid, setTargetUid] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
    if (!ready || !u) {
      return;
    }
    void load();
  }, [ready, u, load]);

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
      window.dispatchEvent(new CustomEvent("ah:notifications-updated"));
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
      window.dispatchEvent(new CustomEvent("ah:notifications-updated"));
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

  if (!ready) {
    return (
      <DashboardLayout
        role={role}
        title="الإشعارات"
        lede="نفس مزامنة الإشعارات مع تطبيق الجوال. يُحدَّث العداد في الشريط عند تعليم القراءة."
      >
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={role}
      title="الإشعارات"
      lede="نفس مزامنة الإشعارات مع تطبيق الجوال. يُحدَّث العداد في الشريط عند تعليم القراءة."
    >
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
