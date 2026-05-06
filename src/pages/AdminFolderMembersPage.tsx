import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  AppModal,
  Avatar,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  PageToolbar,
  StatTile,
  cn,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { directoryService } from "../services/directoryService";
import { foldersService } from "../services/foldersService";
import type { Folder, StudentRecord } from "../types";
import { folderMemberAccessSummary, inferActivationDaysForForm, inferMemberLifetime } from "../utils/folderMemberAccess";
import { dashboardBackLinkState } from "../utils/dashboardBackNavigation";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

export function AdminFolderMembersPage() {
  const { folderId = "" } = useParams();
  const { user, ready } = useAuth();
  const { t } = useI18n();

  const [folder, setFolder] = useState<Folder | null>(null);
  const [members, setMembers] = useState<StudentRecord[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const [activationLifetime, setActivationLifetime] = useState(true);
  const [activationDays, setActivationDays] = useState(30);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<StudentRecord | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<StudentRecord | null>(null);

  const load = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setMessage(null);
    try {
      const [f, ms] = await Promise.all([foldersService.getFolderById(folderId), foldersService.listFolderMembers(folderId)]);
      setFolder(f);
      setMembers(ms);
    } catch {
      setFolder(null);
      setMembers([]);
      setMessage(t("web_pages.admin_folders.members_load_failed", "تعذر تحميل أعضاء المجلد."));
    } finally {
      setLoading(false);
    }
  }, [folderId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAddModal = async () => {
    if (!folder) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await directoryService.listAllStudents();
      setAllStudents(data);
      setStudentSearch("");
      setAddOpen(true);
    } catch {
      setAllStudents([]);
      setMessage(t("web_pages.admin_folders.members_load_failed", "تعذر تحميل أعضاء المجلد."));
    } finally {
      setBusy(false);
    }
  };

  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((s) => {
      return (
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        s.uid.toLowerCase().includes(q)
      );
    });
  }, [members, search]);

  const visibleStudentsToAdd = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const existing = new Set(members.map((m) => m.uid));
    const base = allStudents.filter((s) => !existing.has(s.uid));
    if (!q) return base;
    return base.filter((s) => {
      return (
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        s.uid.toLowerCase().includes(q)
      );
    });
  }, [allStudents, members, studentSearch]);

  const openAddActivation = (student: StudentRecord) => {
    setPendingAdd(student);
    setActivationLifetime(true);
    setActivationDays(30);
    setAddOpen(false);
  };

  const confirmAdd = async () => {
    if (!folder || !pendingAdd) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await foldersService.addMemberToFolder({
        folder,
        member: pendingAdd,
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      setPendingAdd(null);
      await load();
      setMessage(t("web_pages.admin_folders.member_add_ok", "تمت إضافة الطالب للمجلد."));
    } catch {
      setMessage(t("web_pages.admin_folders.member_add_failed", "تعذر إضافة الطالب للمجلد."));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (student: StudentRecord) => {
    if (!folderId) return;
    const ok = window.confirm(
      `${t("web_pages.admin_folders.member_remove_confirm_prefix", "إزالة العضو")}: ${student.displayName || student.uid}؟`,
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await foldersService.removeMemberFromFolder(folderId, student.uid);
      await load();
      setMessage(t("web_pages.admin_folders.member_remove_ok", "تمت إزالة العضو من المجلد."));
    } catch {
      setMessage(t("web_pages.admin_folders.member_remove_failed", "تعذر إزالة العضو من المجلد."));
    } finally {
      setBusy(false);
    }
  };

  const openEditActivation = (student: StudentRecord) => {
    setPendingEdit(student);
    setActivationLifetime(inferMemberLifetime(student));
    setActivationDays(inferActivationDaysForForm(student));
    setEditOpen(true);
  };

  const confirmEdit = async () => {
    if (!folder || !pendingEdit) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await foldersService.updateFolderMemberActivation({
        folder,
        memberId: pendingEdit.uid,
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      setEditOpen(false);
      setPendingEdit(null);
      await load();
      setMessage(t("web_pages.admin_folders.member_update_period_ok", "تم تحديث مدة وصول العضو."));
    } catch {
      setMessage(t("web_pages.admin_folders.member_update_period_failed", "تعذر تحديث مدة العضو."));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout role="admin" title={t("web_pages.admin_folders.members_page_title", "إدارة أعضاء المجلد")} lede={t("web_shell.dash_em", "—")}>
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const backState = dashboardBackLinkState(`/admin/folder/${folderId}/members`);

  return (
    <DashboardLayout
      role="admin"
      title={
        folder
          ? `${t("web_pages.admin_folders.members_page_title", "إدارة أعضاء المجلد")}: ${folder.name}`
          : t("web_pages.admin_folders.members_page_title", "إدارة أعضاء المجلد")
      }
      lede={t("web_pages.admin_folders.members_page_lede", "صفحة مستقلة لإدارة أعضاء المجلد (إضافة/إزالة/تعديل مدة التفعيل) كما في التطبيق.")}
    >
      <PageToolbar>
        <Link to={`/admin/folder/${folderId}`} className="ghost-btn toolbar-btn" {...backState}>
          {t("web_pages.admin_folders.back_details", "← الرجوع للتفاصيل")}
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading || busy} aria-busy={loading || busy}>
          {t("web_pages.admin_folders.refresh", "تحديث")}
        </button>
        <button type="button" className="primary-btn toolbar-btn" onClick={() => void openAddModal()} disabled={busy || loading || !folder}>
          {t("web_pages.admin_folders.add_members", "إضافة عضو")}
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("web_pages.admin_folders.members_search_ph", "اكتب الاسم/البريد/الجوال/المعرّف")}
          aria-label={t("web_pages.admin_folders.members_search", "بحث عن طالب")}
        />
      </PageToolbar>

      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint />
      ) : !folder ? (
        <EmptyState message={t("web_pages.admin_folders.not_found", "المجلد غير موجود.")} />
      ) : (
        <>
          <div className="members-modal-course-banner admin-course-lessons-banner">
            {folder.coverImageUrl?.trim() ? (
              <CoverImage variant="thumb" src={folder.coverImageUrl} alt={folder.name} className="members-modal-course-banner__img" />
            ) : (
              <div className="modal-entity-pick__placeholder modal-entity-pick__placeholder--inline" aria-hidden>
                {(folder.name || "?").trim().slice(0, 1)}
              </div>
            )}
            <div>
              <p className="post-title" style={{ margin: 0 }}>
                {folder.name}
              </p>
              {folder.description ? <p className="muted small">{folder.description}</p> : null}
            </div>
          </div>

          <div className="grid-2 home-stats-grid">
            <StatTile title={t("web_pages.admin_folders.current_members", "الأعضاء الحاليون")} highlight={members.length} />
            <StatTile title={t("web_pages.admin_folders.stat_results", "النتائج")} highlight={visibleMembers.length} />
          </div>

          {visibleMembers.length === 0 ? (
            <EmptyState message={t("web_pages.admin_folders.current_members_empty", "لا يوجد أعضاء في هذا المجلد.")} />
          ) : (
            <ContentList>
              {visibleMembers.map((m) => (
                <ContentListItem key={m.uid} className="user-row folder-members-modal__row">
                  <div className="folder-members-modal__user">
                    <Avatar
                      photoURL={m.photoURL}
                      displayName={m.displayName}
                      email={m.email}
                      alt={m.displayName || m.uid}
                      imageClassName="user-avatar topbar-avatar"
                      fallbackClassName="user-avatar-fallback topbar-avatar"
                      size={40}
                    />
                    <div className="folder-members-modal__user-text">
                      <h4 className="post-title">{m.displayName || m.uid}</h4>
                      <p className="muted small">
                        {m.email || t("web_shell.dash_em", "—")} {m.phone ? `· ${m.phone}` : ""}
                        {m.createdAt != null ? ` · ${t("web_pages.admin_folders.joined_at", "انضم")}: ${formatFirestoreTime(m.createdAt)}` : ""}
                        {m.linkedByName ? ` · ${t("web_pages.admin_students.linked_by", "بواسطة")}: ${m.linkedByName}` : ""}
                      </p>
                      <p className="muted small folder-members-modal__access">{folderMemberAccessSummary(m, t)}</p>
                    </div>
                  </div>
                  <div className={cn("folder-members-modal__row-actions", "course-actions")}>
                    <Link className="ghost-btn toolbar-btn" to={`/admin/student/${m.uid}`} {...backState}>
                      {t("web_pages.admin_students.open_profile", "فتح الملف")}
                    </Link>
                    <button type="button" className="ghost-btn toolbar-btn" onClick={() => openEditActivation(m)} disabled={busy}>
                      {t("web_pages.admin_folders.member_edit_period_btn", "تعديل المدة")}
                    </button>
                    <button type="button" className="ghost-btn toolbar-btn" onClick={() => void removeMember(m)} disabled={busy}>
                      <ButtonBusyLabel busy={busy}>{t("web_pages.admin_folders.member_remove_btn", "إزالة")}</ButtonBusyLabel>
                    </button>
                  </div>
                </ContentListItem>
              ))}
            </ContentList>
          )}
        </>
      )}

      <AppModal
        open={addOpen}
        title={t("web_pages.admin_folders.add_members", "إضافة عضو")}
        onClose={() => {
          if (!busy) setAddOpen(false);
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form">
          <label>
            <span>{t("web_pages.admin_folders.members_search", "بحث عن طالب")}</span>
            <input
              className="text-input"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder={t("web_pages.admin_folders.members_search_ph", "اكتب الاسم/البريد/الجوال/المعرّف")}
            />
          </label>
          {visibleStudentsToAdd.length === 0 ? (
            <EmptyState message={t("web_pages.admin_folders.add_members_empty", "لا يوجد طلاب مطابقون أو الجميع أعضاء بالفعل.")} />
          ) : (
            <div className="folder-members-modal__scroll folder-members-modal__scroll--add">
              <ContentList>
                {visibleStudentsToAdd.map((s) => (
                  <ContentListItem key={s.uid} className="user-row folder-members-modal__row">
                    <div className="folder-members-modal__user">
                      <Avatar
                        photoURL={s.photoURL}
                        displayName={s.displayName}
                        email={s.email}
                        alt={s.displayName || s.uid}
                        imageClassName="user-avatar topbar-avatar"
                        fallbackClassName="user-avatar-fallback topbar-avatar"
                        size={40}
                      />
                      <div className="folder-members-modal__user-text">
                        <h4 className="post-title">{s.displayName || s.uid}</h4>
                        <p className="muted small">
                          {s.email || t("web_shell.dash_em", "—")} {s.phone ? `· ${s.phone}` : ""}
                        </p>
                      </div>
                    </div>
                    <button type="button" className="primary-btn" onClick={() => openAddActivation(s)} disabled={busy}>
                      {t("web_pages.admin_folders.member_pick_btn", "اختيار")}
                    </button>
                  </ContentListItem>
                ))}
              </ContentList>
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        open={Boolean(pendingAdd)}
        title={t("web_pages.admin_folders.activation_modal_title", "مدة التفعيل")}
        onClose={() => {
          if (!busy) setPendingAdd(null);
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form folder-activation-modal">
          {pendingAdd ? (
            <>
              <div className="folder-activation-modal__preview">
                <Avatar
                  photoURL={pendingAdd.photoURL}
                  displayName={pendingAdd.displayName}
                  email={pendingAdd.email}
                  alt={pendingAdd.displayName || pendingAdd.uid}
                  imageClassName="user-avatar topbar-avatar"
                  fallbackClassName="user-avatar-fallback topbar-avatar"
                  size={48}
                />
                <div>
                  <p className="post-title" style={{ margin: 0 }}>
                    {pendingAdd.displayName || pendingAdd.uid}
                  </p>
                  <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                    {pendingAdd.email || t("web_shell.dash_em", "—")}
                    {pendingAdd.phone ? ` · ${pendingAdd.phone}` : ""}
                  </p>
                </div>
              </div>
              <label className="switch-line folder-activation-modal__switch">
                <input type="checkbox" checked={activationLifetime} onChange={(e) => setActivationLifetime(e.target.checked)} />
                <span>{t("web_pages.admin_folders.activation_lifetime", "تفعيل مدى الحياة")}</span>
              </label>
              {!activationLifetime ? (
                <label className="folder-activation-modal__days">
                  <span>{t("web_pages.admin_folders.activation_days", "أيام التفعيل")}</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    value={activationDays}
                    onChange={(e) => setActivationDays(Number(e.target.value || 30))}
                  />
                </label>
              ) : null}
              <div className="course-actions folder-activation-modal__actions">
                <button type="button" className="ghost-btn" onClick={() => setPendingAdd(null)} disabled={busy}>
                  {t("web_pages.admin_folders.activation_modal_back", "رجوع")}
                </button>
                <button type="button" className="primary-btn" onClick={() => void confirmAdd()} disabled={busy || !folder}>
                  <ButtonBusyLabel busy={busy}>{t("web_pages.admin_folders.member_confirm_add", "تأكيد الإضافة")}</ButtonBusyLabel>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={editOpen}
        title={t("web_pages.admin_folders.edit_activation_modal_title", "تعديل مدة التفعيل")}
        onClose={() => {
          if (!busy) {
            setEditOpen(false);
            setPendingEdit(null);
          }
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form folder-activation-modal">
          {pendingEdit ? (
            <>
              <div className="folder-activation-modal__preview">
                <Avatar
                  photoURL={pendingEdit.photoURL}
                  displayName={pendingEdit.displayName}
                  email={pendingEdit.email}
                  alt={pendingEdit.displayName || pendingEdit.uid}
                  imageClassName="user-avatar topbar-avatar"
                  fallbackClassName="user-avatar-fallback topbar-avatar"
                  size={48}
                />
                <div>
                  <p className="post-title" style={{ margin: 0 }}>
                    {pendingEdit.displayName || pendingEdit.uid}
                  </p>
                  <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                    {pendingEdit.email || t("web_shell.dash_em", "—")}
                    {pendingEdit.phone ? ` · ${pendingEdit.phone}` : ""}
                  </p>
                </div>
              </div>
              <label className="switch-line folder-activation-modal__switch">
                <input type="checkbox" checked={activationLifetime} onChange={(e) => setActivationLifetime(e.target.checked)} />
                <span>{t("web_pages.admin_folders.activation_lifetime", "تفعيل مدى الحياة")}</span>
              </label>
              {!activationLifetime ? (
                <label className="folder-activation-modal__days">
                  <span>{t("web_pages.admin_folders.activation_days", "أيام التفعيل")}</span>
                  <input
                    className="text-input"
                    type="number"
                    min={1}
                    value={activationDays}
                    onChange={(e) => setActivationDays(Number(e.target.value || 30))}
                  />
                </label>
              ) : null}
              <div className="course-actions folder-activation-modal__actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setEditOpen(false);
                    setPendingEdit(null);
                  }}
                  disabled={busy}
                >
                  {t("web_pages.admin_folders.activation_modal_back", "رجوع")}
                </button>
                <button type="button" className="primary-btn" onClick={() => void confirmEdit()} disabled={busy || !folder}>
                  <ButtonBusyLabel busy={busy}>
                    {t("web_pages.admin_folders.member_confirm_update_period", "حفظ المدة")}
                  </ButtonBusyLabel>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </AppModal>
    </DashboardLayout>
  );
}

