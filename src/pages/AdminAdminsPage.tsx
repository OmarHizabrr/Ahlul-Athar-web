import { useEffect, useMemo, useState } from "react";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppModal, Avatar, ContentList, ContentListItem, EmptyState, FormPanel, PageToolbar, SectionTitle, StatTile } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import type { AdminRecord } from "../types";

export function AdminAdminsPage() {
  const { tr } = useI18n();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isActive, setIsActive] = useState(true);

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

  const openEdit = (row: AdminRecord) => {
    setEditing(row);
    setDisplayName(row.displayName ?? "");
    setEmail(row.email ?? "");
    setPhotoURL(row.photoURL ?? "");
    setIsActive(row.isActive !== false);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editing) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await directoryService.updateAdminProfile(editing.uid, { displayName, email, photoURL, isActive });
      setMessage(tr("تم حفظ بيانات المشرف."));
      setEditOpen(false);
      await load();
    } catch {
      setMessage(tr("تعذر حفظ بيانات المشرف."));
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleActive = async (row: AdminRecord) => {
    setSubmitting(true);
    setMessage(null);
    try {
      await directoryService.setAdminActive(row.uid, !row.isActive);
      setMessage(!row.isActive ? tr("تم تفعيل المشرف.") : tr("تم إيقاف المشرف."));
      await load();
    } catch {
      setMessage(tr("تعذر تحديث حالة المشرف."));
    } finally {
      setSubmitting(false);
    }
  };

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
      {message ? <AlertMessage kind={message.includes("تعذر") ? "error" : "success"}>{message}</AlertMessage> : null}
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
              <div className="course-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void onToggleActive(r)}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  <ButtonBusyLabel busy={submitting}>
                    {r.isActive ? tr("إيقاف") : tr("تفعيل")}
                  </ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={() => openEdit(r)} disabled={submitting}>
                  {tr("تعديل")}
                </button>
              </div>
            </ContentListItem>
          ))}
        </ContentList>
      )}
      <AppModal
        open={editOpen}
        title={tr("تعديل بيانات المشرف")}
        onClose={() => {
          if (!submitting) {
            setEditOpen(false);
          }
        }}
        contentClassName="course-form-modal"
      >
        <FormPanel
          onSubmit={(e) => {
            e.preventDefault();
            void onSaveEdit();
          }}
          elevated={false}
          className="course-form-modal__form"
        >
          <SectionTitle as="h4">{tr("بيانات المشرف")}</SectionTitle>
          <label>
            <span>{tr("الاسم")}</span>
            <input className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label>
            <span>{tr("البريد")}</span>
            <input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span>{tr("رابط الصورة")}</span>
            <input className="text-input" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder="https://..." />
          </label>
          <label className="switch-line">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>{tr("حساب نشط")}</span>
          </label>
          <div className="course-actions">
            <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
              <ButtonBusyLabel busy={submitting}>{tr("حفظ")}</ButtonBusyLabel>
            </button>
            <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)} disabled={submitting}>
              {tr("إلغاء")}
            </button>
          </div>
        </FormPanel>
      </AppModal>
    </DashboardLayout>
  );
}

