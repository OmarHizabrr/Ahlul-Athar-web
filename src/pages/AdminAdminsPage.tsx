import { useCallback, useEffect, useMemo, useState } from "react";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppModal, Avatar, ContentList, ContentListItem, EmptyState, FormPanel, PageToolbar, SectionTitle, StatTile } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import type { AdminRecord } from "../types";

const A = "web_pages.admin_admins" as const;

type Flash = { text: string; kind: "success" | "error" } | null;

export function AdminAdminsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFlash(null);
    try {
      const data = await directoryService.listAdmins();
      setRows(data);
    } catch {
      setFlash({ text: t(`${A}.load_failed`, "تعذر تحميل قائمة المشرفين. تحقق من صلاحيات Firestore."), kind: "error" });
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
    setFlash(null);
    try {
      await directoryService.updateAdminProfile(editing.uid, { displayName, email, photoURL, isActive });
      setFlash({ text: t(`${A}.save_ok`, "تم حفظ بيانات المشرف."), kind: "success" });
      setEditOpen(false);
      await load();
    } catch {
      setFlash({ text: t(`${A}.save_failed`, "تعذر حفظ بيانات المشرف."), kind: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleActive = async (row: AdminRecord) => {
    setSubmitting(true);
    setFlash(null);
    try {
      await directoryService.setAdminActive(row.uid, !row.isActive);
      setFlash({
        text: !row.isActive ? t(`${A}.activated_ok`, "تم تفعيل المشرف.") : t(`${A}.deactivated_ok`, "تم إيقاف المشرف."),
        kind: "success",
      });
      await load();
    } catch {
      setFlash({ text: t(`${A}.toggle_failed`, "تعذر تحديث حالة المشرف."), kind: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const dash = t("web_shell.dash_em", "—");

  return (
    <DashboardLayout
      role="admin"
      title={t(`${A}.title`, "المشرفون")}
      lede={t(`${A}.lede`, "إدارة المشرفين (عرض وبحث) بنفس فكرة تبويب «المشرفين» في التطبيق، لكن بتصميم ويب.")}
    >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {t(`${A}.refresh`, "تحديث")}
        </button>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(`${A}.search_ph`, "بحث بالاسم أو البريد")}
          aria-label={t(`${A}.search_aria`, "بحث في المشرفين")}
        />
      </PageToolbar>
      {flash ? <AlertMessage kind={flash.kind}>{flash.text}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t(`${A}.stat_total`, "الإجمالي")} highlight={rows.length} />
          <StatTile title={t(`${A}.stat_results`, "النتائج")} highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message={t(`${A}.empty`, "لا توجد نتائج مطابقة.")} />
      ) : (
        <ContentList>
          {visible.map((r) => (
            <ContentListItem key={r.uid} className="user-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                <Avatar
                  photoURL={r.photoURL}
                  displayName={r.displayName}
                  email={r.email}
                  alt={r.displayName || t(`${A}.avatar_alt`, "مشرف")}
                  imageClassName="user-avatar topbar-avatar"
                  fallbackClassName="user-avatar-fallback topbar-avatar"
                  size={40}
                />
                <div style={{ minWidth: 0 }}>
                  <h3 className="post-title">{r.displayName || r.uid}</h3>
                  <p className="muted small">{r.email || dash}</p>
                </div>
              </div>
              <span className={r.isActive ? "meta-pill meta-pill--ok" : "meta-pill meta-pill--muted"}>
                {r.isActive ? t(`${A}.pill_active`, "نشط") : t(`${A}.pill_suspended`, "موقوف")}
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
                    {r.isActive ? t(`${A}.btn_deactivate`, "إيقاف") : t(`${A}.btn_activate`, "تفعيل")}
                  </ButtonBusyLabel>
                </button>
                <button type="button" className="ghost-btn" onClick={() => openEdit(r)} disabled={submitting}>
                  {t(`${A}.edit`, "تعديل")}
                </button>
              </div>
            </ContentListItem>
          ))}
        </ContentList>
      )}
      <AppModal
        open={editOpen}
        title={t(`${A}.modal_title`, "تعديل بيانات المشرف")}
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
          <SectionTitle as="h4">{t(`${A}.modal_section`, "بيانات المشرف")}</SectionTitle>
          <label>
            <span>{t(`${A}.label_name`, "الاسم")}</span>
            <input className="text-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label>
            <span>{t(`${A}.label_email`, "البريد")}</span>
            <input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span>{t(`${A}.label_photo`, "رابط الصورة")}</span>
            <input className="text-input" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder={t(`${A}.ph_photo`, "https://...")} />
          </label>
          <label className="switch-line">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>{t(`${A}.active_account`, "حساب نشط")}</span>
          </label>
          <div className="course-actions">
            <button className="primary-btn" type="submit" disabled={submitting} aria-busy={submitting}>
              <ButtonBusyLabel busy={submitting}>{t(`${A}.save`, "حفظ")}</ButtonBusyLabel>
            </button>
            <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)} disabled={submitting}>
              {t("web_shell.btn_cancel", "إلغاء")}
            </button>
          </div>
        </FormPanel>
      </AppModal>
    </DashboardLayout>
  );
}
