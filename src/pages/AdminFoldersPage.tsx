import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { useI18n } from "../context/I18nContext";
import { directoryService } from "../services/directoryService";
import { foldersService } from "../services/foldersService";
import type { Folder, StudentRecord } from "../types";
import { folderMemberAccessSummary, inferActivationDaysForForm, inferMemberLifetime } from "../utils/folderMemberAccess";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";

export function AdminFoldersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersFolder, setMembersFolder] = useState<Folder | null>(null);
  const [members, setMembers] = useState<StudentRecord[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [activationLifetime, setActivationLifetime] = useState(true);
  const [activationDays, setActivationDays] = useState(30);
  const [addActivationOpen, setAddActivationOpen] = useState(false);
  const [studentPendingAdd, setStudentPendingAdd] = useState<StudentRecord | null>(null);
  const [editActivationOpen, setEditActivationOpen] = useState(false);
  const [studentPendingEdit, setStudentPendingEdit] = useState<StudentRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await foldersService.listFoldersForAdmin();
      setRows(data);
    } catch {
      setMessage(t("web_pages.admin_folders.load_failed", "تعذر تحميل المجلدات. تحقق من صلاحيات Firestore."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((f) => f.name.toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const openMembersModal = async (folder: Folder) => {
    setBusy(true);
    setMessage(null);
    try {
      const [currentMembers, students] = await Promise.all([
        foldersService.listFolderMembers(folder.id),
        directoryService.listAllStudents(),
      ]);
      setMembersFolder(folder);
      setMembers(currentMembers);
      setAllStudents(students);
      setMemberSearch("");
      setActivationLifetime(true);
      setActivationDays(30);
      setMembersModalOpen(true);
    } catch {
      setMessage(t("web_pages.admin_folders.members_load_failed", "تعذر تحميل أعضاء المجلد."));
    } finally {
      setBusy(false);
    }
  };

  const studentsToAddFiltered = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
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
  }, [allStudents, members, memberSearch]);

  const openAddActivation = (student: StudentRecord) => {
    setEditActivationOpen(false);
    setStudentPendingEdit(null);
    setStudentPendingAdd(student);
    setActivationLifetime(true);
    setActivationDays(30);
    setAddActivationOpen(true);
  };

  const openEditActivation = (student: StudentRecord) => {
    setAddActivationOpen(false);
    setStudentPendingAdd(null);
    setStudentPendingEdit(student);
    setActivationLifetime(inferMemberLifetime(student));
    setActivationDays(inferActivationDaysForForm(student));
    setEditActivationOpen(true);
  };

  const confirmUpdateMemberPeriod = async () => {
    const student = studentPendingEdit;
    if (!membersFolder || !student) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await foldersService.updateFolderMemberActivation({
        folder: membersFolder,
        memberId: student.uid,
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      const currentMembers = await foldersService.listFolderMembers(membersFolder.id);
      setMembers(currentMembers);
      setEditActivationOpen(false);
      setStudentPendingEdit(null);
      setMessage(t("web_pages.admin_folders.member_update_period_ok", "تم تحديث مدة وصول العضو."));
    } catch {
      setMessage(t("web_pages.admin_folders.member_update_period_failed", "تعذر تحديث مدة العضو."));
    } finally {
      setBusy(false);
    }
  };

  const confirmAddMember = async () => {
    const student = studentPendingAdd;
    if (!membersFolder || !student) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await foldersService.addMemberToFolder({
        folder: membersFolder,
        member: student,
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      const [currentMembers, refreshedFolders] = await Promise.all([
        foldersService.listFolderMembers(membersFolder.id),
        foldersService.listFoldersForAdmin(),
      ]);
      setMembers(currentMembers);
      setRows(refreshedFolders);
      setAddActivationOpen(false);
      setStudentPendingAdd(null);
      setMessage(t("web_pages.admin_folders.member_add_ok", "تمت إضافة الطالب للمجلد."));
    } catch {
      setMessage(t("web_pages.admin_folders.member_add_failed", "تعذر إضافة الطالب للمجلد."));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (student: StudentRecord) => {
    if (!membersFolder) return;
    const ok = window.confirm(
      `${t("web_pages.admin_folders.member_remove_confirm_prefix", "إزالة العضو")}: ${student.displayName || student.uid}؟`,
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await foldersService.removeMemberFromFolder(membersFolder.id, student.uid);
      const [currentMembers, refreshedFolders] = await Promise.all([
        foldersService.listFolderMembers(membersFolder.id),
        foldersService.listFoldersForAdmin(),
      ]);
      setMembers(currentMembers);
      setRows(refreshedFolders);
      setMessage(t("web_pages.admin_folders.member_remove_ok", "تمت إزالة العضو من المجلد."));
    } catch {
      setMessage(t("web_pages.admin_folders.member_remove_failed", "تعذر إزالة العضو من المجلد."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout
      role="admin"
      title={t("web_pages.nav.folders", "المجلدات")}
      lede={t(
        "web_pages.admin_folders.lede",
        "إدارة المجلدات (عرض/بحث/تفاصيل) بنفس فكرة تبويب «المجلدات» في التطبيق.",
      )}
    >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {t("web_pages.admin_folders.refresh", "تحديث")}
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("web_pages.admin_folders.search_ph", "بحث في المجلدات")}
          aria-label={t("web_pages.admin_folders.search_ph", "بحث في المجلدات")}
        />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t("web_pages.admin_folders.stat_total", "إجمالي المجلدات")} highlight={rows.length} />
          <StatTile title={t("web_pages.admin_folders.stat_results", "النتائج")} highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message={t("web_pages.admin_folders.empty", "لا توجد مجلدات حتى الآن.")} />
      ) : (
        <ContentList>
          {visible.map((f) => {
            const hasImg = Boolean(f.coverImageUrl?.trim());
            return (
              <ContentListItem key={f.id} className={cn("folder-row", hasImg && "enrollment-req-item--row")}>
                {hasImg ? (
                  <CoverImage variant="thumb" src={f.coverImageUrl} alt={f.name} className="enrollment-req-thumb" />
                ) : null}
                <div className="enrollment-req-item__body">
                  <h3 className="post-title">{f.name}</h3>
                  {f.description ? <p className="muted small">{f.description}</p> : null}
                  <div className="course-meta lesson-course-meta">
                    <span>
                      {typeof f.fileCount === "number"
                        ? `${f.fileCount} ${t("web_pages.admin_folders.file_word", "ملف")}`
                        : t("web_shell.dash_em", "—")}
                    </span>
                    <span>
                      {typeof f.memberCount === "number"
                        ? `${f.memberCount} ${t("web_pages.admin_folders.member_word", "عضو")}`
                        : t("web_shell.dash_em", "—")}
                    </span>
                    <span>
                      {f.folderType === "private"
                        ? t("web_pages.admin_folders.type_private", "خاص")
                        : t("web_pages.admin_folders.type_public", "عام")}
                    </span>
                  </div>
                  <div className="course-actions">
                    <Link className="primary-btn" to={`/admin/folder/${f.id}`}>
                      {t("web_pages.admin_folders.open_details", "فتح التفاصيل")}
                    </Link>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void openMembersModal(f)}
                      disabled={busy}
                    >
                      {t("web_pages.admin_folders.members_btn", "الأعضاء")}
                    </button>
                    <Link className="ghost-btn" to={`/admin/folder/${f.id}/members`}>
                      {t("web_pages.admin_folders.members_manage_full", "إدارة كاملة")}
                    </Link>
                  </div>
                </div>
              </ContentListItem>
            );
          })}
        </ContentList>
      )}
      <AppModal
        open={membersModalOpen}
        title={
          membersFolder
            ? `${t("web_pages.admin_folders.members_modal_title", "أعضاء المجلد")}: ${membersFolder.name}`
            : t("web_pages.admin_folders.members_modal_title", "أعضاء المجلد")
        }
        onClose={() => {
          if (!busy) {
            setMembersModalOpen(false);
            setAddActivationOpen(false);
            setStudentPendingAdd(null);
            setEditActivationOpen(false);
            setStudentPendingEdit(null);
          }
        }}
        contentClassName="course-form-modal folder-members-modal-wrap"
      >
        <div className="course-form-modal__form folder-members-modal">
          <div className="folder-members-modal__search">
            <label className="folder-members-modal__search-label" htmlFor="folder-members-search">
              {t("web_pages.admin_folders.members_search", "بحث عن طالب")}
            </label>
            <input
              id="folder-members-search"
              className="text-input folder-members-modal__search-input"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={t("web_pages.admin_folders.members_search_ph", "اكتب الاسم/البريد/الجوال/المعرّف")}
              autoComplete="off"
            />
            <p className="muted small folder-members-modal__hint">
              {t(
                "web_pages.admin_folders.add_member_flow_hint",
                "اختر طالباً ثم حدّد مدة التفعيل في النافذة التالية كما في التطبيق.",
              )}
            </p>
          </div>

          <section className="folder-members-modal__section">
            <h4 className="folder-members-modal__section-title">
              {t("web_pages.admin_folders.current_members", "الأعضاء الحاليون")}
            </h4>
            {members.length === 0 ? (
              <EmptyState message={t("web_pages.admin_folders.current_members_empty", "لا يوجد أعضاء في هذا المجلد.")} />
            ) : (
              <div className="folder-members-modal__scroll">
                <ContentList>
                  {members.map((m) => (
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
                            {m.createdAt != null
                              ? ` · ${t("web_pages.admin_folders.joined_at", "انضم")}: ${formatFirestoreTime(m.createdAt)}`
                              : ""}
                            {m.linkedByName
                              ? ` · ${t("web_pages.admin_students.linked_by", "بواسطة")}: ${m.linkedByName}`
                              : ""}
                          </p>
                          <p className="muted small folder-members-modal__access">{folderMemberAccessSummary(m, t)}</p>
                        </div>
                      </div>
                      <div className="folder-members-modal__row-actions course-actions">
                        <button type="button" className="ghost-btn" onClick={() => openEditActivation(m)} disabled={busy}>
                          {t("web_pages.admin_folders.member_edit_period_btn", "تعديل المدة")}
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => void removeMember(m)} disabled={busy}>
                          <ButtonBusyLabel busy={busy}>{t("web_pages.admin_folders.member_remove_btn", "إزالة")}</ButtonBusyLabel>
                        </button>
                      </div>
                    </ContentListItem>
                  ))}
                </ContentList>
              </div>
            )}
          </section>

          <section className="folder-members-modal__section">
            <div className="folder-members-modal__section-head">
              <h4 className="folder-members-modal__section-title">{t("web_pages.admin_folders.add_members", "إضافة عضو")}</h4>
              <span className="folder-members-modal__count muted small">
                {t("web_pages.admin_folders.add_pool_total", "إجمالي الطلاب")}: {allStudents.length} ·{" "}
                {t("web_pages.admin_folders.add_pool_available", "متاح للإضافة")}: {studentsToAddFiltered.length}
              </span>
            </div>
            {studentsToAddFiltered.length === 0 ? (
              <EmptyState
                message={t("web_pages.admin_folders.add_members_empty", "لا يوجد طلاب مطابقون أو الجميع أعضاء بالفعل.")}
              />
            ) : (
              <div className="folder-members-modal__scroll folder-members-modal__scroll--add">
                <ContentList>
                  {studentsToAddFiltered.map((s) => (
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
          </section>
        </div>
      </AppModal>

      <AppModal
        open={addActivationOpen}
        title={t("web_pages.admin_folders.activation_modal_title", "مدة التفعيل")}
        onClose={() => {
          if (!busy) {
            setAddActivationOpen(false);
            setStudentPendingAdd(null);
          }
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form folder-activation-modal">
          {studentPendingAdd ? (
            <>
              <div className="folder-activation-modal__preview">
                <Avatar
                  photoURL={studentPendingAdd.photoURL}
                  displayName={studentPendingAdd.displayName}
                  email={studentPendingAdd.email}
                  alt={studentPendingAdd.displayName || studentPendingAdd.uid}
                  imageClassName="user-avatar topbar-avatar"
                  fallbackClassName="user-avatar-fallback topbar-avatar"
                  size={48}
                />
                <div>
                  <p className="post-title" style={{ margin: 0 }}>
                    {studentPendingAdd.displayName || studentPendingAdd.uid}
                  </p>
                  <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                    {studentPendingAdd.email || t("web_shell.dash_em", "—")}
                    {studentPendingAdd.phone ? ` · ${studentPendingAdd.phone}` : ""}
                  </p>
                </div>
              </div>
              <p className="muted small folder-activation-modal__lede">
                {t(
                  "web_pages.admin_folders.activation_modal_lede",
                  "حدد صلاحية وصول العضو للمجلد ثم أكّد الإضافة.",
                )}
              </p>
              <label className="switch-line folder-activation-modal__switch">
                <input
                  type="checkbox"
                  checked={activationLifetime}
                  onChange={(e) => setActivationLifetime(e.target.checked)}
                />
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
                    if (!busy) {
                      setAddActivationOpen(false);
                      setStudentPendingAdd(null);
                    }
                  }}
                  disabled={busy}
                >
                  {t("web_pages.admin_folders.activation_modal_back", "رجوع")}
                </button>
                <button type="button" className="primary-btn" onClick={() => void confirmAddMember()} disabled={busy}>
                  <ButtonBusyLabel busy={busy}>{t("web_pages.admin_folders.member_confirm_add", "تأكيد الإضافة")}</ButtonBusyLabel>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </AppModal>

      <AppModal
        open={editActivationOpen}
        title={t("web_pages.admin_folders.edit_activation_modal_title", "تعديل مدة التفعيل")}
        onClose={() => {
          if (!busy) {
            setEditActivationOpen(false);
            setStudentPendingEdit(null);
          }
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form folder-activation-modal">
          {studentPendingEdit ? (
            <>
              <div className="folder-activation-modal__preview">
                <Avatar
                  photoURL={studentPendingEdit.photoURL}
                  displayName={studentPendingEdit.displayName}
                  email={studentPendingEdit.email}
                  alt={studentPendingEdit.displayName || studentPendingEdit.uid}
                  imageClassName="user-avatar topbar-avatar"
                  fallbackClassName="user-avatar-fallback topbar-avatar"
                  size={48}
                />
                <div>
                  <p className="post-title" style={{ margin: 0 }}>
                    {studentPendingEdit.displayName || studentPendingEdit.uid}
                  </p>
                  <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
                    {studentPendingEdit.email || t("web_shell.dash_em", "—")}
                    {studentPendingEdit.phone ? ` · ${studentPendingEdit.phone}` : ""}
                  </p>
                </div>
              </div>
              <p className="muted small folder-activation-modal__lede">
                {t(
                  "web_pages.admin_folders.edit_activation_modal_lede",
                  "عدّل مدى الحياة أو عدد أيام الوصول من الآن؛ سيتم حفظها في سجل العضو كما في التطبيق.",
                )}
              </p>
              <label className="switch-line folder-activation-modal__switch">
                <input
                  type="checkbox"
                  checked={activationLifetime}
                  onChange={(e) => setActivationLifetime(e.target.checked)}
                />
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
                    if (!busy) {
                      setEditActivationOpen(false);
                      setStudentPendingEdit(null);
                    }
                  }}
                  disabled={busy}
                >
                  {t("web_pages.admin_folders.activation_modal_back", "رجوع")}
                </button>
                <button type="button" className="primary-btn" onClick={() => void confirmUpdateMemberPeriod()} disabled={busy}>
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

