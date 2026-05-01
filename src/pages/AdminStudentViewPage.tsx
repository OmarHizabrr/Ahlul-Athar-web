import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, ContentList, ContentListItem, EmptyState, PageToolbar, Panel, SectionTitle } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import { myCoursesService } from "../services/myCoursesService";
import { foldersService } from "../services/foldersService";
import { coursesService } from "../services/coursesService";
import type { EnrollmentRequest, Folder, MyCourseEntry, StudentRecord } from "../types";
import { requestStatusLabel } from "./course/EnrollmentRequestHelpers";

const V = "web_pages.admin_student_view" as const;

type Flash = { text: string; kind: "success" | "error" } | null;

export function AdminStudentViewPage() {
  const { t } = useI18n();
  const { studentId } = useParams();
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [myCourses, setMyCourses] = useState<MyCourseEntry[]>([]);
  const [myFolders, setMyFolders] = useState<(Folder & { isActivated?: boolean; isLifetime?: boolean; expiresAt?: string | null })[]>([]);
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [isActivated, setIsActivated] = useState(true);

  const load = useCallback(
    async (uid: string) => {
      setLoading(true);
      setFlash(null);
      try {
        const [s, c, f, r] = await Promise.all([
          directoryService.getStudentById(uid),
          myCoursesService.listForStudent(uid),
          foldersService.listMyFoldersForStudent(uid),
          coursesService.listStudentEnrollmentRequests(uid),
        ]);
        setStudent(s);
        setMyCourses(c);
        setMyFolders(f);
        setRequests(r);
        setDisplayName(s?.displayName ?? "");
        setPhone(s?.phone ?? "");
        setIsActive(s?.isActive !== false);
        setIsSuspended(Boolean(s?.isSuspended));
        setIsActivated(s?.isActivated !== false);
      } catch {
        setFlash({ text: t(`${V}.load_failed`, "تعذر تحميل بيانات الطالب."), kind: "error" });
        setStudent(null);
        setMyCourses([]);
        setMyFolders([]);
        setRequests([]);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!studentId) return;
    void load(studentId);
  }, [studentId, load]);

  const saveProfile = async () => {
    if (!studentId) return;
    setSaving(true);
    setFlash(null);
    try {
      await directoryService.updateStudentProfile(studentId, {
        displayName,
        phone,
        isActive,
        isSuspended,
        isActivated,
      });
      setFlash({ text: t(`${V}.save_ok`, "تم حفظ بيانات الطالب."), kind: "success" });
      await load(studentId);
    } catch {
      setFlash({ text: t(`${V}.save_failed`, "تعذر حفظ بيانات الطالب."), kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  const dash = t("web_shell.dash_em", "—");

  if (!studentId) {
    return (
      <DashboardLayout role="admin" title={t(`${V}.title`, "تفاصيل الطالب")} lede={dash}>
        <AlertMessage kind="error">{t(`${V}.invalid_id`, "معرّف الطالب غير صالح.")}</AlertMessage>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="admin"
      title={student?.displayName || t(`${V}.title`, "تفاصيل الطالب")}
      lede={t(`${V}.lede`, "إدارة بيانات الطالب وارتباطاته (دورات/مجلدات/طلبات) كما في التطبيق.")}
    >
      <PageToolbar>
        <Link to="/admin/students" className="ghost-btn toolbar-btn">
          {t(`${V}.back_list`, "← الرجوع لقائمة الطلاب")}
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load(studentId)} disabled={loading} aria-busy={loading}>
          {t(`${V}.refresh`, "تحديث")}
        </button>
      </PageToolbar>

      {flash ? <AlertMessage kind={flash.kind}>{flash.text}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint />
      ) : student == null ? (
        <EmptyState message={t(`${V}.student_not_found`, "الطالب غير موجود.")} />
      ) : (
        <>
          <Panel className="card-elevated">
            <SectionTitle as="h3">{t(`${V}.panel_profile`, "بيانات الطالب")}</SectionTitle>
            <div className="form">
              <label htmlFor="student-display-name">{t(`${V}.label_name`, "الاسم")}</label>
              <input id="student-display-name" className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <label htmlFor="student-phone">{t(`${V}.label_phone`, "الجوال")}</label>
              <input id="student-phone" className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="muted small">
                {t(`${V}.email`, "البريد")}: {student.email || dash} · {t(`${V}.uid`, "المعرّف")}: {student.uid}
              </p>
              <label className="muted small">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> {t(`${V}.flag_active`, "نشط")}
              </label>
              <label className="muted small">
                <input type="checkbox" checked={isActivated} onChange={(e) => setIsActivated(e.target.checked)} />{" "}
                {t(`${V}.flag_activated`, "مُفعّل")}
              </label>
              <label className="muted small">
                <input type="checkbox" checked={isSuspended} onChange={(e) => setIsSuspended(e.target.checked)} />{" "}
                {t(`${V}.flag_suspended`, "موقوف")}
              </label>
              <button type="button" className="primary-btn" onClick={() => void saveProfile()} disabled={saving} aria-busy={saving}>
                <ButtonBusyLabel busy={saving}>{t(`${V}.save_btn`, "حفظ التعديلات")}</ButtonBusyLabel>
              </button>
            </div>
          </Panel>

          <Panel className="card-elevated">
            <SectionTitle as="h3">
              {t(`${V}.folders_heading`, "ملفات الطالب ومجلداته")} ({myFolders.length})
            </SectionTitle>
            {myFolders.length === 0 ? (
              <EmptyState message={t(`${V}.folders_empty`, "لا توجد مجلدات مرتبطة.")} />
            ) : (
              <ContentList>
                {myFolders.map((f) => (
                  <ContentListItem key={f.id} className="file-row">
                    <div>
                      <h3 className="post-title">{f.name}</h3>
                      <p className="muted small">
                        {f.folderType === "private"
                          ? t(`${V}.folder_private`, "خاص")
                          : t(`${V}.folder_public`, "عام")}{" "}
                        ·{" "}
                        {f.isActivated === false ? t(`${V}.folder_off`, "غير مُفعّل") : t(`${V}.folder_on`, "مُفعّل")}
                      </p>
                    </div>
                    <div className="course-actions">
                      <Link className="ghost-btn toolbar-btn" to={`/admin/folder/${f.id}`}>
                        {t(`${V}.open_folder`, "فتح المجلد")}
                      </Link>
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </Panel>

          <Panel className="card-elevated">
            <SectionTitle as="h3">
              {t(`${V}.courses_heading`, "ارتباطات الدورات")} ({myCourses.length})
            </SectionTitle>
            {myCourses.length === 0 ? (
              <EmptyState message={t(`${V}.courses_empty`, "لا توجد دورات مرتبطة.")} />
            ) : (
              <ContentList>
                {myCourses.map((c) => (
                  <ContentListItem key={c.courseId} className="file-row">
                    <div>
                      <h3 className="post-title">{c.courseTitle || c.courseId}</h3>
                      <p className="muted small">{c.courseDescription || dash}</p>
                    </div>
                    <div className="course-actions">
                      <Link className="ghost-btn toolbar-btn" to={`/admin/course/${c.courseId}/lessons`}>
                        {t(`${V}.open_lessons`, "فتح الدروس")}
                      </Link>
                      <Link className="ghost-btn toolbar-btn" to={`/admin/preview/course/${c.courseId}`}>
                        {t(`${V}.preview_student`, "معاينة كطالب")}
                      </Link>
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </Panel>

          <Panel className="card-elevated">
            <SectionTitle as="h3">
              {t(`${V}.requests_heading`, "طلبات الالتحاق")} ({requests.length})
            </SectionTitle>
            {requests.length === 0 ? (
              <EmptyState message={t(`${V}.requests_empty`, "لا توجد طلبات لهذا الطالب.")} />
            ) : (
              <ContentList>
                {requests.map((r) => (
                  <ContentListItem key={r.id} className="file-row">
                    <div>
                      <h3 className="post-title">{r.targetName}</h3>
                      <p className="muted small">
                        {t(`${V}.type`, "النوع")}: {r.requestType === "folder" ? t(`${V}.type_folder`, "مجلد") : t(`${V}.type_course`, "دورة")} ·{" "}
                        {t(`${V}.status`, "الحالة")}: {requestStatusLabel(r.status, t)}
                      </p>
                    </div>
                    <div className="course-actions">
                      {r.requestType === "folder" ? (
                        <Link className="ghost-btn toolbar-btn" to={`/admin/folder/${r.targetId}`}>
                          {t(`${V}.open_target`, "فتح الهدف")}
                        </Link>
                      ) : (
                        <Link className="ghost-btn toolbar-btn" to={`/admin/course/${r.targetId}/lessons`}>
                          {t(`${V}.open_target`, "فتح الهدف")}
                        </Link>
                      )}
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </Panel>
        </>
      )}
    </DashboardLayout>
  );
}
