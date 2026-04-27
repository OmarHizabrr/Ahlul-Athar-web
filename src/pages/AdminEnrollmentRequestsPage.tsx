import { useEffect, useState } from "react";
import { AlertMessage } from "../components/ui";
import { DashboardLayout } from "./DashboardLayout";
import { coursesService } from "../services/coursesService";
import type { EnrollmentRequest } from "../types";
import { AdminEnrollmentRequestsPanel } from "./course/AdminEnrollmentRequestsPanel";
import { CourseActivationModal } from "./course/CourseActivationModal";

export function AdminEnrollmentRequestsPage() {
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestFilter, setRequestFilter] = useState<"all" | EnrollmentRequest["status"]>("pending");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationTarget, setActivationTarget] = useState<EnrollmentRequest | null>(null);
  const [isLifetimeActivation, setIsLifetimeActivation] = useState(true);
  const [activationDays, setActivationDays] = useState(30);

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const data = await coursesService.listCourseEnrollmentRequests(requestFilter);
      setRequests(data);
    } catch {
      setMessage("تعذر تحميل طلبات الالتحاق.");
      setIsError(true);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [requestFilter]);

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
      setIsError(false);
      setActivationOpen(false);
      setActivationTarget(null);
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
      await loadRequests();
    } catch {
      setMessage("تعذر رفض الطلب.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      role="admin"
      title="طلبات الالتحاق"
      lede="قسم مستقل لمراجعة طلبات انضمام الطلاب للمقررات، مطابق لتدفق التطبيق."
    >
      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
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
