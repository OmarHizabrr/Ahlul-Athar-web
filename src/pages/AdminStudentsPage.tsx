import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, Avatar, ContentList, ContentListItem, EmptyState, PageToolbar, StatTile } from "../components/ui";
import { useI18n } from "../context/I18nContext";
import { DashboardLayout } from "./DashboardLayout";
import { directoryService } from "../services/directoryService";
import type { StudentRecord } from "../types";

function statusPill(s: StudentRecord, tr: (text: string) => string) {
  if (s.isSuspended) {
    return { text: tr("موقوف"), cls: "meta-pill meta-pill--warn" };
  }
  if (s.isActivated === false) {
    return { text: tr("غير مُفعّل"), cls: "meta-pill meta-pill--muted" };
  }
  if (s.isActive === false) {
    return { text: tr("غير نشط"), cls: "meta-pill meta-pill--muted" };
  }
  return { text: tr("نشط"), cls: "meta-pill meta-pill--ok" };
}

export function AdminStudentsPage() {
  const { tr } = useI18n();
  const [rows, setRows] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "suspended" | "notActivated">("all");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await directoryService.listStudents();
      setRows(data);
    } catch {
      setMessage(tr("تعذر تحميل قائمة الطلاب. تحقق من صلاحيات Firestore."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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
      setMessage(tr("تعذر تحديث حالة الطالب."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout role="admin" title={tr("الطلاب")} lede={tr("قائمة الطلاب مع بحث وفلتر حالة — مكافئ لتبويب «الطلاب» في التطبيق.")} >
      <PageToolbar>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load()} disabled={loading} aria-busy={loading}>
          {tr("تحديث")}
        </button>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label={tr("فلتر حالة الطالب")}>
          <option value="all">{tr("كل الحالات")}</option>
          <option value="active">{tr("النشطون")}</option>
          <option value="inactive">{tr("غير نشط")}</option>
          <option value="suspended">{tr("موقوف")}</option>
          <option value="notActivated">{tr("غير مُفعّل")}</option>
        </select>
        <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label={tr("ترتيب الطلاب")}>
          <option value="name">{tr("ترتيب: الاسم")}</option>
          <option value="date">{tr("ترتيب: الأحدث")}</option>
        </select>
        <select className="select" value={sortDir} onChange={(e) => setSortDir(e.target.value as typeof sortDir)} aria-label={tr("اتجاه الترتيب")}>
          <option value="asc">{tr("تصاعدي")}</option>
          <option value="desc">{tr("تنازلي")}</option>
        </select>
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("بحث بالاسم/البريد/الجوال/المعرّف")}
          aria-label={tr("بحث في الطلاب")}
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
          {visible.map((s) => {
            const pill = statusPill(s, tr);
            return (
              <ContentListItem key={s.uid} className="user-row">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                  <Avatar
                    photoURL={s.photoURL}
                    displayName={s.displayName}
                    email={s.email}
                    alt={s.displayName || tr("طالب")}
                    imageClassName="user-avatar topbar-avatar"
                    fallbackClassName="user-avatar-fallback topbar-avatar"
                    size={40}
                  />
                  <div style={{ minWidth: 0 }}>
                    <h3 className="post-title">{s.displayName || s.uid}</h3>
                    <p className="muted small">
                      {s.email || tr("—")} {s.phone ? `· ${s.phone}` : ""}
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
                    <ButtonBusyLabel busy={busyId === s.uid}>{s.isSuspended ? tr("رفع الإيقاف") : tr("إيقاف")}</ButtonBusyLabel>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn toolbar-btn"
                    disabled={busyId === s.uid || loading}
                    onClick={() => void patchFlags(s.uid, { isActivated: s.isActivated === false })}
                  >
                    <ButtonBusyLabel busy={busyId === s.uid}>{s.isActivated === false ? tr("تفعيل") : tr("تعطيل")}</ButtonBusyLabel>
                  </button>
                  <Link className="ghost-btn toolbar-btn" to={`/admin/student/${s.uid}`}>
                    {tr("فتح الملف")}
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

