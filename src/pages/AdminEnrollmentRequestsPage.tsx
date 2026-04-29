import { useEffect, useState } from "react";
import { AlertMessage } from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";
import { coursesService } from "../services/coursesService";
import { foldersService } from "../services/foldersService";
import type { EnrollmentRequest } from "../types";
import { AdminEnrollmentRequestsPanel } from "./course/AdminEnrollmentRequestsPanel";
import { CourseActivationModal } from "./course/CourseActivationModal";
import { useAuth } from "../context/AuthContext";
import { PageLoadHint } from "../components/ButtonBusyLabel";
import { Navigate } from "react-router-dom";

export function AdminEnrollmentRequestsPage() {
  const { user, ready } = useAuth();
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestFilter, setRequestFilter] = useState<"all" | EnrollmentRequest["status"]>("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | EnrollmentRequest["requestType"]>("all");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationTarget, setActivationTarget] = useState<EnrollmentRequest | null>(null);
  const [isLifetimeActivation, setIsLifetimeActivation] = useState(true);
  const [activationDays, setActivationDays] = useState(30);

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const data = await coursesService.listAnyEnrollmentRequests({ status: requestFilter, type: typeFilter });
      setRequests(data);
    } catch {
      setMessage("تعذر تحميل طلبات الالتحاق.");
      setIsError(true);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    if (ready && user) {
      void loadRequests();
    }
  }, [requestFilter, typeFilter, ready, user]);

  const openActivationDialog = (req: EnrollmentRequest) => {
    setActivationTarget(req);
    setIsLifetimeActivation(true);
    setActivationDays(30);
    setActivationOpen(true);
  };

  const confirmActivation = async () => {
    if (!activationTarget) {
      return;
    }
    setSubmitting(true);
    try {
      const expiresAt = isLifetimeActivation ? null : new Date(Date.now() + activationDays * 86_400_000);
      if (activationTarget.requestType === "folder") {
        await coursesService.approveFolderEnrollmentRequest(activationTarget, {
          isLifetime: isLifetimeActivation,
          days: activationDays,
          expiresAt,
        });
        const folder = await foldersService.getFolderById(activationTarget.targetId);
        if (!folder) {
          throw new Error("folder_not_found");
        }
        await foldersService.addMemberToFolder({
          folder,
          member: {
            uid: activationTarget.studentId,
            displayName: activationTarget.studentName,
            email: activationTarget.studentEmail,
            phone: activationTarget.studentPhone,
            photoURL: activationTarget.studentPhotoURL,
          },
          activation: { isLifetime: isLifetimeActivation, days: activationDays, expiresAt },
        });
        setMessage("تم قبول طلب المجلد وإضافة الطالب للأعضاء.");
      } else {
        const { alreadyEnrolled } = await coursesService.approveEnrollmentRequest(activationTarget, {
          isLifetime: isLifetimeActivation,
          days: activationDays,
          expiresAt,
        });
        setMessage(
          alreadyEnrolled
            ? "تم اعتماد الطلب وتحديث بيانات التفعيل. الطالب مسجل مسبقًا."
            : "تم قبول الطلب وإضافة الطالب للمقرر بنجاح.",
        );
      }
      setIsError(false);
      setActivationOpen(false);
      setActivationTarget(null);
      window.dispatchEvent(new CustomEvent("ah:enrollment-requests-updated"));
      await loadRequests();
    } catch {
      setMessage("تعذر قبول الطلب. تحقق من صلاحيات Firestore أو الفهارس.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const onRejectRequest = async (requestId: string) => {
    const reason = window.prompt("سبب الرفض (يُحفظ في ملاحظات الإدارة):", "");
    if (reason === null) {
      return;
    }
    setSubmitting(true);
    try {
      await coursesService.rejectEnrollmentRequest(requestId, reason.trim() || "مرفوض");
      setMessage("تم رفض الطلب وتسجيل الملاحظة.");
      setIsError(false);
      window.dispatchEvent(new CustomEvent("ah:enrollment-requests-updated"));
      await loadRequests();
    } catch {
      setMessage("تعذر رفض الطلب.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout
        role="admin"
        title="طلبات الالتحاق"
        lede="قسم مستقل لمراجعة طلبات انضمام الطلاب للمقررات والمجلدات، مطابق لتدفق التطبيق."
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
      role="admin"
      title="طلبات الالتحاق"
      lede="قسم مستقل لمراجعة طلبات انضمام الطلاب للمقررات والمجلدات، مطابق لتدفق التطبيق."
    >
      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
      <div className="request-filters admin-requests-filters">
        <button type="button" className={`${typeFilter === "all" ? "primary-btn" : "ghost-btn"} toolbar-btn`} onClick={() => setTypeFilter("all")} disabled={submitting || requestsLoading}>
          الكل
        </button>
        <button type="button" className={`${typeFilter === "course" ? "primary-btn" : "ghost-btn"} toolbar-btn`} onClick={() => setTypeFilter("course")} disabled={submitting || requestsLoading}>
          الدورات
        </button>
        <button type="button" className={`${typeFilter === "folder" ? "primary-btn" : "ghost-btn"} toolbar-btn`} onClick={() => setTypeFilter("folder")} disabled={submitting || requestsLoading}>
          المجلدات
        </button>
      </div>
      <AdminEnrollmentRequestsPanel
        requestFilter={requestFilter}
        onRequestFilterChange={setRequestFilter}
        requests={requests}
        requestsLoading={requestsLoading}
        submitting={submitting}
        onRefresh={loadRequests}
        onOpenActivation={openActivationDialog}
        onRejectRequest={(id) => void onRejectRequest(id)}
      />
      {activationOpen && activationTarget ? (
        <CourseActivationModal
          submitting={submitting}
          isLifetimeActivation={isLifetimeActivation}
          onLifetimeChange={setIsLifetimeActivation}
          activationDays={activationDays}
          onDaysChange={setActivationDays}
          onConfirm={confirmActivation}
          onClose={() => {
            setActivationOpen(false);
            setActivationTarget(null);
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}
