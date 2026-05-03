import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  ContentList,
  ContentListItem,
  CoverImage,
  cn,
  EmptyState,
  PageToolbar,
  StatTile,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { coursesService } from "../services/coursesService";
import { myCoursesService } from "../services/myCoursesService";
import type { EnrollmentRequest } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { dashboardBackLinkState } from "../utils/dashboardBackNavigation";
import { DashboardLayout } from "./DashboardLayout";
import { AppTabPanel, AppTabs } from "../components/ui";

function enrollmentStatusLabel(s: EnrollmentRequest["status"], t: (key: string, fallback?: string) => string): string {
  switch (s) {
    case "pending":
      return t("web_pages.student_requests.status_pending", "قيد المراجعة");
    case "approved":
      return t("web_pages.student_requests.status_approved_short", "مقبول");
    case "rejected":
      return t("web_pages.student_requests.status_rejected_short", "مرفوض");
    case "expired":
      return t("web_pages.student_requests.status_expired_short", "منتهٍ");
    default:
      return s;
  }
}

export function StudentEnrollmentRequestsPage() {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<EnrollmentRequest[]>([]);
  const [enrolled, setEnrolled] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EnrollmentRequest["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | EnrollmentRequest["requestType"]>("all");

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const [reqs, mine] = await Promise.all([
        coursesService.listStudentEnrollmentRequests(user.uid),
        myCoursesService.listForStudent(user.uid),
      ]);
      setRows(reqs);
      setEnrolled(new Set(mine.map((m) => m.courseId)));
    } catch {
      setMessage(t("web_pages.student_requests.load_failed", "تعذر تحميل طلباتك. تحقق من الاتصال وقواعد Firestore."));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (ready && user) {
      void load();
    }
  }, [ready, user, load]);

  const visibleRows = useMemo(() => {
    let out = rows;
    if (typeFilter !== "all") {
      out = out.filter((r) => r.requestType === typeFilter);
    }
    if (statusFilter !== "all") {
      out = out.filter((r) => r.status === statusFilter);
    }
    return out;
  }, [rows, statusFilter, typeFilter]);

  if (!ready) {
    return (
      <DashboardLayout
        role="student"
        title={t("web_pages.nav.my_requests", "طلباتي")}
        lede={t(
          "web_pages.student_requests.lede_short",
          "تتبّع حالة طلبات الانضمام للمقررات — نفس سجل «طلباتي» / الدورات في تطبيق الجوال.",
        )}
      >
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout
      role="student"
      title={t("web_pages.nav.my_requests", "طلباتي")}
      lede={t(
        "web_pages.student_requests.lede",
        "تتبّع حالة طلبات الانضمام للمقررات والمجلدات — نفس سجل «طلباتي» في تطبيق الجوال.",
      )}
    >
      <PageToolbar>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>{t("web_pages.student_requests.refresh", "تحديث")}</ButtonBusyLabel>
        </button>
        <Link to="/student/courses" className="ghost-btn toolbar-btn">
          {t("web_pages.student_requests.browse_courses", "تصفح الدورات")}
        </Link>
        <Link to="/student/myfiles" className="ghost-btn toolbar-btn">
          {t("web_pages.student_requests.link_files", "الملفات")}
        </Link>
        <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
          {t("web_pages.nav.my_courses", "مقرراتي")}
        </Link>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() =>
            setStatusFilter((s) =>
              s === "all"
                ? "pending"
                : s === "pending"
                  ? "approved"
                  : s === "approved"
                    ? "rejected"
                    : s === "rejected"
                      ? "expired"
                      : "all",
            )
          }
        >
          {statusFilter === "all"
            ? t("web_pages.student_requests.filter_cycle_hint_all", "كل الحالات")
            : statusFilter === "pending"
              ? t("web_pages.student_requests.status_pending", "قيد المراجعة")
              : statusFilter === "approved"
                ? t("web_pages.student_requests.status_approved_plural", "المقبولة")
                : statusFilter === "rejected"
                  ? t("web_pages.student_requests.status_rejected_plural", "المرفوضة")
                  : t("web_pages.student_requests.status_expired_plural", "المنتهية")}
        </button>
      </PageToolbar>
      <AppTabs
        groupId={`student-requests-${user.uid}`}
        ariaLabel={t("web_pages.student_requests.tabs_type_aria", "نوع الطلبات")}
        value={typeFilter}
        onChange={(id) => setTypeFilter(id as "all" | "course" | "folder")}
        tabs={[
          { id: "all", label: t("web_pages.student_requests.tab_all", "الكل") },
          { id: "course", label: t("web_pages.student_requests.tab_courses", "الدورات") },
          { id: "folder", label: t("web_pages.student_requests.tab_folders", "المجلدات") },
        ]}
      />
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {(
        [
          ["all", t("web_pages.student_requests.tab_all", "الكل")] as const,
          ["course", t("web_pages.student_requests.tab_courses", "الدورات")] as const,
          ["folder", t("web_pages.student_requests.tab_folders", "المجلدات")] as const,
        ] as const
      ).map(([panelId]) => {
        const panelRows =
          panelId === "all" ? visibleRows : visibleRows.filter((r) => r.requestType === panelId);
        return (
          <AppTabPanel
            key={panelId}
            tabId={panelId}
            groupId={`student-requests-${user.uid}`}
            hidden={typeFilter !== panelId}
            className="lesson-tab-panel"
          >
            {!loading ? (
              <div className="grid-2 home-stats-grid">
                <StatTile title={t("web_pages.student_requests.stat_total", "إجمالي الطلبات")} highlight={panelRows.length} />
                <StatTile
                  title={t("web_pages.student_requests.stat_pending", "قيد المراجعة")}
                  highlight={panelRows.filter((r) => r.status === "pending").length}
                />
                <StatTile
                  title={t("web_pages.student_requests.stat_approved", "طلبات مقبولة")}
                  highlight={panelRows.filter((r) => r.status === "approved").length}
                />
                <StatTile
                  title={t("web_pages.student_requests.stat_rejected_expired", "طلبات مرفوضة/منتهية")}
                  highlight={panelRows.filter((r) => r.status === "rejected" || r.status === "expired").length}
                />
              </div>
            ) : null}
            {loading ? (
              <PageLoadHint />
            ) : panelRows.length === 0 ? (
              <EmptyState message={t("web_pages.student_requests.empty", "لا توجد طلبات انضمام حتى الآن.")} />
            ) : (
              <ContentList>
                {panelRows.map((r) => {
                  const inMy = r.requestType === "course" ? enrolled.has(r.targetId) : false;
                  const hasThumb = Boolean(r.targetImageURL?.trim());
                  const isFolder = r.requestType === "folder";
                  const openHref = isFolder ? `/student/folder/${r.targetId}` : `/student/course/${r.targetId}`;
                  return (
                    <ContentListItem
                      key={r.id}
                      className={cn("enrollment-req-item", hasThumb && "enrollment-req-item--row")}
                    >
                      {hasThumb ? (
                        <CoverImage
                          variant="thumb"
                          src={r.targetImageURL}
                          alt={r.targetName}
                          className="enrollment-req-thumb"
                        />
                      ) : null}
                      <div className="enrollment-req-item__body">
                        <h3 className="post-title">
                          {r.targetName ||
                            (isFolder
                              ? t("web_pages.student_requests.kind_folder", "مجلد")
                              : t("web_pages.student_requests.kind_course", "مقرر"))}
                          <span className="meta-pill meta-pill--muted" style={{ marginInlineStart: "0.5rem" }}>
                            {isFolder
                              ? t("web_pages.student_requests.kind_folder", "مجلد")
                              : t("web_pages.student_requests.kind_course", "مقرر")}
                          </span>
                        </h3>
                        <p className="muted post-meta small">
                          {t("web_pages.student_requests.requested_at", "طُلب في")} {formatFirestoreTime(r.requestedAt)}
                          {r.processedAt != null
                            ? ` · ${t("web_pages.student_requests.processed_at", "عُالج في")} ${formatFirestoreTime(r.processedAt)}`
                            : null}
                        </p>
                        <p className="enrollment-req-badges" aria-label={t("web_pages.student_requests.status_aria", "الحالة")}>
                          <span
                            className={
                              r.status === "approved"
                                ? "meta-pill meta-pill--ok"
                                : r.status === "pending"
                                  ? "meta-pill meta-pill--info"
                                  : r.status === "rejected"
                                    ? "meta-pill meta-pill--warn"
                                    : "meta-pill meta-pill--muted"
                            }
                          >
                            {enrollmentStatusLabel(r.status, t)}
                          </span>
                          {inMy && r.status === "approved" ? (
                            <span className="meta-pill meta-pill--ok">
                              {t("web_pages.student_requests.in_my_courses", "ضمن «مقرراتي»")}
                            </span>
                          ) : null}
                        </p>
                        {r.adminNotes && r.status !== "pending" ? (
                          <p className="muted small">
                            {t("web_pages.student_requests.admin_note", "ملاحظة الإدارة")}: {r.adminNotes}
                          </p>
                        ) : null}
                        <div className="course-actions">
                          {r.status === "approved" || inMy ? (
                            <Link
                              className="primary-btn"
                              to={openHref}
                              {...dashboardBackLinkState("/student/enrollment-requests")}
                            >
                              {t("web_pages.student_requests.open", "فتح")}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </ContentListItem>
                  );
                })}
              </ContentList>
            )}
          </AppTabPanel>
        );
      })}
    </DashboardLayout>
  );
}
