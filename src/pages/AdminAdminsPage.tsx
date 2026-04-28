import { useEffect, useMemo, useState } from "react";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, ContentList, ContentListItem, EmptyState, PageToolbar, StatTile } from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import type { AdminRecord } from "../types";

export function AdminAdminsPage() {
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
      setMessage("تعذر تحميل قائمة المشرفين. تحقق من صلاحيات Firestore.");
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
    <DashboardLayout role="admin" title="المشرفون" lede="إدارة المشرفين (عرض وبحث) بنفس فكرة تبويب «المشرفين» في التطبيق، لكن بتصميم ويب." >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          تحديث
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو البريد"
          aria-label="بحث في المشرفين"
        />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title="الإجمالي" highlight={rows.length} />
          <StatTile title="النتائج" highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message="لا توجد نتائج مطابقة." />
      ) : (
        <ContentList>
          {visible.map((r) => (
            <ContentListItem key={r.uid} className="user-row">
              <div>
                <h3 className="post-title">{r.displayName || r.uid}</h3>
                <p className="muted small">{r.email || "—"}</p>
              </div>
              <span className={r.isActive ? "meta-pill meta-pill--ok" : "meta-pill meta-pill--muted"}>
                {r.isActive ? "نشط" : "موقوف"}
              </span>
            </ContentListItem>
          ))}
        </ContentList>
      )}
    </DashboardLayout>
  );
}

