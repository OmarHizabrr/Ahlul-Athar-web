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
import { coursesService } from "../services/coursesService";
import { directoryService } from "../services/directoryService";
import type { Course, StudentRecord } from "../types";
import { folderMemberAccessSummary, inferActivationDaysForForm, inferMemberLifetime } from "../utils/folderMemberAccess";
import { dashboardBackLinkState } from "../utils/dashboardBackNavigation";
import { DashboardLayout } from "./DashboardLayout";

export function AdminCourseMembersPage() {
  const { courseId = "" } = useParams();
  const { user, ready } = useAuth();
  const { t } = useI18n();

  const [course, setCourse] = useState<Course | null>(null);
  const [courseStudents, setCourseStudents] = useState<StudentRecord[]>([]);
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
    if (!courseId) return;
    setLoading(true);
    setMessage(null);
    try {
      const [c, students] = await Promise.all([coursesService.getCourseById(courseId), coursesService.listCourseStudents(courseId)]);
      setCourse(c);
      setCourseStudents(students);
    } catch {
      setCourse(null);
      setCourseStudents([]);
      setMessage(t("web_pages.courses.members_load_failed", "تعذر تحميل طلاب الدورة."));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAddModal = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await directoryService.listAllStudents();
      setAllStudents(data);
      setStudentSearch("");
      setAddOpen(true);
    } catch {
      setAllStudents([]);
      setMessage(t("web_pages.courses.members_load_failed", "تعذر تحميل طلاب الدورة."));
    } finally {
      setBusy(false);
    }
  };

  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courseStudents;
    return courseStudents.filter((s) => {
      return (
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        s.uid.toLowerCase().includes(q)
      );
    });
  }, [courseStudents, search]);

  const visibleStudentsToAdd = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const existing = new Set(courseStudents.map((m) => m.uid));
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
  }, [allStudents, courseStudents, studentSearch]);

  const openAddActivation = (student: StudentRecord) => {
    setPendingAdd(student);
    setActivationLifetime(true);
    setActivationDays(30);
    setAddOpen(false);
  };

  const confirmAdd = async () => {
    if (!course || !pendingAdd) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await coursesService.adminAddStudentToCourse(
        course,
        {
          studentId: pendingAdd.uid,
          studentName: pendingAdd.displayName || pendingAdd.uid,
          studentEmail: pendingAdd.email,
          studentPhone: pendingAdd.phone,
          studentPhotoURL: pendingAdd.photoURL,
        },
        { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      );
      setPendingAdd(null);
      await load();
      setMessage(t("web_pages.courses.member_add_ok", "تمت إضافة الطالب للدورة."));
    } catch {
      setMessage(t("web_pages.courses.member_add_failed", "تعذر إضافة الطالب للدورة."));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (student: StudentRecord) => {
    if (!courseId) return;
    const ok = window.confirm(
      `${t("web_pages.courses.member_remove_confirm_prefix", "إزالة الطالب")}: ${student.displayName || student.uid}؟`,
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await coursesService.adminRemoveStudentFromCourse(courseId, student.uid);
      await load();
      setMessage(t("web_pages.courses.member_remove_ok", "تمت إزالة الطالب من الدورة."));
    } catch {
      setMessage(t("web_pages.courses.member_remove_failed", "تعذر إزالة الطالب من الدورة."));
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
    if (!course || !pendingEdit) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await coursesService.updateCourseStudentActivation({
        course,
        student: pendingEdit,
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      setEditOpen(false);
      setPendingEdit(null);
      await load();
      setMessage(t("web_pages.courses.member_update_period_ok", "تم تحديث مدة وصول الطالب."));
    } catch {
      setMessage(t("web_pages.courses.member_update_period_failed", "تعذر تحديث مدة الطالب."));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout role="admin" title={t("web_pages.courses.members_page_title", "إدارة طلاب الدورة")} lede={t("web_shell.dash_em", "—")}>
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const backState = dashboardBackLinkState(`/admin/course/${courseId}/members`);

  return (
    <DashboardLayout
      role="admin"
      title={course ? `${t("web_pages.courses.members_page_title", "إدارة طلاب الدورة")}: ${course.title}` : t("web_pages.courses.members_page_title", "إدارة طلاب الدورة")}
      lede={t("web_pages.courses.members_page_lede", "صفحة مستقلة لإدارة طلاب الدورة (إضافة/إزالة/تعديل مدة التفعيل) كما في التطبيق.")}
    >
      <PageToolbar>
        <Link to={`/admin/course/${courseId}/lessons`} className="ghost-btn toolbar-btn" {...backState}>
          {t("web_pages.courses.back_lessons", "← الرجوع للدروس")}
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading || busy} aria-busy={loading || busy}>
          {t("web_pages.admin_folders.refresh", "تحديث")}
        </button>
        <button type="button" className="primary-btn toolbar-btn" onClick={() => void openAddModal()} disabled={busy || loading || !course}>
          {t("web_pages.courses.addable_students", "إضافة طالب")}
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("web_pages.courses.members_search_ph", "اكتب الاسم/البريد/الجوال/المعرّف")}
          aria-label={t("web_pages.courses.members_search", "بحث عن طالب")}
        />
      </PageToolbar>

      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint />
      ) : !course ? (
        <EmptyState message={t("web_pages.courses.not_found", "الدورة غير موجودة.")} />
      ) : (
        <>
          <div className="members-modal-course-banner admin-course-lessons-banner">
            {course.imageUrl?.trim() ? (
              <CoverImage variant="thumb" src={course.imageUrl} alt={course.title} className="members-modal-course-banner__img" />
            ) : (
              <div className="modal-entity-pick__placeholder modal-entity-pick__placeholder--inline" aria-hidden>
                {(course.title || "?").trim().slice(0, 1)}
              </div>
            )}
            <div>
              <p className="post-title" style={{ margin: 0 }}>
                {course.title}
              </p>
              {course.description ? <p className="muted small">{course.description}</p> : null}
            </div>
          </div>

          <div className="grid-2 home-stats-grid">
            <StatTile title={t("web_pages.courses.current_members", "الطلاب الحاليون")} highlight={courseStudents.length} />
            <StatTile title={t("web_pages.admin_folders.stat_results", "النتائج")} highlight={visibleMembers.length} />
          </div>

          {visibleMembers.length === 0 ? (
            <EmptyState message={t("web_pages.courses.current_members_empty", "لا يوجد طلاب في هذه الدورة.")} />
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
                      <ButtonBusyLabel busy={busy}>{t("web_pages.courses.member_remove_btn", "إزالة")}</ButtonBusyLabel>
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
        title={t("web_pages.courses.addable_students", "إضافة طالب")}
        onClose={() => {
          if (!busy) setAddOpen(false);
        }}
        contentClassName="course-form-modal"
      >
        <div className="course-form-modal__form">
          <label>
            <span>{t("web_pages.courses.members_search", "بحث عن طالب")}</span>
            <input
              className="text-input"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder={t("web_pages.courses.members_search_ph", "اكتب الاسم/البريد/الجوال/المعرّف")}
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
                <span>{t("web_pages.courses.activation_lifetime", "تفعيل مدى الحياة")}</span>
              </label>
              {!activationLifetime ? (
                <label className="folder-activation-modal__days">
                  <span>{t("web_pages.courses.activation_days", "أيام التفعيل")}</span>
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
                <button type="button" className="primary-btn" onClick={() => void confirmAdd()} disabled={busy || !course}>
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
                <span>{t("web_pages.courses.activation_lifetime", "تفعيل مدى الحياة")}</span>
              </label>
              {!activationLifetime ? (
                <label className="folder-activation-modal__days">
                  <span>{t("web_pages.courses.activation_days", "أيام التفعيل")}</span>
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
                <button type="button" className="primary-btn" onClick={() => void confirmEdit()} disabled={busy || !course}>
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

