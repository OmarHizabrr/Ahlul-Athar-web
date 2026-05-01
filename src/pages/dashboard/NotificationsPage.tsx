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
  AppTabs,
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
  const { t } = useI18n();
  const [items, setItems] = useState<Awaited<ReturnType<typeof notificationsService.listForUser>>>([]);
  const [usersPick, setUsersPick] = useState<
    { uid: string; displayName: string; role: UserRole; photoURL?: string; email?: string; isActive?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetUid, setTargetUid] = useState("");
  const [audience, setAudience] = useState<"single" | "students" | "admins" | "all">("single");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nImageUrl, setNImageUrl] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [adminTab, setAdminTab] = useState<"sent" | "inbox">("sent");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [sentItems, setSentItems] = useState<Awaited<ReturnType<typeof notificationsService.listSentByAdmin>>>([]);

  const load = useCallback(async () => {
    if (!u) {
      return;
    }
    setLoading(true);
    try {
      const inboxPromise = notificationsService.listForUser(u.uid);
      const sentPromise = role === "admin" ? notificationsService.listSentByAdmin(u.uid) : Promise.resolve([]);
      const [inboxData, sentData] = await Promise.all([inboxPromise, sentPromise]);
      setItems(inboxData);
      setSentItems(sentData);
    } catch {
      setMessage(t("web_pages.notifications.load_failed", "تعذر تحميل الإشعارات."));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [u, role, t]);

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
      const activeUsers = usersPick.filter((x) => x.isActive !== false);
      const targetIds =
        audience === "single"
          ? [targetUid]
          : audience === "students"
            ? activeUsers.filter((x) => x.role === "student").map((x) => x.uid)
            : audience === "admins"
              ? activeUsers.filter((x) => x.role === "admin").map((x) => x.uid)
              : activeUsers.map((x) => x.uid);
      const sentCount = await notificationsService.sendToMany(role, u, targetIds, nTitle, nBody, nImageUrl);
      setNTitle("");
      setNBody("");
      setNImageUrl("");
      setSendModalOpen(false);
      setMessage(`${t("web_pages.notifications.sent_ok", "تم إرسال الإشعار.")} (${sentCount})`);
      setIsError(false);
      await load();
      window.dispatchEvent(new CustomEvent("ah:notifications-updated"));
    } catch {
      setMessage(t("web_pages.notifications.send_failed", "تعذر الإرسال. تأكد من معرّف المستخدم وصلاحياتك."));
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const visibleItems = showUnreadOnly ? items.filter((n) => !n.read) : items;
  const renderedItems = role === "admin" && adminTab === "sent" ? sentItems : visibleItems;
  const statItems = role === "admin" && adminTab === "sent" ? sentItems : items;
  const recipientNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usersPick) {
      m.set(u.uid, u.displayName || u.email || u.uid);
    }
    return m;
  }, [usersPick]);
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
        title={t("web_pages.nav.notifications", "الإشعارات")}
        lede={t(
          "web_pages.notifications.lede",
          "نفس مزامنة الإشعارات مع تطبيق الجوال. يُحدَّث العداد في الشريط عند تعليم القراءة.",
        )}
      >
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role={role}
      title={t("web_pages.nav.notifications", "الإشعارات")}
      lede={t(
        "web_pages.notifications.lede",
        "نفس مزامنة الإشعارات مع تطبيق الجوال. يُحدَّث العداد في الشريط عند تعليم القراءة.",
      )}
    >
      {role === "admin" && u ? (
        <PageToolbar>
          <button type="button" className="primary-btn toolbar-btn" onClick={() => setSendModalOpen(true)}>
            {t("web_pages.notifications.send_action", "إرسال إشعار")}
          </button>
        </PageToolbar>
      ) : null}

      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t("web_pages.notifications.stat_total", "إجمالي الإشعارات")} highlight={statItems.length} />
          <StatTile title={t("web_pages.notifications.stat_unread", "غير المقروءة")} highlight={statItems.filter((n) => !n.read).length} />
          <StatTile
            title={t("web_pages.notifications.stat_with_images", "بصور")}
            highlight={statItems.filter((n) => (n.imageUrl ?? "").trim().length > 0).length}
          />
        </div>
      ) : null}

      {role === "admin" ? (
        <AppTabs
          groupId="admin-notifications-tabs"
          ariaLabel={t("web_pages.notifications.tabs_aria", "أقسام الإشعارات")}
          value={adminTab}
          onChange={(id) => setAdminTab(id as "sent" | "inbox")}
          tabs={[
            { id: "sent", label: t("web_pages.notifications.tab_sent", "المرسلة") },
            { id: "inbox", label: t("web_pages.notifications.tab_inbox", "الواردة لي") },
          ]}
        />
      ) : null}

      <PageToolbar className="notif-toolbar">
        <p className="muted">
          {role === "admin" && adminTab === "sent"
            ? t("web_pages.notifications.list_heading_sent", "الإشعارات المرسلة")
            : t("web_pages.notifications.list_heading_inbox", "الإشعارات الخاصة بك")}
        </p>
        {role !== "admin" || adminTab === "inbox" ? (
          <>
            <button
              type="button"
              className="ghost-btn toolbar-btn"
              onClick={() => setShowUnreadOnly((v) => !v)}
            >
              {showUnreadOnly
                ? t("web_pages.notifications.show_all", "عرض الكل")
                : t("web_pages.notifications.unread_only", "غير المقروء فقط")}
            </button>
            {items.some((i) => !i.read) ? (
              <button
                type="button"
                className="ghost-btn toolbar-btn"
                onClick={() => void onMarkAll()}
                disabled={submitting}
                aria-busy={submitting}
              >
                <ButtonBusyLabel busy={submitting}>
                  {t("web_pages.notifications.mark_all_read", "تعليم الكل كمقروء")}
                </ButtonBusyLabel>
              </button>
            ) : null}
          </>
        ) : null}
      </PageToolbar>

      {loading ? (
        <PageLoadHint />
      ) : renderedItems.length === 0 ? (
        <EmptyState message={t("web_pages.notifications.empty", "لا توجد إشعارات.")} />
      ) : (
        <ContentList>
          {renderedItems.map((n) => {
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
                      {(n.senderName?.trim() || t("web_pages.notifications.sender_default", "الإدارة"))} ·{" "}
                      {formatFirestoreTime(n.createdAt)}
                      {role === "admin" && adminTab === "sent"
                        ? ` · ${t("web_pages.notifications.to_prefix", "إلى")}: ${recipientNameMap.get(n.userId) ?? n.userId}`
                        : null}
                    </p>
                  </div>
                  <p className="post-body">{n.body}</p>
                  {(role !== "admin" || adminTab === "inbox") && !n.read ? (
                    <div className="course-actions">
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => void onMarkRead(n.id)}
                        disabled={submitting}
                        aria-busy={submitting}
                      >
                        <ButtonBusyLabel busy={submitting}>
                          {t("web_pages.notifications.mark_read", "تعليم كمقروء")}
                        </ButtonBusyLabel>
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
          title={t("web_pages.notifications.modal_title", "إرسال إشعار لمستخدم")}
          onClose={() => {
            if (!submitting) {
              setSendModalOpen(false);
            }
          }}
          contentClassName="course-form-modal"
        >
          <FormPanel onSubmit={onSend} elevated={false} className="course-form-modal__form">
            <SectionTitle as="h4">{t("web_pages.notifications.form_heading", "إرسال إشعار")}</SectionTitle>
            <label>
              <span>{t("web_pages.notifications.audience_label", "نوع الإرسال")}</span>
              <select className="text-input" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                <option value="single">{t("web_pages.notifications.aud_single", "مستخدم واحد")}</option>
                <option value="students">{t("web_pages.notifications.aud_students", "كل الطلاب")}</option>
                <option value="admins">{t("web_pages.notifications.aud_admins", "كل المشرفين")}</option>
                <option value="all">{t("web_pages.notifications.aud_all", "كل المستخدمين")}</option>
              </select>
            </label>
            <label>
              <span>{t("web_pages.notifications.recipient_label", "المستلم")}</span>
              {audience === "single" && usersPick.length > 0 ? (
                <div className="recipient-picker">
                  <input
                    className="text-input"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder={t("web_pages.notifications.recipient_search_ph", "ابحث بالاسم أو البريد أو المعرّف")}
                    aria-label={t("web_pages.notifications.recipient_search_aria", "بحث عن مستلم")}
                  />
                  <div
                    className="recipient-picker-list"
                    role="listbox"
                    aria-label={t("web_pages.notifications.recipient_list_aria", "قائمة المستلمين")}
                  >
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
                          <small>
                            {x.role === "admin"
                              ? t("web_pages.login.role_admin", "مسؤول")
                              : t("web_pages.login.role_student", "طالب")}{" "}
                            · {x.email || x.uid}
                          </small>
                        </span>
                        {x.isActive === false ? (
                          <span className="meta-pill meta-pill--warn">
                            {t("web_pages.notifications.suspended", "موقوف")}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : audience === "single" ? (
                <input
                  className="text-input"
                  value={targetUid}
                  onChange={(e) => setTargetUid(e.target.value)}
                  placeholder={t("web_pages.notifications.uid_placeholder", "معرّف المستخدم")}
                  required
                />
              ) : (
                <p className="muted small">
                  {audience === "students"
                    ? t("web_pages.notifications.hint_students", "سيتم الإرسال لكل الطلاب النشطين.")
                    : audience === "admins"
                      ? t("web_pages.notifications.hint_admins", "سيتم الإرسال لكل المشرفين النشطين.")
                      : t("web_pages.notifications.hint_all", "سيتم الإرسال لكل المستخدمين النشطين.")}
                </p>
              )}
            </label>
            <label>
              <span>{t("web_pages.posts.field_title", "العنوان")}</span>
              <input className="text-input" value={nTitle} onChange={(e) => setNTitle(e.target.value)} required />
            </label>
            <label>
              <span>{t("web_pages.posts.field_body", "النص")}</span>
              <textarea
                className="text-input textarea"
                value={nBody}
                onChange={(e) => setNBody(e.target.value)}
                required
                rows={3}
              />
            </label>
            <label>
              <span>{t("web_pages.notifications.image_url_label", "رابط صورة الإشعار (اختياري)")}</span>
              <input
                className="text-input"
                type="url"
                value={nImageUrl}
                onChange={(e) => setNImageUrl(e.target.value)}
                placeholder={t("web_pages.notifications.image_url_ph", "https://...")}
              />
            </label>
            <div className="course-actions">
              <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
                <ButtonBusyLabel busy={submitting}>
                  {t("web_pages.notifications.submit_send", "إرسال")}
                </ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={() => setSendModalOpen(false)} disabled={submitting}>
                {t("web_pages.notifications.cancel", "إلغاء")}
              </button>
            </div>
          </FormPanel>
        </AppModal>
      ) : null}
    </DashboardLayout>
  );
}
