import { useEffect, useMemo, useState } from "react";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppTabPanel, AppTabs, ContentList, ContentListItem, EmptyState, PageToolbar, Panel, SectionTitle, StatTile } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { foldersService } from "../services/foldersService";
import type { Folder } from "../types";
import { DashboardLayout } from "./DashboardLayout";
import { Link } from "react-router-dom";

export function StudentMyFilesPage() {
  const { user, ready } = useAuth();
  const [myFolders, setMyFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"mine" | "explore">("mine");

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      if (!user) return;
      const [mine] = await Promise.all([
        foldersService.listMyFoldersForStudent(user.uid),
      ]);
      setMyFolders(mine);
    } catch {
      setMessage("تعذر تحميل مجلدات الملفات. تحقق من الاتصال وصلاحيات Firestore.");
      setMyFolders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [ready, user]);

  const visibleMine = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myFolders;
    return myFolders.filter((f) => f.name.toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q));
  }, [myFolders, search]);

  if (!ready) {
    return (
      <DashboardLayout role="student" title="ملفاتي" lede="مجلدات وملفات الاستكشاف — بتصميم ويب ومتوافق مع تدفق التطبيق.">
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout role="student" title="ملفاتي" lede="نفس فكرة تبويب «الملفات» في التطبيق: مجلداتي (ضمن MyFolders) + استكشاف المجلدات المتاحة (عام/خاص) وطلب الانضمام للخاص.">
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          <ButtonBusyLabel busy={loading}>تحديث</ButtonBusyLabel>
        </button>
        <Link to="/student/explore" className="ghost-btn toolbar-btn">
          الاستكشاف
        </Link>
        <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المجلدات" aria-label="بحث في المجلدات" />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      <AppTabs
        groupId={`myfiles-${user.uid}`}
        ariaLabel="أقسام ملفاتي"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "mine", label: "مجلداتي" },
          { id: "explore", label: "استكشاف" },
        ]}
      />

      {loading ? <PageLoadHint /> : null}

      <AppTabPanel tabId="mine" groupId={`myfiles-${user.uid}`} hidden={tab !== "mine"} className="lesson-tab-panel">
        {!loading ? (
          <div className="grid-2 home-stats-grid">
            <StatTile title="مجلداتي" highlight={myFolders.length} />
            <StatTile title="النتائج" highlight={visibleMine.length} />
          </div>
        ) : null}
        {!loading && visibleMine.length === 0 ? (
          <EmptyState message="لا توجد مجلدات ضمن «مجلداتي» بعد. إذا أضافتك الإدارة لمجلد سيظهر هنا." />
        ) : !loading ? (
          <ContentList>
            {visibleMine.map((f) => (
              <ContentListItem key={f.id} className="folder-row">
                <div>
                  <h3 className="post-title">{f.name}</h3>
                  {f.description ? <p className="muted small">{f.description}</p> : null}
                  <p className="muted small">
                    {typeof f.fileCount === "number" ? `${f.fileCount} ملف` : "—"} · {typeof f.totalSize === "number" ? `${Math.round(f.totalSize / 1024)} KB` : "—"}
                  </p>
                </div>
                <Link className="primary-btn" to={`/student/folder/${f.id}`}>
                  فتح
                </Link>
              </ContentListItem>
            ))}
          </ContentList>
        ) : null}
      </AppTabPanel>

      <AppTabPanel tabId="explore" groupId={`myfiles-${user.uid}`} hidden={tab !== "explore"} className="lesson-tab-panel">
        <Panel className="card-elevated">
          <SectionTitle as="h3">استكشاف المجلدات</SectionTitle>
          <p className="muted small">
            الاستكشاف أصبح صفحة كاملة تعرض المجلدات العامة والخاصة المتاحة وتتيح طلب الانضمام للخاص.
          </p>
          <div className="course-actions">
            <Link to="/student/explore" className="primary-btn">
              فتح صفحة الاستكشاف
            </Link>
          </div>
        </Panel>
      </AppTabPanel>
    </DashboardLayout>
  );
}

