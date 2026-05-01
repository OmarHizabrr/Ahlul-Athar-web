import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, AppModal, EmptyState, PageToolbar, SectionTitle } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import {
  addContactChannel,
  contactChannelHref,
  deleteContactChannel,
  listContactChannels,
  updateContactChannel,
} from "../services/contactInfoService";
import type { ContactChannel, ContactChannelKind } from "../types";

const A = "web_pages.admin_contact" as const;

const KINDS: { value: ContactChannelKind; labelKey: string; labelFallback: string }[] = [
  { value: "phone", labelKey: `${A}.kind_phone`, labelFallback: "هاتف" },
  { value: "whatsapp", labelKey: `${A}.kind_whatsapp`, labelFallback: "واتساب" },
  { value: "email", labelKey: `${A}.kind_email`, labelFallback: "بريد" },
  { value: "link", labelKey: `${A}.kind_link`, labelFallback: "رابط" },
];

type Flash = { text: string; kind: "success" | "error" } | null;

export function AdminContactPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ContactChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);
  const [saving, setSaving] = useState(false);

  const [kind, setKind] = useState<ContactChannelKind>("phone");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ContactChannel | null>(null);
  const [editKind, setEditKind] = useState<ContactChannelKind>("phone");
  const [editLabel, setEditLabel] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editOrder, setEditOrder] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setFlash(null);
    try {
      setRows(await listContactChannels());
    } catch {
      setFlash({ text: t(`${A}.load_failed`, "تعذر تحميل القائمة. تحقق من الصلاحيات."), kind: "error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const nextSortOrder = useMemo(() => (rows.length ? Math.max(...rows.map((r) => r.sortOrder)) + 1 : 0), [rows]);

  const onAdd = async () => {
    const lab = label.trim();
    const val = value.trim();
    if (!lab || !val) {
      setFlash({ text: t(`${A}.required`, "العنوان والقيمة مطلوبان."), kind: "error" });
      return;
    }
    setSaving(true);
    setFlash(null);
    try {
      await addContactChannel({ kind, label: lab, value: val, sortOrder: nextSortOrder });
      setLabel("");
      setValue("");
      setKind("phone");
      setFlash({ text: t(`${A}.added`, "تمت الإضافة."), kind: "success" });
      await load();
    } catch {
      setFlash({ text: t(`${A}.add_failed`, "تعذر الإضافة."), kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ContactChannel) => {
    setEditing(row);
    setEditKind(row.kind);
    setEditLabel(row.label);
    setEditValue(row.value);
    setEditOrder(row.sortOrder);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    const lab = editLabel.trim();
    const val = editValue.trim();
    if (!lab || !val) {
      setFlash({ text: t(`${A}.required`, "العنوان والقيمة مطلوبان."), kind: "error" });
      return;
    }
    setSaving(true);
    setFlash(null);
    try {
      await updateContactChannel(editing.id, {
        kind: editKind,
        label: lab,
        value: val,
        sortOrder: editOrder,
      });
      setEditOpen(false);
      setFlash({ text: t(`${A}.saved`, "تم الحفظ."), kind: "success" });
      await load();
    } catch {
      setFlash({ text: t(`${A}.save_failed`, "تعذر الحفظ."), kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: ContactChannel) => {
    if (typeof window !== "undefined" && !window.confirm(t(`${A}.confirm_delete`, "حذف قناة التواصل هذه؟"))) return;
    setSaving(true);
    setFlash(null);
    try {
      await deleteContactChannel(row.id);
      setFlash({ text: t(`${A}.deleted`, "تم الحذف."), kind: "success" });
      await load();
    } catch {
      setFlash({ text: t(`${A}.delete_failed`, "تعذر الحذف."), kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      role="admin"
      title={t(`${A}.title`, "أرقام وقنوات التواصل")}
      lede={t(`${A}.lede`, "تظهر في صفحة «تواصل معنا» للزوار وصفحة تسجيل الدخول.")}
    >
      {flash ? (
        <AlertMessage kind={flash.kind === "error" ? "error" : "success"} role="status">
          {flash.text}
        </AlertMessage>
      ) : null}

      <PageToolbar>
        <Link className="toolbar-btn ghost-btn" to="/contact" target="_blank" rel="noopener noreferrer">
          {t(`${A}.preview`, "معاينة الصفحة العامة")}
        </Link>
        <button type="button" className="toolbar-btn ghost-btn" onClick={() => void load()} disabled={loading}>
          {t("common.refresh", "تحديث")}
        </button>
      </PageToolbar>

      {loading ? (
        <PageLoadHint text={t("common.loading", "جاري التحميل...")} />
      ) : (
        <>
          <section className="card-elevated admin-contact-form">
            <SectionTitle>{t(`${A}.add_section`, "إضافة قناة جديدة")}</SectionTitle>
            <div className="admin-contact-grid">
              <label className="admin-contact-field">
                <span>{t(`${A}.field_kind`, "النوع")}</span>
                <select className="text-input" value={kind} onChange={(e) => setKind(e.target.value as ContactChannelKind)}>
                  {KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {t(k.labelKey, k.labelFallback)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-contact-field">
                <span>{t(`${A}.field_label`, "العنوان الظاهر")}</span>
                <input
                  className="text-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t(`${A}.ph_label`, "مثال: الدعم الفني")}
                />
              </label>
              <label className="admin-contact-field admin-contact-field--wide">
                <span>{t(`${A}.field_value`, "القيمة")}</span>
                <input
                  className="text-input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t(`${A}.ph_value`, "رقم، بريد، أو رابط")}
                />
              </label>
            </div>
            <p className="muted small admin-contact-hint">
              {t(
                `${A}.hint_whatsapp`,
                "واتساب: أدخل الرقم بصيغة دولية بدون + (مثال: 966501234567). الهاتف: نفس الصيغة لزر الاتصال.",
              )}
            </p>
            <button type="button" className="primary-btn admin-contact-add-submit" onClick={() => void onAdd()} disabled={saving} aria-busy={saving}>
              <ButtonBusyLabel busy={saving}>{t(`${A}.add_btn`, "إضافة")}</ButtonBusyLabel>
            </button>
          </section>

          <SectionTitle>{t(`${A}.list_section`, "القنوات الحالية")}</SectionTitle>
          {rows.length === 0 ? (
            <EmptyState
              message={
                <>
                  <strong>{t(`${A}.empty_title`, "لا توجد قنوات")}</strong>
                  <br />
                  {t(`${A}.empty_desc`, "أضف أول وسيلة تواصل أعلاه.")}
                </>
              }
            />
          ) : (
            <ul className="admin-contact-list">
              {rows.map((row) => {
                const kMeta = KINDS.find((k) => k.value === row.kind);
                return (
                <li key={row.id} className="admin-contact-row card-elevated">
                  <div className="admin-contact-row__main">
                    <strong>{row.label}</strong>
                    <span className="muted small">{kMeta ? t(kMeta.labelKey, kMeta.labelFallback) : row.kind}</span>
                    <span className="admin-contact-row__value">{row.value}</span>
                    <a
                      className="inline-link"
                      href={contactChannelHref(row)}
                      {...(row.kind === "link" || row.kind === "whatsapp"
                        ? { target: "_blank", rel: "noopener noreferrer" as const }
                        : {})}
                    >
                      {t(`${A}.try_link`, "تجربة الرابط")}
                    </a>
                  </div>
                  <div className="admin-contact-row__actions">
                    <button type="button" className="ghost-btn" onClick={() => openEdit(row)} disabled={saving}>
                      {t(`${A}.btn_edit`, "تعديل")}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => void onDelete(row)} disabled={saving}>
                      {t(`${A}.btn_delete`, "حذف")}
                    </button>
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </>
      )}

      <AppModal
        open={editOpen && Boolean(editing)}
        title={t(`${A}.edit_title`, "تعديل القناة")}
        onClose={() => !saving && setEditOpen(false)}
        contentClassName="course-form-modal"
      >
        {editing ? (
          <>
          <div className="admin-contact-grid">
            <label className="admin-contact-field">
              <span>{t(`${A}.field_kind`, "النوع")}</span>
              <select
                className="text-input"
                value={editKind}
                onChange={(e) => setEditKind(e.target.value as ContactChannelKind)}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {t(k.labelKey, k.labelFallback)}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-contact-field">
              <span>{t(`${A}.field_order`, "ترتيب العرض")}</span>
              <input
                className="text-input"
                type="number"
                value={editOrder}
                onChange={(e) => setEditOrder(Number(e.target.value) || 0)}
              />
            </label>
            <label className="admin-contact-field admin-contact-field--wide">
              <span>{t(`${A}.field_label`, "العنوان الظاهر")}</span>
              <input className="text-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </label>
            <label className="admin-contact-field admin-contact-field--wide">
              <span>{t(`${A}.field_value`, "القيمة")}</span>
              <input className="text-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            </label>
          </div>
            <div className="course-actions">
              <button type="button" className="primary-btn" onClick={() => void onSaveEdit()} disabled={saving} aria-busy={saving}>
                <ButtonBusyLabel busy={saving}>{t(`${A}.btn_save`, "حفظ")}</ButtonBusyLabel>
              </button>
              <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)} disabled={saving}>
                {t("web_shell.btn_close", "إغلاق")}
              </button>
            </div>
          </>
        ) : null}
      </AppModal>
    </DashboardLayout>
  );
}
