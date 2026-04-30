import { useEffect, useMemo, useState } from "react";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, ContentList, ContentListItem, EmptyState, PageToolbar, StatTile } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { foldersService } from "../services/foldersService";
import type { Folder } from "../types";
import { DashboardLayout } from "./DashboardLayout";
import { Link, Navigate } from "react-router-dom";

export function StudentMyFilesPage() {
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  const [myFolders, setMyFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
      setMessage(tr("تعذر تحميل مجلدات الملفات. تحقق من الاتصال وصلاحيات Firestore."));
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
      <DashboardLayout role="student" title={tr("ملفاتي")} lede={tr("مجلدات وملفات الاستكشاف — بتصميم ويب ومتوافق مع تدفق التطبيق.")}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout role="student" title={tr("ملفاتي")} lede={tr("نفس فكرة تبويب «الملفات» في التطبيق: مجلداتي (ضمن MyFolders) + استكشاف المجلدات المتاحة (عام/خاص) وطلب الانضمام للخاص.")}>
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          <ButtonBusyLabel busy={loading}>{tr("تحديث")}</ButtonBusyLabel>
        </button>
        <Link to="/student/explore" className="ghost-btn toolbar-btn">
          {tr("الاستكشاف")}
        </Link>
        <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث في المجلدات")} aria-label={tr("بحث في المجلدات")} />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {loading ? <PageLoadHint /> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={tr("مجلداتي")} highlight={myFolders.length} />
          <StatTile title={tr("النتائج")} highlight={visibleMine.length} />
        </div>
      ) : null}
      {!loading && visibleMine.length === 0 ? (
        <EmptyState
          message={
            search.trim()
              ? tr("لا توجد نتائج مطابقة للبحث داخل مجلداتك.")
              : tr("لا توجد مجلدات ضمن «مجلداتي» بعد. إذا أضافتك الإدارة لمجلد سيظهر هنا.")
          }
        />
      ) : !loading ? (
        <ContentList>
          {visibleMine.map((f) => (
            <ContentListItem key={f.id} className="folder-row">
              <div>
                <h3 className="post-title">{f.name}</h3>
                {f.description ? <p className="muted small">{f.description}</p> : null}
                <p className="muted small">
                  {typeof f.fileCount === "number" ? `${f.fileCount} ${tr("ملف")}` : tr("—")} · {typeof f.totalSize === "number" ? `${Math.round(f.totalSize / 1024)} KB` : tr("—")}
                </p>
              </div>
              <Link className="primary-btn" to={`/student/folder/${f.id}`}>
                {tr("فتح")}
              </Link>
            </ContentListItem>
          ))}
        </ContentList>
      ) : null}
    </DashboardLayout>
  );
}

