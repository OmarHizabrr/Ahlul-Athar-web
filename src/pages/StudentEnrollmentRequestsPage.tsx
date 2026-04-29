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
import { coursesService } from "../services/coursesService";
import { myCoursesService } from "../services/myCoursesService";
import type { EnrollmentRequest } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { DashboardLayout } from "./DashboardLayout";
import { AppTabPanel, AppTabs } from "../components/ui";

function statusLabel(s: EnrollmentRequest["status"]): string {
  switch (s) {
    case "pending":
      return "قيد المراجعة";
    case "approved":
      return "مقبول";
    case "rejected":
      return "مرفوض";
    case "expired":
      return "منتهٍ";
    default:
      return s;
  }
}

export function StudentEnrollmentRequestsPage() {
  const { user, ready } = useAuth();
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
      setMessage("تعذر تحميل طلباتك. تحقق من الاتصال وقواعد Firestore.");
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        title="طلباتي"
        lede="تتبّع حالة طلبات الانضمام للمقررات — نفس سجل «طلباتي» / الدورات في تطبيق الجوال."
      >
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }

  return (
    <DashboardLayout
      role="student"
      title="طلباتي"
      lede="تتبّع حالة طلبات الانضمام للمقررات والمجلدات — نفس سجل «طلباتي» في تطبيق الجوال."
    >
      <PageToolbar>
        <button
          type="button"
          className="ghost-btn toolbar-btn"
          onClick={() => void load()}
          disabled={loading}
          aria-busy={loading}
        >
          <ButtonBusyLabel busy={loading}>تحديث</ButtonBusyLabel>
        </button>
        <Link to="/student/courses" className="ghost-btn toolbar-btn">تصفح الدورات</Link>
        <Link to="/student/myfiles" className="ghost-btn toolbar-btn">الملفات</Link>
        <Link to="/student/mycourses" className="ghost-btn toolbar-btn">
          مقرراتي
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
            ? "كل الحالات"
            : statusFilter === "pending"
              ? "قيد المراجعة"
              : statusFilter === "approved"
                ? "المقبولة"
                : statusFilter === "rejected"
                  ? "المرفوضة"
                  : "المنتهية"}
        </button>
      </PageToolbar>
      <AppTabs
        groupId={`student-requests-${user.uid}`}
        ariaLabel="نوع الطلبات"
        value={typeFilter}
        onChange={(id) => setTypeFilter(id as "all" | "course" | "folder")}
        tabs={[
          { id: "all", label: "الكل" },
          { id: "course", label: "الدورات" },
          { id: "folder", label: "المجلدات" },
        ]}
      />
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {(
        [
          ["all", "الكل"] as const,
          ["course", "الدورات"] as const,
          ["folder", "المجلدات"] as const,
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
                <StatTile title="إجمالي الطلبات" highlight={panelRows.length} />
                <StatTile title="قيد المراجعة" highlight={panelRows.filter((r) => r.status === "pending").length} />
                <StatTile title="طلبات مقبولة" highlight={panelRows.filter((r) => r.status === "approved").length} />
                <StatTile
                  title="طلبات مرفوضة/منتهية"
                  highlight={panelRows.filter((r) => r.status === "rejected" || r.status === "expired").length}
                />
              </div>
            ) : null}
            {loading ? (
              <PageLoadHint />
            ) : panelRows.length === 0 ? (
              <EmptyState message="لا توجد طلبات انضمام حتى الآن." />
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
                          {r.targetName || (isFolder ? "مجلد" : "مقرر")}
                          <span className="meta-pill meta-pill--muted" style={{ marginInlineStart: "0.5rem" }}>
                            {isFolder ? "مجلد" : "مقرر"}
                          </span>
                        </h3>
                        <p className="muted post-meta small">
                          طُلب في {formatFirestoreTime(r.requestedAt)}
                          {r.processedAt != null ? ` · عُالج في ${formatFirestoreTime(r.processedAt)}` : null}
                        </p>
                        <p className="enrollment-req-badges" aria-label="الحالة">
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
                            {statusLabel(r.status)}
                          </span>
                          {inMy && r.status === "approved" ? (
                            <span className="meta-pill meta-pill--ok">ضمن «مقرراتي»</span>
                          ) : null}
                        </p>
                        {r.adminNotes && r.status !== "pending" ? (
                          <p className="muted small">ملاحظة الإدارة: {r.adminNotes}</p>
                        ) : null}
                        <div className="course-actions">
                          {r.status === "approved" || inMy ? (
                            <Link className="primary-btn" to={openHref}>
                              فتح
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
