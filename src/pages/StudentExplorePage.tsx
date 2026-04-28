import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppTabPanel, AppTabs, ContentList, ContentListItem, EmptyState, PageToolbar, Panel, SectionTitle, StatTile } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { foldersService } from "../services/foldersService";
import type { Folder } from "../types";
import { DashboardLayout } from "./DashboardLayout";

type TabId = "courses" | "files";

const LAST_TAB_KEY = "ah:student-explore:lastTab";

export function StudentExplorePage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<TabId>("courses");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = useMemo(() => "student-explore", []);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [myFolderIds, setMyFolderIds] = useState<Set<string>>(() => new Set());
  const [pendingFolderReqIds, setPendingFolderReqIds] = useState<Set<string>>(() => new Set());
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setMessage(null);
    try {
      const [allFolders, myFolders, myReqs] = await Promise.all([
        foldersService.listExploreFoldersForStudent(),
        foldersService.listMyFoldersForStudent(user.uid),
        coursesService.listStudentEnrollmentRequests(user.uid),
      ]);
      const mineIds = new Set(myFolders.map((f) => f.id));
      setMyFolderIds(mineIds);
      setFolders(allFolders.filter((f) => !mineIds.has(f.id)));
      setPendingFolderReqIds(
        new Set(myReqs.filter((r) => r.requestType === "folder" && r.status === "pending").map((r) => r.targetId)),
      );
    } catch {
      setMessage("تعذر تحميل الاستكشاف. تحقق من الاتصال وصلاحيات Firestore.");
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

  return (
    <DashboardLayout role="student" title="الاستكشاف" lede="تبويب موحّد للدورات والملفات مثل التطبيق، لكن بتخطيط مناسب للويب." >
      <AppTabs
        groupId={groupId}
        ariaLabel="أقسام الاستكشاف"
        value={tab}
        onChange={onTabChange}
        tabs={[
          { id: "courses", label: "الدورات" },
          { id: "files", label: "الملفات" },
        ]}
      />

      <AppTabPanel tabId="courses" groupId={groupId} hidden={tab !== "courses"} className="lesson-tab-panel">
        <Panel className="card-elevated">
          <SectionTitle as="h3">استكشاف الدورات</SectionTitle>
          <p className="muted small">نفس تبويب «الدورات» في الاستكشاف داخل التطبيق.</p>
          <PageToolbar>
            <Link to="/student/courses" className="primary-btn toolbar-btn">
              فتح كتالوج الدورات
            </Link>
            <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
              مقرراتي
            </Link>
            <Link to="/student/enrollment-requests" className="ghost-btn toolbar-btn">
              طلباتي
            </Link>
          </PageToolbar>
        </Panel>
      </AppTabPanel>

      <AppTabPanel tabId="files" groupId={groupId} hidden={tab !== "files"} className="lesson-tab-panel">
        <Panel className="card-elevated">
          <SectionTitle as="h3">استكشاف الملفات</SectionTitle>
          <p className="muted small">
            مجلدات متاحة (عام/خاص). المجلدات التي أنت عضو فيها تظهر ضمن «ملفاتي».
          </p>
          <PageToolbar>
            <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
              <ButtonBusyLabel busy={loading}>تحديث</ButtonBusyLabel>
            </button>
            <Link to="/student/myfiles" className="ghost-btn toolbar-btn">
              ملفاتي
            </Link>
            <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المجلدات" aria-label="بحث في المجلدات" />
          </PageToolbar>
        </Panel>

        {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
        {!loading ? (
          <div className="grid-2 home-stats-grid">
            <StatTile title="المتاحة" highlight={folders.length} />
            <StatTile title="النتائج" highlight={visibleFolders.length} />
            <StatTile title="ضمن ملفاتي" highlight={myFolderIds.size} />
          </div>
        ) : null}
        {loading ? (
          <PageLoadHint />
        ) : visibleFolders.length === 0 ? (
          <EmptyState message="لا توجد مجلدات متاحة حالياً." />
        ) : (
          <ContentList>
            {visibleFolders.map((f) => (
              <ContentListItem key={f.id} className="folder-row">
                <div>
                  <h3 className="post-title">{f.name}</h3>
                  {f.description ? <p className="muted small">{f.description}</p> : null}
                  <p className="muted small">
                    {typeof f.fileCount === "number" ? `${f.fileCount} ملف` : "—"} · {typeof f.memberCount === "number" ? `${f.memberCount} عضو` : "—"} ·{" "}
                    {f.folderType === "private" ? "خاص" : "عام"}
                  </p>
                </div>
                {f.folderType === "private" ? (
                  pendingFolderReqIds.has(f.id) ? (
                    <span className="meta-pill meta-pill--info">تم إرسال طلب</span>
                  ) : (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() =>
                        void (async () => {
                          if (!user) return;
                          setRequestingId(f.id);
                          setMessage(null);
                          try {
                            await coursesService.requestFolderEnrollment(user, f, "طلب انضمام لمجلد");
                            setPendingFolderReqIds((prev) => new Set([...prev, f.id]));
                          } catch {
                            setMessage("تعذر إرسال الطلب. تحقق من الصلاحيات.");
                          } finally {
                            setRequestingId(null);
                          }
                        })()
                      }
                      disabled={requestingId === f.id}
                      aria-busy={requestingId === f.id}
                    >
                      <ButtonBusyLabel busy={requestingId === f.id}>طلب الانضمام</ButtonBusyLabel>
                    </button>
                  )
                ) : (
                  <Link className="primary-btn" to={`/student/folder/${f.id}`}>
                    فتح
                  </Link>
                )}
              </ContentListItem>
            ))}
          </ContentList>
        )}
      </AppTabPanel>
    </DashboardLayout>
  );
}

