import type { EnrollmentRequest } from "../../types";

type TFn = (key: string, fallback?: string) => string;

export function requestStatusLabel(status: EnrollmentRequest["status"], t: TFn): string {
  switch (status) {
    case "pending":
      return t("web_shell.req_status_pending", "معلّق");
    case "approved":
      return t("web_shell.req_status_approved", "مقبول");
    case "rejected":
      return t("web_shell.req_status_rejected", "مرفوض");
    case "expired":
      return t("web_shell.req_status_expired", "منتهي الصلاحية");
    default:
      return status;
  }
}

export function emptyRequestsMessage(filter: "all" | EnrollmentRequest["status"], t: TFn): string {
  switch (filter) {
    case "pending":
      return t("web_shell.empty_req_pending", "لا توجد طلبات معلّقة.");
    case "approved":
      return t("web_shell.empty_req_approved", "لا توجد طلبات مقبولة في هذا العرض.");
    case "rejected":
      return t("web_shell.empty_req_rejected", "لا توجد طلبات مرفوضة في هذا العرض.");
    case "expired":
      return t("web_shell.empty_req_expired", "لا توجد طلبات منتهية في هذا العرض.");
    case "all":
      return t("web_shell.empty_req_all", "لا توجد أي طلبات انضمام حتى الآن.");
    default:
      return t("web_shell.empty_req_default", "لا توجد طلبات.");
  }
}
