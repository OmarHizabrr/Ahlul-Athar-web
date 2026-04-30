import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppTabPanel, AppTabs, ContentList, ContentListItem, EmptyState, PageToolbar, Panel, SectionTitle, StatTile } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { coursesService } from "../services/coursesService";
import { foldersService } from "../services/foldersService";
import { myCoursesService } from "../services/myCoursesService";
import type { Course, EnrollmentRequest, Folder } from "../types";
import { DashboardLayout } from "./DashboardLayout";

type TabId = "courses" | "files";

const LAST_TAB_KEY = "ah:student-explore:lastTab";
export function StudentExplorePage() {
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  const STUDENT_ACTION_LABELS = useMemo(
    () => ({
      directEnroll: tr("تسجيل مباشر"),
      requestJoin: tr("طلب الانضمام"),
      requestJoinRetry: tr("إعادة طلب الانضمام"),
      pending: tr("الطلب قيد المراجعة"),
      open: tr("فتح"),
    }),
    [tr],
  );
  const [tab, setTab] = useState<TabId>("courses");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = useMemo(() => "student-explore", []);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [myCourseIds, setMyCourseIds] = useState<Set<string>>(() => new Set());
  const [latestCourseReqById, setLatestCourseReqById] = useState<Map<string, EnrollmentRequest>>(() => new Map());
  const [folders, setFolders] = useState<Folder[]>([]);
  const [myFolderIds, setMyFolderIds] = useState<Set<string>>(() => new Set());
  const [pendingFolderReqIds, setPendingFolderReqIds] = useState<Set<string>>(() => new Set());
  const [requestingFolderId, setRequestingFolderId] = useState<string | null>(null);
  const [requestingCourseId, setRequestingCourseId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      const [allCourses, mineCourses, allFolders, myFolders, myReqs] = await Promise.all([
        coursesService.listCoursesForRole("student"),
        myCoursesService.listForStudent(user.uid),
        foldersService.listExploreFoldersForStudent(),
        foldersService.listMyFoldersForStudent(user.uid),
        coursesService.listStudentEnrollmentRequests(user.uid),
      ]);
      setCourses(allCourses.filter((c) => c.isActive !== false));
      setMyCourseIds(new Set(mineCourses.map((c) => c.courseId)));
      const latestByCourse = new Map<string, EnrollmentRequest>();
      for (const req of myReqs) {
        if (req.requestType !== "course") continue;
        if (!latestByCourse.has(req.targetId)) {
          latestByCourse.set(req.targetId, req);
        }
      }
      setLatestCourseReqById(latestByCourse);
      const mineIds = new Set(myFolders.map((f) => f.id));
      setMyFolderIds(mineIds);
      setFolders(allFolders.filter((f) => f.isActive !== false && !mineIds.has(f.id)));
      setPendingFolderReqIds(
        new Set(myReqs.filter((r) => r.requestType === "folder" && r.status === "pending").map((r) => r.targetId)),
      );
    } catch {
      setMessage(tr("تعذر تحميل الاستكشاف. تحقق من الاتصال وصلاحيات Firestore."));
      setCourses([]);
      setMyCourseIds(new Set());
      setLatestCourseReqById(new Map());
      setFolders([]);
      setMyFolderIds(new Set());
      setPendingFolderReqIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [ready, user]);

  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl === "files" || fromUrl === "courses") {
      setTab(fromUrl);
      try {
        window.localStorage.setItem(LAST_TAB_KEY, fromUrl);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const saved = window.localStorage.getItem(LAST_TAB_KEY);
      if (saved === "files" || saved === "courses") {
        setTab(saved);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTabChange = (next: TabId) => {
    setTab(next);
    try {
      window.localStorage.setItem(LAST_TAB_KEY, next);
    } catch {
      // ignore
    }
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    navigate({ search: params.toString() }, { replace: true });
  };

  const visibleFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q));
  }, [folders, search]);

  const visibleCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [courses, search]);

  const requestCourseJoin = async (course: Course) => {
    if (!user) return;
    setRequestingCourseId(course.id);
    setMessage(null);
    try {
      await coursesService.requestEnrollment(user, course);
      setLatestCourseReqById((prev) => {
        const next = new Map(prev);
        next.set(course.id, {
          id: `pending-${course.id}`,
          studentId: user.uid,
          studentName: user.displayName ?? "",
          studentEmail: user.email ?? "",
          requestType: "course",
          targetId: course.id,
          targetName: course.title,
          status: "pending",
          reason: tr("طلب انضمام من الاستكشاف"),
        });
        return next;
      });
    } catch {
      setMessage(tr("تعذر إرسال طلب الانضمام."));
    } finally {
      setRequestingCourseId(null);
    }
  };

  const enrollPublicCourse = async (course: Course) => {
    if (!user) return;
    setRequestingCourseId(course.id);
    setMessage(null);
    try {
      await coursesService.enrollStudentInPublicCourse(user, course);
      setMyCourseIds((prev) => new Set([...prev, course.id]));
    } catch {
      setMessage(tr("تعذر التسجيل المباشر."));
    } finally {
      setRequestingCourseId(null);
    }
  };

  const enrollPublicFolder = async (folder: Folder) => {
    if (!user) return;
    setRequestingFolderId(folder.id);
    setMessage(null);
    try {
      await foldersService.addMemberToFolder({
        folder,
        member: {
          uid: user.uid,
          displayName: user.displayName ?? tr("طالب"),
          email: user.email ?? undefined,
          phone: user.phoneNumber ?? undefined,
          photoURL: user.photoURL ?? undefined,
        },
        activation: { isLifetime: true, days: 30, expiresAt: null },
      });
      setMyFolderIds((prev) => new Set([...prev, folder.id]));
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    } catch {
      setMessage(tr("تعذر التسجيل المباشر."));
    } finally {
      setRequestingFolderId(null);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout role="student" title={tr("الاستكشاف")} lede={tr("تبويب موحّد للدورات والملفات مثل التطبيق، لكن بتخطيط مناسب للويب.")}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout role="student" title={tr("الاستكشاف")} lede={tr("تبويب موحّد للدورات والملفات مثل التطبيق، لكن بتخطيط مناسب للويب.")} >
      <AppTabs
        groupId={groupId}
        ariaLabel={tr("أقسام الاستكشاف")}
        value={tab}
        onChange={(id) => onTabChange(id as TabId)}
        tabs={[
          { id: "courses", label: tr("الدورات") },
          { id: "files", label: tr("الملفات") },
        ]}
      />

      <AppTabPanel tabId="courses" groupId={groupId} hidden={tab !== "courses"} className="lesson-tab-panel">
        <Panel className="card-elevated">
          <SectionTitle as="h3">{tr("استكشاف الدورات")}</SectionTitle>
          <p className="muted small">{tr("الدورات العامة: تسجيل مباشر. الدورات الخاصة: طلب انضمام.")}</p>
          <PageToolbar>
            <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <ButtonBusyLabel busy={loading}>{tr("تحديث")}</ButtonBusyLabel>
            </button>
            <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
              {tr("مقرراتي")}
            </Link>
            <Link to="/student/enrollment-requests" className="ghost-btn toolbar-btn">
              {tr("طلباتي")}
            </Link>
            <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث في الدورات/المجلدات")} aria-label={tr("بحث في الدورات أو المجلدات")} />
          </PageToolbar>
        </Panel>
        {!loading ? (
          <div className="grid-2 home-stats-grid">
            <StatTile title={tr("الدورات المتاحة")} highlight={courses.length} />
            <StatTile title={tr("نتائج الدورات")} highlight={visibleCourses.length} />
            <StatTile title={tr("ضمن مقرراتي")} highlight={myCourseIds.size} />
          </div>
        ) : null}
        {loading ? (
          <PageLoadHint />
        ) : visibleCourses.length === 0 ? (
          <EmptyState message={search.trim() ? tr("لا توجد نتائج مطابقة للبحث.") : tr("لا توجد دورات متاحة حالياً.")} />
        ) : (
          <ContentList>
            {visibleCourses.map((course) => {
              const req = latestCourseReqById.get(course.id);
              const isEnrolled = myCourseIds.has(course.id);
              const canOpen = isEnrolled || req?.status === "approved";
              const isPublic = course.courseType !== "private";
              return (
                <ContentListItem key={course.id} className="mycourse-card">
                  <div>
                    <h3 className="post-title">{course.title}</h3>
                    <p className="muted small">{course.description || tr("—")}</p>
                    <p className="muted small">
                      {course.courseType === "private" ? tr("خاصة") : tr("عامة")} · {course.lessonCount} {tr("درس")} · {course.studentCount} {tr("طالب")}
                    </p>
                  </div>
                  <div className="course-actions">
                    {isEnrolled ? <span className="meta-pill meta-pill--ok">{tr("ضمن مقرراتي")}</span> : null}
                    {req?.status === "pending" ? <span className="meta-pill meta-pill--info">{STUDENT_ACTION_LABELS.pending}</span> : null}
                    {canOpen ? (
                      <Link to={`/student/course/${course.id}`} className="primary-btn">
                        {STUDENT_ACTION_LABELS.open}
                      </Link>
                    ) : isPublic ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => void enrollPublicCourse(course)}
                        disabled={requestingCourseId === course.id}
                        aria-busy={requestingCourseId === course.id}
                      >
                        <ButtonBusyLabel busy={requestingCourseId === course.id}>{STUDENT_ACTION_LABELS.directEnroll}</ButtonBusyLabel>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => void requestCourseJoin(course)}
                        disabled={requestingCourseId === course.id}
                        aria-busy={requestingCourseId === course.id}
                      >
                        <ButtonBusyLabel busy={requestingCourseId === course.id}>
                          {req?.status === "rejected" ? STUDENT_ACTION_LABELS.requestJoinRetry : STUDENT_ACTION_LABELS.requestJoin}
                        </ButtonBusyLabel>
                      </button>
                    )}
                  </div>
                </ContentListItem>
              );
            })}
          </ContentList>
        )}
      </AppTabPanel>

      <AppTabPanel tabId="files" groupId={groupId} hidden={tab !== "files"} className="lesson-tab-panel">
        <Panel className="card-elevated">
          <SectionTitle as="h3">{tr("استكشاف الملفات")}</SectionTitle>
          <p className="muted small">
            {tr("المجلدات العامة: تسجيل مباشر. المجلدات الخاصة: طلب انضمام.")}
          </p>
          <PageToolbar>
            <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <ButtonBusyLabel busy={loading}>{tr("تحديث")}</ButtonBusyLabel>
            </button>
            <Link to="/student/myfiles" className="ghost-btn toolbar-btn">
              {tr("ملفاتي")}
            </Link>
            <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث في المجلدات")} aria-label={tr("بحث في المجلدات")} />
          </PageToolbar>
        </Panel>

        {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
        {!loading ? (
          <div className="grid-2 home-stats-grid">
            <StatTile title={tr("المتاحة")} highlight={folders.length} />
            <StatTile title={tr("النتائج")} highlight={visibleFolders.length} />
            <StatTile title={tr("ضمن ملفاتي")} highlight={myFolderIds.size} />
          </div>
        ) : null}
        {loading ? (
          <PageLoadHint />
        ) : visibleFolders.length === 0 ? (
          <EmptyState message={tr("لا توجد مجلدات متاحة حالياً.")} />
        ) : (
          <ContentList>
            {visibleFolders.map((f) => (
              <ContentListItem key={f.id} className="folder-row">
                <div>
                  <h3 className="post-title">{f.name}</h3>
                  {f.description ? <p className="muted small">{f.description}</p> : null}
                  <p className="muted small">
                    {typeof f.fileCount === "number" ? `${f.fileCount} ${tr("ملف")}` : tr("—")} · {typeof f.memberCount === "number" ? `${f.memberCount} ${tr("عضو")}` : tr("—")} ·{" "}
                    {f.folderType === "private" ? tr("خاص") : tr("عام")}
                  </p>
                </div>
                {(f.folderType ?? "public") === "private" ? (
                  pendingFolderReqIds.has(f.id) ? (
                    <span className="meta-pill meta-pill--info">{tr("تم إرسال الطلب")}</span>
                  ) : (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() =>
                        void (async () => {
                          if (!user) return;
                          setRequestingFolderId(f.id);
                          setMessage(null);
                          try {
                            await coursesService.requestFolderEnrollment(user, f, tr("طلب انضمام لمجلد"));
                            setPendingFolderReqIds((prev) => new Set([...prev, f.id]));
                          } catch {
                            setMessage(tr("تعذر إرسال الطلب. تحقق من الصلاحيات."));
                          } finally {
                            setRequestingFolderId(null);
                          }
                        })()
                      }
                      disabled={requestingFolderId === f.id}
                      aria-busy={requestingFolderId === f.id}
                    >
                      <ButtonBusyLabel busy={requestingFolderId === f.id}>{STUDENT_ACTION_LABELS.requestJoin}</ButtonBusyLabel>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void enrollPublicFolder(f)}
                    disabled={requestingFolderId === f.id}
                    aria-busy={requestingFolderId === f.id}
                  >
                    <ButtonBusyLabel busy={requestingFolderId === f.id}>{STUDENT_ACTION_LABELS.directEnroll}</ButtonBusyLabel>
                  </button>
                )}
              </ContentListItem>
            ))}
          </ContentList>
        )}
      </AppTabPanel>
    </DashboardLayout>
  );
}

