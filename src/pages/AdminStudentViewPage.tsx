import { useEffect, useState } from "react";
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

export function AdminStudentViewPage() {
  const { tr } = useI18n();
  const { studentId } = useParams();
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [myCourses, setMyCourses] = useState<MyCourseEntry[]>([]);
  const [myFolders, setMyFolders] = useState<(Folder & { isActivated?: boolean; isLifetime?: boolean; expiresAt?: string | null })[]>([]);
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [isActivated, setIsActivated] = useState(true);

  const load = async (uid: string) => {
    setLoading(true);
    setMessage(null);
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
      setMessage(tr("تعذر تحميل بيانات الطالب."));
      setStudent(null);
      setMyCourses([]);
      setMyFolders([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!studentId) return;
    void load(studentId);
  }, [studentId]);

  const saveProfile = async () => {
    if (!studentId) return;
    setSaving(true);
    setMessage(null);
    try {
      await directoryService.updateStudentProfile(studentId, {
        displayName,
        phone,
        isActive,
        isSuspended,
        isActivated,
      });
      setMessage(tr("تم حفظ بيانات الطالب."));
      await load(studentId);
    } catch {
      setMessage(tr("تعذر حفظ بيانات الطالب."));
    } finally {
      setSaving(false);
    }
  };

  if (!studentId) {
    return (
      <DashboardLayout role="admin" title={tr("تفاصيل الطالب")} lede={tr("—")}>
        <AlertMessage kind="error">{tr("معرّف الطالب غير صالح.")}</AlertMessage>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title={student?.displayName || tr("تفاصيل الطالب")} lede={tr("إدارة بيانات الطالب وارتباطاته (دورات/مجلدات/طلبات) كما في التطبيق.")}>
      <PageToolbar>
        <Link to="/admin/students" className="ghost-btn toolbar-btn">
          {tr("← الرجوع لقائمة الطلاب")}
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load(studentId)} disabled={loading} aria-busy={loading}>
          {tr("تحديث")}
        </button>
      </PageToolbar>

      {message ? <AlertMessage kind={message.includes("تعذر") ? "error" : "success"}>{message}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint />
      ) : student == null ? (
        <EmptyState message="الطالب غير موجود." />
      ) : (
        <>
          <Panel className="card-elevated">
            <SectionTitle as="h3">{tr("بيانات الطالب")}</SectionTitle>
            <div className="form">
              <label htmlFor="student-display-name">{tr("الاسم")}</label>
              <input id="student-display-name" className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <label htmlFor="student-phone">{tr("الجوال")}</label>
              <input id="student-phone" className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="muted small">{tr("البريد")}: {student.email || tr("—")} · {tr("المعرّف")}: {student.uid}</p>
              <label className="muted small">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> {tr("نشط")}
              </label>
              <label className="muted small">
                <input type="checkbox" checked={isActivated} onChange={(e) => setIsActivated(e.target.checked)} /> {tr("مُفعّل")}
              </label>
              <label className="muted small">
                <input type="checkbox" checked={isSuspended} onChange={(e) => setIsSuspended(e.target.checked)} /> {tr("موقوف")}
              </label>
              <button type="button" className="primary-btn" onClick={() => void saveProfile()} disabled={saving} aria-busy={saving}>
                <ButtonBusyLabel busy={saving}>{tr("حفظ التعديلات")}</ButtonBusyLabel>
              </button>
            </div>
          </Panel>

          <Panel className="card-elevated">
            <SectionTitle as="h3">{tr("ملفات الطالب ومجلداته")} ({myFolders.length})</SectionTitle>
            {myFolders.length === 0 ? (
              <EmptyState message={tr("لا توجد مجلدات مرتبطة.")} />
            ) : (
              <ContentList>
                {myFolders.map((f) => (
                  <ContentListItem key={f.id} className="file-row">
                    <div>
                      <h3 className="post-title">{f.name}</h3>
                      <p className="muted small">
                        {f.folderType === "private" ? tr("خاص") : tr("عام")} · {f.isActivated === false ? tr("غير مُفعّل") : tr("مُفعّل")}
                      </p>
                    </div>
                    <div className="course-actions">
                      <Link className="ghost-btn toolbar-btn" to={`/admin/folder/${f.id}`}>
                        {tr("فتح المجلد")}
                      </Link>
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </Panel>

          <Panel className="card-elevated">
            <SectionTitle as="h3">{tr("ارتباطات الدورات")} ({myCourses.length})</SectionTitle>
            {myCourses.length === 0 ? (
              <EmptyState message={tr("لا توجد دورات مرتبطة.")} />
            ) : (
              <ContentList>
                {myCourses.map((c) => (
                  <ContentListItem key={c.courseId} className="file-row">
                    <div>
                      <h3 className="post-title">{c.courseTitle || c.courseId}</h3>
                      <p className="muted small">{c.courseDescription || tr("—")}</p>
                    </div>
                    <div className="course-actions">
                      <Link className="ghost-btn toolbar-btn" to={`/admin/course/${c.courseId}/lessons`}>
                        {tr("فتح الدروس")}
                      </Link>
                      <Link className="ghost-btn toolbar-btn" to={`/admin/preview/course/${c.courseId}`}>
                        {tr("معاينة كطالب")}
                      </Link>
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </Panel>

          <Panel className="card-elevated">
            <SectionTitle as="h3">{tr("طلبات الالتحاق")} ({requests.length})</SectionTitle>
            {requests.length === 0 ? (
              <EmptyState message={tr("لا توجد طلبات لهذا الطالب.")} />
            ) : (
              <ContentList>
                {requests.map((r) => (
                  <ContentListItem key={r.id} className="file-row">
                    <div>
                      <h3 className="post-title">{r.targetName}</h3>
                      <p className="muted small">
                        {tr("النوع")}: {r.requestType === "folder" ? tr("مجلد") : tr("دورة")} · {tr("الحالة")}: {tr(r.status)}
                      </p>
                    </div>
                    <div className="course-actions">
                      {r.requestType === "folder" ? (
                        <Link className="ghost-btn toolbar-btn" to={`/admin/folder/${r.targetId}`}>
                          {tr("فتح الهدف")}
                        </Link>
                      ) : (
                        <Link className="ghost-btn toolbar-btn" to={`/admin/course/${r.targetId}/lessons`}>
                          {tr("فتح الهدف")}
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
