import type { EnrollmentRequest } from "../../types";

export function requestStatusLabel(status: EnrollmentRequest["status"]): string {
  switch (status) {
    case "pending":
      return "معلّق";
    case "approved":
      return "مقبول";
    case "rejected":
      return "مرفوض";
    case "expired":
      return "منتهي الصلاحية";
    default:
      return status;
  }
}

export function emptyRequestsMessage(filter: "all" | EnrollmentRequest["status"]): string {
  switch (filter) {
    case "pending":
      return "لا توجد طلبات معلّقة.";
    case "approved":
      return "لا توجد طلبات مقبولة في هذا العرض.";
    case "rejected":
      return "لا توجد طلبات مرفوضة في هذا العرض.";
    case "expired":
      return "لا توجد طلبات منتهية في هذا العرض.";
    case "all":
      return "لا توجد أي طلبات انضمام حتى الآن.";
    default:
      return "لا توجد طلبات.";
  }
}
