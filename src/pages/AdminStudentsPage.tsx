import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppModal, Avatar, ContentList, ContentListItem, EmptyState, PageToolbar, StatTile } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import { myCoursesService } from "../services/myCoursesService";
import { coursesService } from "../services/coursesService";
import { foldersService } from "../services/foldersService";
import type { Course, Folder, MyCourseEntry, StudentRecord } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";

const S = "web_pages.admin_students" as const;
type TFn = (key: string, fallback?: string) => string;

function statusPill(student: StudentRecord, t: TFn) {
  if (student.isSuspended) {
    return { text: t(`${S}.pill_suspended`, "موقوف"), cls: "meta-pill meta-pill--warn" };
  }
  if (student.isActivated === false) {
    return { text: t(`${S}.pill_not_activated`, "غير مُفعّل"), cls: "meta-pill meta-pill--muted" };
  }
  if (student.isActive === false) {
    return { text: t(`${S}.pill_inactive`, "غير نشط"), cls: "meta-pill meta-pill--muted" };
  }
  return { text: t(`${S}.pill_active`, "نشط"), cls: "meta-pill meta-pill--ok" };
}

export function AdminStudentsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "suspended" | "notActivated">("all");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quickLinkOpen, setQuickLinkOpen] = useState(false);
  const [quickLinkMode, setQuickLinkMode] = useState<"course" | "folder">("course");
  const [quickStudent, setQuickStudent] = useState<StudentRecord | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [targetId, setTargetId] = useState("");
  const [activationLifetime, setActivationLifetime] = useState(true);
  const [activationDays, setActivationDays] = useState(30);
  const [quickUnlinkOpen, setQuickUnlinkOpen] = useState(false);
  const [unlinkStudent, setUnlinkStudent] = useState<StudentRecord | null>(null);
  const [unlinkCourses, setUnlinkCourses] = useState<MyCourseEntry[]>([]);
  const [unlinkFolders, setUnlinkFolders] = useState<
    (Folder & {
      isActivated?: boolean;
      isLifetime?: boolean;
      expiresAt?: string | null;
      joinedAt?: unknown;
      linkedByName?: string;
      linkedAt?: unknown;
    })[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await directoryService.listStudents();
      setRows(data);
    } catch {
      setMessage(t(`${S}.load_failed`, "تعذر تحميل قائمة الطلاب. تحقق من صلاحيات Firestore."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let out = rows;
    if (filter !== "all") {
      out = out.filter((s) => {
        if (filter === "suspended") return Boolean(s.isSuspended);
        if (filter === "notActivated") return s.isActivated === false;
        if (filter === "inactive") return s.isActive === false;
        return s.isActive !== false && !s.isSuspended;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((s) => {
        const name = (s.displayName ?? "").toLowerCase();
        const email = (s.email ?? "").toLowerCase();
        const phone = (s.phone ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || s.uid.toLowerCase().includes(q);
      });
    }
    out = out.slice().sort((a, b) => {
      if (sortBy === "date") {
        const ad = Number((a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0);
        const bd = Number((b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0);
        return sortDir === "asc" ? ad - bd : bd - ad;
      }
      const cmp = String(a.displayName ?? "").localeCompare(String(b.displayName ?? ""), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, search, filter, sortBy, sortDir]);

  const patchFlags = async (uid: string, flags: { isActive?: boolean; isSuspended?: boolean; isActivated?: boolean }) => {
    setBusyId(uid);
    setMessage(null);
    try {
      await directoryService.setStudentFlags(uid, flags);
      await load();
    } catch {
      setMessage(t(`${S}.patch_failed`, "تعذر تحديث حالة الطالب."));
    } finally {
      setBusyId(null);
    }
  };

  const openQuickLinkModal = async (student: StudentRecord, mode: "course" | "folder") => {
    setBusyId(student.uid);
    setMessage(null);
    try {
      if (mode === "course") {
        const allCourses = await coursesService.listCoursesForRole("admin");
        setCourses(allCourses);
        setFolders([]);
      } else {
        const allFolders = await foldersService.listFoldersForAdmin();
        setFolders(allFolders);
        setCourses([]);
      }
      setQuickStudent(student);
      setQuickLinkMode(mode);
      setTargetId("");
      setActivationLifetime(true);
      setActivationDays(30);
      setQuickLinkOpen(true);
    } catch {
      setMessage(
        mode === "course"
          ? t(`${S}.load_courses_failed`, "تعذر تحميل الدورات.")
          : t(`${S}.load_folders_failed`, "تعذر تحميل المجلدات."),
      );
    } finally {
      setBusyId(null);
    }
  };

  const submitQuickLink = async () => {
    if (!quickStudent || !targetId) return;
    setBusyId(quickStudent.uid);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      if (quickLinkMode === "course") {
        const course = courses.find((c) => c.id === targetId);
        if (!course) return;
        await coursesService.adminAddStudentToCourse(
          course,
          {
            studentId: quickStudent.uid,
            studentName: quickStudent.displayName || quickStudent.uid,
            studentEmail: quickStudent.email,
            studentPhone: quickStudent.phone,
            studentPhotoURL: quickStudent.photoURL,
          },
          { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
        );
        setMessage(t(`${S}.link_course_ok`, "تم ربط الطالب بالدورة."));
      } else {
        const folder = folders.find((f) => f.id === targetId);
        if (!folder) return;
        await foldersService.addMemberToFolder({
          folder,
          member: quickStudent,
          activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
        });
        setMessage(t(`${S}.link_folder_ok`, "تم ربط الطالب بالمجلد."));
      }
      setQuickLinkOpen(false);
    } catch {
      setMessage(
        quickLinkMode === "course"
          ? t(`${S}.link_course_failed`, "تعذر ربط الطالب بالدورة.")
          : t(`${S}.link_folder_failed`, "تعذر ربط الطالب بالمجلد."),
      );
    } finally {
      setBusyId(quickStudent.uid);
      setBusyId(null);
    }
  };

  const openQuickUnlinkModal = async (student: StudentRecord) => {
    setBusyId(student.uid);
    setMessage(null);
    try {
      const [mineCourses, mineFolders] = await Promise.all([
        myCoursesService.listForStudent(student.uid),
        foldersService.listMyFoldersForStudent(student.uid),
      ]);
      setUnlinkStudent(student);
      setUnlinkCourses(mineCourses);
      setUnlinkFolders(mineFolders);
      setQuickUnlinkOpen(true);
    } catch {
      setMessage(t(`${S}.unlink_load_failed`, "تعذر تحميل ارتباطات الطالب الحالية."));
    } finally {
      setBusyId(null);
    }
  };

  const unlinkFromCourse = async (courseId: string, courseTitle: string) => {
    if (!unlinkStudent) return;
    const ok = window.confirm(`${t(`${S}.unlink_course_confirm`, "إزالة من الدورة")}: ${courseTitle}؟`);
    if (!ok) return;
    setBusyId(unlinkStudent.uid);
    setMessage(null);
    try {
      await coursesService.adminRemoveStudentFromCourse(courseId, unlinkStudent.uid);
      setUnlinkCourses((prev) => prev.filter((c) => c.courseId !== courseId));
      setMessage(t(`${S}.unlink_course_ok`, "تمت إزالة الطالب من الدورة."));
    } catch {
      setMessage(t(`${S}.unlink_course_failed`, "تعذر إزالة الطالب من الدورة."));
    } finally {
      setBusyId(null);
    }
  };

  const unlinkFromFolder = async (folderId: string, folderName: string) => {
    if (!unlinkStudent) return;
    const ok = window.confirm(`${t(`${S}.unlink_folder_confirm`, "إزالة من المجلد")}: ${folderName}؟`);
    if (!ok) return;
    setBusyId(unlinkStudent.uid);
    setMessage(null);
    try {
      await foldersService.removeMemberFromFolder(folderId, unlinkStudent.uid);
      setUnlinkFolders((prev) => prev.filter((f) => f.id !== folderId));
      setMessage(t(`${S}.unlink_folder_ok`, "تمت إزالة الطالب من المجلد."));
    } catch {
      setMessage(t(`${S}.unlink_folder_failed`, "تعذر إزالة الطالب من المجلد."));
    } finally {
      setBusyId(null);
    }
  };

  const dash = t("web_shell.dash_em", "—");

  return (
    <DashboardLayout
      role="admin"
      title={t(`${S}.title`, "الطلاب")}
      lede={t(`${S}.lede`, "قائمة الطلاب مع بحث وفلتر حالة — مكافئ لتبويب «الطلاب» في التطبيق.")}
    >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {t(`${S}.refresh`, "تحديث")}
        </button>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label={t(`${S}.filter_aria`, "فلتر حالة الطالب")}>
          <option value="all">{t(`${S}.filter_all`, "كل الحالات")}</option>
          <option value="active">{t(`${S}.filter_active`, "النشطون")}</option>
          <option value="inactive">{t(`${S}.filter_inactive`, "غير نشط")}</option>
          <option value="suspended">{t(`${S}.filter_suspended`, "موقوف")}</option>
          <option value="notActivated">{t(`${S}.filter_not_activated`, "غير مُفعّل")}</option>
        </select>
        <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label={t(`${S}.sort_aria`, "ترتيب الطلاب")}>
          <option value="name">{t(`${S}.sort_name`, "ترتيب: الاسم")}</option>
          <option value="date">{t(`${S}.sort_date`, "ترتيب: الأحدث")}</option>
        </select>
        <select className="select" value={sortDir} onChange={(e) => setSortDir(e.target.value as typeof sortDir)} aria-label={t(`${S}.sort_dir_aria`, "اتجاه الترتيب")}>
          <option value="asc">{t(`${S}.sort_asc`, "تصاعدي")}</option>
          <option value="desc">{t(`${S}.sort_desc`, "تنازلي")}</option>
        </select>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(`${S}.search_ph`, "بحث بالاسم/البريد/الجوال/المعرّف")}
          aria-label={t(`${S}.search_aria`, "بحث في الطلاب")}
        />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t(`${S}.stat_total`, "الإجمالي")} highlight={rows.length} />
          <StatTile title={t(`${S}.stat_results`, "النتائج")} highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message={t(`${S}.empty`, "لا توجد نتائج مطابقة.")} />
      ) : (
        <ContentList>
          {visible.map((s) => {
            const pill = statusPill(s, t);
            return (
              <ContentListItem key={s.uid} className="user-row">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                  <Avatar
                    photoURL={s.photoURL}
                    displayName={s.displayName}
                    email={s.email}
                    alt={s.displayName || t(`${S}.avatar_alt`, "طالب")}
                    imageClassName="user-avatar topbar-avatar"
                    fallbackClassName="user-avatar-fallback topbar-avatar"
                    size={40}
                  />
                  <div style={{ minWidth: 0 }}>
                    <h3 className="post-title">{s.displayName || s.uid}</h3>
                    <p className="muted small">
                      {s.email || dash} {s.phone ? `· ${s.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="course-actions">
                  <span className={pill.cls}>{pill.text}</span>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void patchFlags(s.uid, { isSuspended: !Boolean(s.isSuspended), isActive: true })}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>
                      {s.isSuspended ? t(`${S}.unsuspend`, "رفع الإيقاف") : t(`${S}.suspend`, "إيقاف")}
                    </ButtonBusyLabel>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void patchFlags(s.uid, { isActivated: s.isActivated === false })}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>
                      {s.isActivated === false ? t(`${S}.btn_activate`, "تفعيل") : t(`${S}.btn_deactivate`, "تعطيل")}
                    </ButtonBusyLabel>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void openQuickLinkModal(s, "course")}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>{t(`${S}.link_course_btn`, "إلحاق بدورة")}</ButtonBusyLabel>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void openQuickLinkModal(s, "folder")}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>{t(`${S}.link_folder_btn`, "إلحاق بمجلد")}</ButtonBusyLabel>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void openQuickUnlinkModal(s)}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>{t(`${S}.unlink_btn`, "فك الارتباط")}</ButtonBusyLabel>
                  </button>
                  <Link className="ghost-btn toolbar-btn" to={`/admin/student/${s.uid}`}>
                    {t(`${S}.open_profile`, "فتح الملف")}
                  </Link>
                </div>
              </ContentListItem>
            );
          })}
        </ContentList>
      )}
      <AppModal
        open={quickLinkOpen}
        title={
          quickLinkMode === "course"
            ? t(`${S}.link_course_modal_title`, "إلحاق الطالب بدورة")
            : t(`${S}.link_folder_modal_title`, "إلحاق الطالب بمجلد")
        }
        onClose={() => {
          if (!busyId) setQuickLinkOpen(false);
        }}
      >
        <div className="course-form-modal__form">
          <p className="muted small">
            {t(`${S}.selected_student`, "الطالب")}: <strong>{quickStudent?.displayName || quickStudent?.uid || dash}</strong>
          </p>
          <label>
            <span>{quickLinkMode === "course" ? t(`${S}.select_course`, "اختر دورة") : t(`${S}.select_folder`, "اختر مجلد")}</span>
            <select className="text-input" value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={Boolean(busyId)}>
              <option value="">{t(`${S}.select_target_ph`, "— اختر —")}</option>
              {quickLinkMode === "course"
                ? courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))
                : folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
            </select>
          </label>
          <label className="muted small">
            <input type="checkbox" checked={activationLifetime} onChange={(e) => setActivationLifetime(e.target.checked)} />{" "}
            {t(`${S}.activation_lifetime`, "تفعيل مدى الحياة")}
          </label>
          {!activationLifetime ? (
            <label>
              <span>{t(`${S}.activation_days`, "عدد الأيام")}</span>
              <input
                className="text-input"
                type="number"
                min={1}
                value={activationDays}
                onChange={(e) => setActivationDays(Number(e.target.value || 30))}
              />
            </label>
          ) : null}
          <div className="course-actions">
            <button type="button" className="ghost-btn" onClick={() => setQuickLinkOpen(false)} disabled={Boolean(busyId)}>
              {t(`${S}.cancel`, "إلغاء")}
            </button>
            <button type="button" className="primary-btn" onClick={() => void submitQuickLink()} disabled={Boolean(busyId) || !targetId}>
              <ButtonBusyLabel busy={Boolean(busyId)}>{t(`${S}.confirm_link`, "تأكيد الربط")}</ButtonBusyLabel>
            </button>
          </div>
        </div>
      </AppModal>
      <AppModal
        open={quickUnlinkOpen}
        title={t(`${S}.unlink_modal_title`, "فك ارتباطات الطالب")}
        onClose={() => {
          if (!busyId) setQuickUnlinkOpen(false);
        }}
      >
        <div className="course-form-modal__form">
          <p className="muted small">
            {t(`${S}.selected_student`, "الطالب")}: <strong>{unlinkStudent?.displayName || unlinkStudent?.uid || dash}</strong>
          </p>
          <h4>{t(`${S}.unlink_courses_title`, "الدورات المرتبط بها")}</h4>
          {unlinkCourses.length === 0 ? (
            <p className="muted small">{t(`${S}.unlink_courses_empty`, "لا توجد دورات مرتبطة.")}</p>
          ) : (
            <ContentList>
              {unlinkCourses.map((c) => (
                <ContentListItem key={c.courseId} className="user-row">
                  <div>
                    <h4 className="post-title">{c.courseTitle || c.courseId}</h4>
                    <p className="muted small">
                      {c.courseDescription || dash}
                      {c.enrolledAt != null
                        ? ` · ${t(`${S}.linked_at`, "تاريخ الربط")}: ${formatFirestoreTime(c.enrolledAt)}`
                        : ""}
                      {c.linkedByName ? ` · ${t(`${S}.linked_by`, "بواسطة")}: ${c.linkedByName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => void unlinkFromCourse(c.courseId, c.courseTitle || c.courseId)}
                    disabled={Boolean(busyId)}
                  >
                    <ButtonBusyLabel busy={Boolean(busyId)}>{t(`${S}.unlink_course_btn`, "إزالة من الدورة")}</ButtonBusyLabel>
                  </button>
                </ContentListItem>
              ))}
            </ContentList>
          )}

          <h4>{t(`${S}.unlink_folders_title`, "المجلدات المرتبط بها")}</h4>
          {unlinkFolders.length === 0 ? (
            <p className="muted small">{t(`${S}.unlink_folders_empty`, "لا توجد مجلدات مرتبطة.")}</p>
          ) : (
            <ContentList>
              {unlinkFolders.map((f) => (
                <ContentListItem key={f.id} className="user-row">
                  <div>
                    <h4 className="post-title">{f.name || f.id}</h4>
                    <p className="muted small">
                      {f.description || dash}
                      {f.joinedAt != null
                        ? ` · ${t(`${S}.linked_at`, "تاريخ الربط")}: ${formatFirestoreTime(f.joinedAt)}`
                        : ""}
                      {f.linkedByName ? ` · ${t(`${S}.linked_by`, "بواسطة")}: ${f.linkedByName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => void unlinkFromFolder(f.id, f.name || f.id)}
                    disabled={Boolean(busyId)}
                  >
                    <ButtonBusyLabel busy={Boolean(busyId)}>{t(`${S}.unlink_folder_btn`, "إزالة من المجلد")}</ButtonBusyLabel>
                  </button>
                </ContentListItem>
              ))}
            </ContentList>
          )}
        </div>
      </AppModal>
    </DashboardLayout>
  );
}
