import { useCallback, useEffect, useMemo, useState } from "react";
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
  const { t } = useI18n();
  const STUDENT_ACTION_LABELS = useMemo(
    () => ({
      directEnroll: t("web_pages.student_course_actions.direct_enroll", "تسجيل مباشر"),
      requestJoin: t("web_pages.student_course_actions.request_join", "طلب الانضمام"),
      requestJoinRetry: t("web_pages.student_course_actions.request_join_retry", "إعادة طلب الانضمام"),
      pending: t("web_pages.student_course_actions.pending", "الطلب قيد المراجعة"),
      open: t("web_pages.student_course_actions.open", "فتح"),
    }),
    [t],
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

  const load = useCallback(async () => {
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
      setMessage(t("web_pages.student_explore.load_failed", "تعذر تحميل الاستكشاف. تحقق من الاتصال وصلاحيات Firestore."));
      setCourses([]);
      setMyCourseIds(new Set());
      setLatestCourseReqById(new Map());
      setFolders([]);
      setMyFolderIds(new Set());
      setPendingFolderReqIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [ready, user, load]);

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
          reason: t("web_pages.student_explore.reason_course", "طلب انضمام من الاستكشاف"),
        });
        return next;
      });
    } catch {
      setMessage(t("web_pages.student_explore.request_join_failed", "تعذر إرسال طلب الانضمام."));
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
      setMessage(t("web_pages.student_explore.enroll_failed", "تعذر التسجيل المباشر."));
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
          displayName: user.displayName ?? t("web_pages.student_explore.student_fallback_name", "طالب"),
          email: user.email ?? undefined,
          phone: user.phoneNumber ?? undefined,
          photoURL: user.photoURL ?? undefined,
        },
        activation: { isLifetime: true, days: 30, expiresAt: null },
      });
      setMyFolderIds((prev) => new Set([...prev, folder.id]));
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    } catch {
      setMessage(t("web_pages.student_explore.enroll_failed", "تعذر التسجيل المباشر."));
    } finally {
      setRequestingFolderId(null);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout
        role="student"
        title={t("web_pages.nav.explore", "الاستكشاف")}
        lede={t("web_pages.student_explore.lede", "تبويب موحّد للدورات والملفات مثل التطبيق، لكن بتخطيط مناسب للويب.")}
      >
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role="student"
      title={t("web_pages.nav.explore", "الاستكشاف")}
      lede={t("web_pages.student_explore.lede", "تبويب موحّد للدورات والملفات مثل التطبيق، لكن بتخطيط مناسب للويب.")}
    >
      <AppTabs
        groupId={groupId}
        ariaLabel={t("web_pages.student_explore.tabs_aria", "أقسام الاستكشاف")}
        value={tab}
        onChange={(id) => onTabChange(id as TabId)}
        tabs={[
          { id: "courses", label: t("web_pages.nav.courses", "الدورات") },
          { id: "files", label: t("web_pages.student_explore.tab_files", "الملفات") },
        ]}
      />

      <AppTabPanel tabId="courses" groupId={groupId} hidden={tab !== "courses"} className="lesson-tab-panel">
        <Panel className="card-elevated">
          <SectionTitle as="h3">{t("web_pages.student_explore.section_courses", "استكشاف الدورات")}</SectionTitle>
          <p className="muted small">{t("web_pages.student_explore.courses_hint", "الدورات العامة: تسجيل مباشر. الدورات الخاصة: طلب انضمام.")}</p>
          <PageToolbar>
            <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <ButtonBusyLabel busy={loading}>{t("web_pages.student_explore.refresh", "تحديث")}</ButtonBusyLabel>
            </button>
            <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
              {t("web_pages.nav.my_courses", "مقرراتي")}
            </Link>
            <Link to="/student/enrollment-requests" className="ghost-btn toolbar-btn">
              {t("web_pages.nav.my_requests", "طلباتي")}
            </Link>
            <input
              className="text-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("web_pages.student_explore.search_courses_folders_ph", "بحث في الدورات/المجلدات")}
              aria-label={t("web_pages.student_explore.search_courses_folders_aria", "بحث في الدورات أو المجلدات")}
            />
          </PageToolbar>
        </Panel>
        {!loading ? (
          <div className="grid-2 home-stats-grid">
            <StatTile title={t("web_pages.student_explore.stat_courses_available", "الدورات المتاحة")} highlight={courses.length} />
            <StatTile title={t("web_pages.student_explore.stat_course_results", "نتائج الدورات")} highlight={visibleCourses.length} />
            <StatTile title={t("web_pages.student_explore.stat_in_my_courses", "ضمن مقرراتي")} highlight={myCourseIds.size} />
          </div>
        ) : null}
        {loading ? (
          <PageLoadHint />
        ) : visibleCourses.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? t("web_pages.student_explore.empty_course_search", "لا توجد نتائج مطابقة للبحث.")
                : t("web_pages.student_explore.empty_no_courses", "لا توجد دورات متاحة حالياً.")
            }
          />
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
                    <p className="muted small">{course.description || t("web_shell.dash_em", "—")}</p>
                    <p className="muted small">
                      {course.courseType === "private"
                        ? t("web_pages.student_explore.type_private_f", "خاصة")
                        : t("web_pages.student_explore.type_public_f", "عامة")}{" "}
                      · {course.lessonCount} {t("web_pages.student_explore.lesson_word", "درس")} · {course.studentCount}{" "}
                      {t("web_pages.student_explore.student_word", "طالب")}
                    </p>
                  </div>
                  <div className="course-actions">
                    {isEnrolled ? (
                      <span className="meta-pill meta-pill--ok">
                        {t("web_pages.student_explore.stat_in_my_courses", "ضمن مقرراتي")}
                      </span>
                    ) : null}
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
          <SectionTitle as="h3">{t("web_pages.student_explore.section_files", "استكشاف الملفات")}</SectionTitle>
          <p className="muted small">{t("web_pages.student_explore.files_hint", "المجلدات العامة: تسجيل مباشر. المجلدات الخاصة: طلب انضمام.")}</p>
          <PageToolbar>
            <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <ButtonBusyLabel busy={loading}>{t("web_pages.student_explore.refresh", "تحديث")}</ButtonBusyLabel>
            </button>
            <Link to="/student/myfiles" className="ghost-btn toolbar-btn">
              {t("web_pages.nav.my_files", "ملفاتي")}
            </Link>
            <input
              className="text-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("web_pages.student_myfiles.search_ph", "بحث في المجلدات")}
              aria-label={t("web_pages.student_myfiles.search_ph", "بحث في المجلدات")}
            />
          </PageToolbar>
        </Panel>

        {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
        {!loading ? (
          <div className="grid-2 home-stats-grid">
            <StatTile title={t("web_pages.student_explore.stat_folders_available", "المتاحة")} highlight={folders.length} />
            <StatTile title={t("web_pages.student_explore.stat_folder_results", "النتائج")} highlight={visibleFolders.length} />
            <StatTile title={t("web_pages.student_explore.stat_in_my_files", "ضمن ملفاتي")} highlight={myFolderIds.size} />
          </div>
        ) : null}
        {loading ? (
          <PageLoadHint />
        ) : visibleFolders.length === 0 ? (
          <EmptyState message={t("web_pages.student_explore.empty_no_folders", "لا توجد مجلدات متاحة حالياً.")} />
        ) : (
          <ContentList>
            {visibleFolders.map((f) => (
              <ContentListItem key={f.id} className="folder-row">
                <div>
                  <h3 className="post-title">{f.name}</h3>
                  {f.description ? <p className="muted small">{f.description}</p> : null}
                  <p className="muted small">
                    {typeof f.fileCount === "number"
                      ? `${f.fileCount} ${t("web_pages.student_explore.file_word", "ملف")}`
                      : t("web_shell.dash_em", "—")}{" "}
                    ·{" "}
                    {typeof f.memberCount === "number"
                      ? `${f.memberCount} ${t("web_pages.student_explore.member_word", "عضو")}`
                      : t("web_shell.dash_em", "—")}{" "}
                    ·{" "}
                    {f.folderType === "private"
                      ? t("web_pages.student_explore.type_private", "خاص")
                      : t("web_pages.student_explore.type_public", "عام")}
                  </p>
                </div>
                {(f.folderType ?? "public") === "private" ? (
                  pendingFolderReqIds.has(f.id) ? (
                    <span className="meta-pill meta-pill--info">
                      {t("web_pages.student_explore.request_sent", "تم إرسال الطلب")}
                    </span>
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
                            await coursesService.requestFolderEnrollment(
                              user,
                              f,
                              t("web_pages.student_explore.reason_folder", "طلب انضمام لمجلد"),
                            );
                            setPendingFolderReqIds((prev) => new Set([...prev, f.id]));
                          } catch {
                            setMessage(t("web_pages.student_explore.folder_request_failed", "تعذر إرسال الطلب. تحقق من الصلاحيات."));
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

