import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
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
  StatTile,
  Avatar,
} from "../../components/ui";
import { cn } from "../../utils/cn";
import { formatFirestoreTime } from "../../utils/firestoreTime";

export function NotificationsPage({ role }: { role: UserRole }) {
  const { user: u, ready } = useAuth();
  const { tr } = useI18n();
  const [items, setItems] = useState<Awaited<ReturnType<typeof notificationsService.listForUser>>>([]);
  const [usersPick, setUsersPick] = useState<
    { uid: string; displayName: string; role: UserRole; photoURL?: string; email?: string; isActive?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetUid, setTargetUid] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nImageUrl, setNImageUrl] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
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
      setMessage(tr("تعذر تحميل الإشعارات."));
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
      await notificationsService.sendToUser(role, u, targetUid, nTitle, nBody, nImageUrl);
      setNTitle("");
      setNBody("");
      setNImageUrl("");
      setSendModalOpen(false);
      setMessage(tr("تم إرسال الإشعار."));
      setIsError(false);
    } catch {
      setMessage(tr("تعذر الإرسال. تأكد من معرّف المستخدم وصلاحياتك."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const visibleItems = showUnreadOnly ? items.filter((n) => !n.read) : items;
  const visibleRecipients = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) {
      return usersPick;
    }
    return usersPick.filter((x) =>
      x.displayName.toLowerCase().includes(q) ||
      x.uid.toLowerCase().includes(q) ||
      (x.email ?? "").toLowerCase().includes(q),
    );
  }, [recipientSearch, usersPick]);

  if (!ready) {
    return (
      <DashboardLayout
        role={role}
        title={tr("الإشعارات")}
        lede={tr("نفس مزامنة الإشعارات مع تطبيق الجوال. يُحدَّث العداد في الشريط عند تعليم القراءة.")}
      >
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={role}
      title={tr("الإشعارات")}
      lede={tr("نفس مزامنة الإشعارات مع تطبيق الجوال. يُحدَّث العداد في الشريط عند تعليم القراءة.")}
    >
      {role === "admin" && u ? (
        <PageToolbar>
          <button type="button" className="primary-btn toolbar-btn" onClick={() => setSendModalOpen(true)}>
            {tr("إرسال إشعار")}
          </button>
        </PageToolbar>
      ) : null}

      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={tr("إجمالي الإشعارات")} highlight={items.length} />
          <StatTile title={tr("غير المقروءة")} highlight={items.filter((n) => !n.read).length} />
          <StatTile title={tr("بصور")} highlight={items.filter((n) => (n.imageUrl ?? "").trim().length > 0).length} />
        </div>
      ) : null}

      <PageToolbar className="notif-toolbar">
        <p className="muted">{tr("الإشعارات الخاصة بك")}</p>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => setShowUnreadOnly((v) => !v)}
        >
          {showUnreadOnly ? tr("عرض الكل") : tr("غير المقروء فقط")}
        </button>
        {items.some((i) => !i.read) ? (
          <button
            type="button"
            className="ghost-btn toolbar-btn"
            onClick={() => void onMarkAll()}
            disabled={submitting}
            aria-busy={submitting}
          >
            <ButtonBusyLabel busy={submitting}>{tr("تعليم الكل كمقروء")}</ButtonBusyLabel>
          </button>
        ) : null}
      </PageToolbar>

      {loading ? (
        <PageLoadHint />
      ) : visibleItems.length === 0 ? (
        <EmptyState message={tr("لا توجد إشعارات.")} />
      ) : (
        <ContentList>
          {visibleItems.map((n) => {
            const hasImage = Boolean(n.imageUrl?.trim());
            return (
              <ContentListItem
                key={n.id}
                className={cn("notif-item", n.read ? "read" : "unread", hasImage && "mycourse-card--cover")}
              >
                {hasImage ? <CoverImage variant="catalog" src={n.imageUrl} alt={n.title} /> : null}
                <div className={hasImage ? "mycourse-card-body" : undefined}>
                  <h2 className="post-title">{n.title}</h2>
                  <div className="person-meta-row">
                    <Avatar
                      photoURL={n.senderPhotoURL}
                      displayName={n.senderName}
                      email={null}
                      imageClassName="person-meta-avatar"
                      fallbackClassName="person-meta-avatar person-meta-avatar--fallback"
                      size={28}
                    />
                    <p className="muted post-meta">
                      {(n.senderName?.trim() || tr("الإدارة"))} · {formatFirestoreTime(n.createdAt)}
                    </p>
                  </div>
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
                        <ButtonBusyLabel busy={submitting}>{tr("تعليم كمقروء")}</ButtonBusyLabel>
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
          title={tr("إرسال إشعار لمستخدم")}
          onClose={() => {
            if (!submitting) {
              setSendModalOpen(false);
            }
          }}
          contentClassName="course-form-modal"
        >
          <FormPanel onSubmit={onSend} elevated={false} className="course-form-modal__form">
            <SectionTitle as="h4">{tr("إرسال إشعار")}</SectionTitle>
            <label>
              <span>{tr("المستلم")}</span>
              {usersPick.length > 0 ? (
                <div className="recipient-picker">
                  <input
                    className="text-input"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder={tr("ابحث بالاسم أو البريد أو المعرّف")}
                    aria-label={tr("بحث عن مستلم")}
                  />
                  <div className="recipient-picker-list" role="listbox" aria-label={tr("قائمة المستلمين")}>
                    {visibleRecipients.map((x) => (
                      <button
                        key={x.uid}
                        type="button"
                        className={cn("recipient-option", targetUid === x.uid && "recipient-option--active")}
                        onClick={() => setTargetUid(x.uid)}
                      >
                        <Avatar
                          photoURL={x.photoURL}
                          displayName={x.displayName}
                          email={x.email}
                          imageClassName="person-meta-avatar"
                          fallbackClassName="person-meta-avatar person-meta-avatar--fallback"
                          size={30}
                        />
                        <span className="recipient-option-main">
                          <strong>{x.displayName || x.uid}</strong>
                          <small>{x.role === "admin" ? tr("مسؤول") : tr("طالب")} · {x.email || x.uid}</small>
                        </span>
                        {x.isActive === false ? <span className="meta-pill meta-pill--warn">{tr("موقوف")}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
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
              <span>{tr("العنوان")}</span>
              <input className="text-input" value={nTitle} onChange={(e) => setNTitle(e.target.value)} required />
            </label>
            <label>
              <span>{tr("النص")}</span>
              <textarea
                className="text-input textarea"
                value={nBody}
                onChange={(e) => setNBody(e.target.value)}
                required
                rows={3}
              />
            </label>
            <label>
              <span>{tr("رابط صورة الإشعار (اختياري)")}</span>
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
                <ButtonBusyLabel busy={submitting}>{tr("إرسال")}</ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={() => setSendModalOpen(false)} disabled={submitting}>
                {tr("إلغاء")}
              </button>
            </div>
          </FormPanel>
        </AppModal>
      ) : null}
    </DashboardLayout>
  );
}
