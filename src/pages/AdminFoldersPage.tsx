import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppModal, ContentList, ContentListItem, CoverImage, EmptyState, PageToolbar, StatTile, cn } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { directoryService } from "../services/directoryService";
import { foldersService } from "../services/foldersService";
import type { Folder, StudentRecord } from "../types";
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
        directoryService.listStudents(1000),
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

  const addMember = async (student: StudentRecord) => {
    if (!membersFolder) return;
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
          if (!busy) setMembersModalOpen(false);
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form">
          <label>
            <span>{t("web_pages.admin_folders.members_search", "بحث عن طالب")}</span>
            <input
              className="text-input"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder={t("web_pages.admin_folders.members_search_ph", "اكتب الاسم/البريد/الجوال/المعرّف")}
            />
          </label>
          <label className="switch-line course-form-modal__switch">
            <input
              type="checkbox"
              checked={activationLifetime}
              onChange={(e) => setActivationLifetime(e.target.checked)}
            />
            <span>{t("web_pages.admin_folders.activation_lifetime", "تفعيل مدى الحياة")}</span>
          </label>
          {!activationLifetime ? (
            <label>
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

          <h4>{t("web_pages.admin_folders.current_members", "الأعضاء الحاليون")}</h4>
          {members.length === 0 ? (
            <EmptyState message={t("web_pages.admin_folders.current_members_empty", "لا يوجد أعضاء في هذا المجلد.")} />
          ) : (
            <ContentList>
              {members.map((m) => (
                <ContentListItem key={m.uid} className="user-row">
                  <div>
                    <h4 className="post-title">{m.displayName || m.uid}</h4>
                    <p className="muted small">
                      {m.email || t("web_shell.dash_em", "—")} {m.phone ? `· ${m.phone}` : ""}
                      {m.createdAt != null
                        ? ` · ${t("web_pages.admin_folders.joined_at", "انضم")}: ${formatFirestoreTime(m.createdAt)}`
                        : ""}
                      {m.linkedByName ? ` · ${t("web_pages.admin_students.linked_by", "بواسطة")}: ${m.linkedByName}` : ""}
                    </p>
                  </div>
                  <button type="button" className="ghost-btn" onClick={() => void removeMember(m)} disabled={busy}>
                    <ButtonBusyLabel busy={busy}>{t("web_pages.admin_folders.member_remove_btn", "إزالة")}</ButtonBusyLabel>
                  </button>
                </ContentListItem>
              ))}
            </ContentList>
          )}

          <h4>{t("web_pages.admin_folders.add_members", "إضافة عضو")}</h4>
          <ContentList>
            {allStudents
              .filter((s) => !members.some((m) => m.uid === s.uid))
              .filter((s) => {
                const q = memberSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  (s.displayName ?? "").toLowerCase().includes(q) ||
                  (s.email ?? "").toLowerCase().includes(q) ||
                  (s.phone ?? "").toLowerCase().includes(q) ||
                  s.uid.toLowerCase().includes(q)
                );
              })
              .slice(0, 40)
              .map((s) => (
                <ContentListItem key={s.uid} className="user-row">
                  <div>
                    <h4 className="post-title">{s.displayName || s.uid}</h4>
                    <p className="muted small">
                      {s.email || t("web_shell.dash_em", "—")} {s.phone ? `· ${s.phone}` : ""}
                    </p>
                  </div>
                  <button type="button" className="primary-btn" onClick={() => void addMember(s)} disabled={busy}>
                    <ButtonBusyLabel busy={busy}>{t("web_pages.admin_folders.member_add_btn", "إضافة")}</ButtonBusyLabel>
                  </button>
                </ContentListItem>
              ))}
          </ContentList>
        </div>
      </AppModal>
    </DashboardLayout>
  );
}

