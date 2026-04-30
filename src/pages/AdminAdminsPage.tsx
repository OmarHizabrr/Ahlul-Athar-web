import { useEffect, useMemo, useState } from "react";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, Avatar, ContentList, ContentListItem, EmptyState, PageToolbar, StatTile } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import type { AdminRecord } from "../types";

export function AdminAdminsPage() {
  const { tr } = useI18n();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await directoryService.listAdmins();
      setRows(data);
    } catch {
      setMessage(tr("تعذر تحميل قائمة المشرفين. تحقق من صلاحيات Firestore."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.displayName.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <DashboardLayout role="admin" title={tr("المشرفون")} lede={tr("إدارة المشرفين (عرض وبحث) بنفس فكرة تبويب «المشرفين» في التطبيق، لكن بتصميم ويب.")} >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {tr("تحديث")}
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("بحث بالاسم أو البريد")}
          aria-label={tr("بحث في المشرفين")}
        />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={tr("الإجمالي")} highlight={rows.length} />
          <StatTile title={tr("النتائج")} highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message={tr("لا توجد نتائج مطابقة.")} />
      ) : (
        <ContentList>
          {visible.map((r) => (
            <ContentListItem key={r.uid} className="user-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                <Avatar
                  photoURL={r.photoURL}
                  displayName={r.displayName}
                  email={r.email}
                  alt={r.displayName || tr("مشرف")}
                  imageClassName="user-avatar topbar-avatar"
                  fallbackClassName="user-avatar-fallback topbar-avatar"
                  size={40}
                />
                <div style={{ minWidth: 0 }}>
                  <h3 className="post-title">{r.displayName || r.uid}</h3>
                  <p className="muted small">{r.email || tr("—")}</p>
                </div>
              </div>
              <span className={r.isActive ? "meta-pill meta-pill--ok" : "meta-pill meta-pill--muted"}>
                {r.isActive ? tr("نشط") : tr("موقوف")}
              </span>
            </ContentListItem>
          ))}
        </ContentList>
      )}
    </DashboardLayout>
  );
}

