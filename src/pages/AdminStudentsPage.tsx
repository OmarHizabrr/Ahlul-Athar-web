import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, Avatar, ContentList, ContentListItem, EmptyState, PageToolbar, StatTile } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import type { StudentRecord } from "../types";

const S = "web_pages.admin_students" as const;
type TFn = (key: string, fallback?: string) => string;

function statusPill(student: StudentRecord, t: TFn) {
  if (student.isSuspended) {
    return { text: t(`${S}.pill_suspended`, "موقوف"), cls: "meta-pill meta-pill--warn" };
  }
  if (student.isActivated === false) {
    return { text: t(`${S}.pill_not_activated`, "غير مُفعّل"), cls: "meta-pill meta-pill--muted" };
  }
  if (student.isActive === false) {
    return { text: t(`${S}.pill_inactive`, "غير نشط"), cls: "meta-pill meta-pill--muted" };
  }
  return { text: t(`${S}.pill_active`, "نشط"), cls: "meta-pill meta-pill--ok" };
}

export function AdminStudentsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "suspended" | "notActivated">("all");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await directoryService.listStudents();
      setRows(data);
    } catch {
      setMessage(t(`${S}.load_failed`, "تعذر تحميل قائمة الطلاب. تحقق من صلاحيات Firestore."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    let out = rows;
    if (filter !== "all") {
      out = out.filter((s) => {
        if (filter === "suspended") return Boolean(s.isSuspended);
        if (filter === "notActivated") return s.isActivated === false;
        if (filter === "inactive") return s.isActive === false;
        return s.isActive !== false && !s.isSuspended;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((s) => {
        const name = (s.displayName ?? "").toLowerCase();
        const email = (s.email ?? "").toLowerCase();
        const phone = (s.phone ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q) || s.uid.toLowerCase().includes(q);
      });
    }
    out = out.slice().sort((a, b) => {
      if (sortBy === "date") {
        const ad = Number((a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0);
        const bd = Number((b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0);
        return sortDir === "asc" ? ad - bd : bd - ad;
      }
      const cmp = String(a.displayName ?? "").localeCompare(String(b.displayName ?? ""), "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, search, filter, sortBy, sortDir]);

  const patchFlags = async (uid: string, flags: { isActive?: boolean; isSuspended?: boolean; isActivated?: boolean }) => {
    setBusyId(uid);
    setMessage(null);
    try {
      await directoryService.setStudentFlags(uid, flags);
      await load();
    } catch {
      setMessage(t(`${S}.patch_failed`, "تعذر تحديث حالة الطالب."));
    } finally {
      setBusyId(null);
    }
  };

  const dash = t("web_shell.dash_em", "—");

  return (
    <DashboardLayout
      role="admin"
      title={t(`${S}.title`, "الطلاب")}
      lede={t(`${S}.lede`, "قائمة الطلاب مع بحث وفلتر حالة — مكافئ لتبويب «الطلاب» في التطبيق.")}
    >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {t(`${S}.refresh`, "تحديث")}
        </button>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label={t(`${S}.filter_aria`, "فلتر حالة الطالب")}>
          <option value="all">{t(`${S}.filter_all`, "كل الحالات")}</option>
          <option value="active">{t(`${S}.filter_active`, "النشطون")}</option>
          <option value="inactive">{t(`${S}.filter_inactive`, "غير نشط")}</option>
          <option value="suspended">{t(`${S}.filter_suspended`, "موقوف")}</option>
          <option value="notActivated">{t(`${S}.filter_not_activated`, "غير مُفعّل")}</option>
        </select>
        <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label={t(`${S}.sort_aria`, "ترتيب الطلاب")}>
          <option value="name">{t(`${S}.sort_name`, "ترتيب: الاسم")}</option>
          <option value="date">{t(`${S}.sort_date`, "ترتيب: الأحدث")}</option>
        </select>
        <select className="select" value={sortDir} onChange={(e) => setSortDir(e.target.value as typeof sortDir)} aria-label={t(`${S}.sort_dir_aria`, "اتجاه الترتيب")}>
          <option value="asc">{t(`${S}.sort_asc`, "تصاعدي")}</option>
          <option value="desc">{t(`${S}.sort_desc`, "تنازلي")}</option>
        </select>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(`${S}.search_ph`, "بحث بالاسم/البريد/الجوال/المعرّف")}
          aria-label={t(`${S}.search_aria`, "بحث في الطلاب")}
        />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {!loading ? (
        <div className="grid-2 home-stats-grid">
          <StatTile title={t(`${S}.stat_total`, "الإجمالي")} highlight={rows.length} />
          <StatTile title={t(`${S}.stat_results`, "النتائج")} highlight={visible.length} />
        </div>
      ) : null}
      {loading ? (
        <PageLoadHint />
      ) : visible.length === 0 ? (
        <EmptyState message={t(`${S}.empty`, "لا توجد نتائج مطابقة.")} />
      ) : (
        <ContentList>
          {visible.map((s) => {
            const pill = statusPill(s, t);
            return (
              <ContentListItem key={s.uid} className="user-row">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                  <Avatar
                    photoURL={s.photoURL}
                    displayName={s.displayName}
                    email={s.email}
                    alt={s.displayName || t(`${S}.avatar_alt`, "طالب")}
                    imageClassName="user-avatar topbar-avatar"
                    fallbackClassName="user-avatar-fallback topbar-avatar"
                    size={40}
                  />
                  <div style={{ minWidth: 0 }}>
                    <h3 className="post-title">{s.displayName || s.uid}</h3>
                    <p className="muted small">
                      {s.email || dash} {s.phone ? `· ${s.phone}` : ""}
                    </p>
                  </div>
                </div>
                <div className="course-actions">
                  <span className={pill.cls}>{pill.text}</span>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void patchFlags(s.uid, { isSuspended: !Boolean(s.isSuspended), isActive: true })}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>
                      {s.isSuspended ? t(`${S}.unsuspend`, "رفع الإيقاف") : t(`${S}.suspend`, "إيقاف")}
                    </ButtonBusyLabel>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void patchFlags(s.uid, { isActivated: s.isActivated === false })}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>
                      {s.isActivated === false ? t(`${S}.btn_activate`, "تفعيل") : t(`${S}.btn_deactivate`, "تعطيل")}
                    </ButtonBusyLabel>
                  </button>
                  <Link className="ghost-btn toolbar-btn" to={`/admin/student/${s.uid}`}>
                    {t(`${S}.open_profile`, "فتح الملف")}
                  </Link>
                </div>
              </ContentListItem>
            );
          })}
        </ContentList>
      )}
    </DashboardLayout>
  );
}
