import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, ContentList, ContentListItem, CoverImage, EmptyState, PageToolbar, StatTile, cn } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { foldersService } from "../services/foldersService";
import type { Folder } from "../types";
import { DashboardLayout } from "./DashboardLayout";

export function AdminFoldersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await foldersService.listFoldersForAdmin();
      setRows(data);
    } catch {
      setMessage(t("web_pages.admin_folders.load_failed", "تعذر تحميل المجلدات. تحقق من صلاحيات Firestore."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((f) => f.name.toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <DashboardLayout
      role="admin"
      title={t("web_pages.nav.folders", "المجلدات")}
      lede={t(
        "web_pages.admin_folders.lede",
        "إدارة المجلدات (عرض/بحث/تفاصيل) بنفس فكرة تبويب «المجلدات» في التطبيق.",
      )}
    >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {t("web_pages.admin_folders.refresh", "تحديث")}
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("web_pages.admin_folders.search_ph", "بحث في المجلدات")}
          aria-label={t("web_pages.admin_folders.search_ph", "بحث في المجلدات")}
        />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t("web_pages.admin_folders.stat_total", "إجمالي المجلدات")} highlight={rows.length} />
          <StatTile title={t("web_pages.admin_folders.stat_results", "النتائج")} highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message={t("web_pages.admin_folders.empty", "لا توجد مجلدات حتى الآن.")} />
      ) : (
        <ContentList>
          {visible.map((f) => {
            const hasImg = Boolean(f.coverImageUrl?.trim());
            return (
              <ContentListItem key={f.id} className={cn("folder-row", hasImg && "enrollment-req-item--row")}>
                {hasImg ? (
                  <CoverImage variant="thumb" src={f.coverImageUrl} alt={f.name} className="enrollment-req-thumb" />
                ) : null}
                <div className="enrollment-req-item__body">
                  <h3 className="post-title">{f.name}</h3>
                  {f.description ? <p className="muted small">{f.description}</p> : null}
                  <div className="course-meta lesson-course-meta">
                    <span>
                      {typeof f.fileCount === "number"
                        ? `${f.fileCount} ${t("web_pages.admin_folders.file_word", "ملف")}`
                        : t("web_shell.dash_em", "—")}
                    </span>
                    <span>
                      {typeof f.memberCount === "number"
                        ? `${f.memberCount} ${t("web_pages.admin_folders.member_word", "عضو")}`
                        : t("web_shell.dash_em", "—")}
                    </span>
                    <span>
                      {f.folderType === "private"
                        ? t("web_pages.admin_folders.type_private", "خاص")
                        : t("web_pages.admin_folders.type_public", "عام")}
                    </span>
                  </div>
                  <div className="course-actions">
                    <Link className="primary-btn" to={`/admin/folder/${f.id}`}>
                      {t("web_pages.admin_folders.open_details", "فتح التفاصيل")}
                    </Link>
                  </div>
                </div>
              </ContentListItem>
            );
          })}
        </ContentList>
      )}
    </DashboardLayout>
  );
}

