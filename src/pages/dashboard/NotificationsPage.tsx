import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { notificationsService } from "../../services/notificationsService";
import { usersService } from "../../services/usersService";
import type { UserRole } from "../../types";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import {
  AlertMessage,
  AppModal,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  FormPanel,
  PageToolbar,
  SectionTitle,
} from "../../components/ui";
import { cn } from "../../utils/cn";
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
  const [nImageUrl, setNImageUrl] = useState("");
  const [sendModalOpen, setSendModalOpen] = useState(false);
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
      await notificationsService.sendToUser(role, targetUid, nTitle, nBody, nImageUrl);
      setNTitle("");
      setNBody("");
      setNImageUrl("");
      setSendModalOpen(false);
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
        <PageLoadHint text="جاري التهيئة..." />
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
        <PageToolbar>
          <button type="button" className="primary-btn toolbar-btn" onClick={() => setSendModalOpen(true)}>
            إرسال إشعار
          </button>
        </PageToolbar>
      ) : null}

      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}

      <PageToolbar className="notif-toolbar">
        <p className="muted">الإشعارات الخاصة بك</p>
        {items.some((i) => !i.read) ? (
          <button
            type="button"
            className="ghost-btn toolbar-btn"
            onClick={() => void onMarkAll()}
            disabled={submitting}
            aria-busy={submitting}
          >
            <ButtonBusyLabel busy={submitting}>تعليم الكل كمقروء</ButtonBusyLabel>
          </button>
        ) : null}
      </PageToolbar>

      {loading ? (
        <PageLoadHint />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد إشعارات." />
      ) : (
        <ContentList>
          {items.map((n) => {
            const hasImage = Boolean(n.imageUrl?.trim());
            return (
              <ContentListItem
                key={n.id}
                className={cn("notif-item", n.read ? "read" : "unread", hasImage && "mycourse-card--cover")}
              >
                {hasImage ? <CoverImage variant="catalog" src={n.imageUrl} alt={n.title} /> : null}
                <div className={hasImage ? "mycourse-card-body" : undefined}>
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
                        aria-busy={submitting}
                      >
                        <ButtonBusyLabel busy={submitting}>تعليم كمقروء</ButtonBusyLabel>
                      </button>
                    </div>
                  ) : null}
                </div>
              </ContentListItem>
            );
          })}
        </ContentList>
      )}

      {role === "admin" && u ? (
        <AppModal
          open={sendModalOpen}
          title="إرسال إشعار لمستخدم"
          onClose={() => {
            if (!submitting) {
              setSendModalOpen(false);
            }
          }}
          contentClassName="course-form-modal"
        >
          <FormPanel onSubmit={onSend} elevated={false} className="course-form-modal__form">
            <SectionTitle as="h4">إرسال إشعار</SectionTitle>
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
              <input className="text-input" value={nTitle} onChange={(e) => setNTitle(e.target.value)} required />
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
            <label>
              <span>رابط صورة الإشعار (اختياري)</span>
              <input
                className="text-input"
                type="url"
                value={nImageUrl}
                onChange={(e) => setNImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="course-actions">
              <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                <ButtonBusyLabel busy={submitting}>إرسال</ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={() => setSendModalOpen(false)} disabled={submitting}>
                إلغاء
              </button>
            </div>
          </FormPanel>
        </AppModal>
      ) : null}
    </DashboardLayout>
  );
}
