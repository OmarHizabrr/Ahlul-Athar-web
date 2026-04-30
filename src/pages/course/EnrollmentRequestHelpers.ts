import type { EnrollmentRequest } from "../../types";

export function requestStatusLabel(status: EnrollmentRequest["status"], tr: (s: string) => string): string {
  switch (status) {
    case "pending":
      return tr("معلّق");
    case "approved":
      return tr("مقبول");
    case "rejected":
      return tr("مرفوض");
    case "expired":
      return tr("منتهي الصلاحية");
    default:
      return status;
  }
}

export function emptyRequestsMessage(filter: "all" | EnrollmentRequest["status"], tr: (s: string) => string): string {
  switch (filter) {
    case "pending":
      return tr("لا توجد طلبات معلّقة.");
    case "approved":
      return tr("لا توجد طلبات مقبولة في هذا العرض.");
    case "rejected":
      return tr("لا توجد طلبات مرفوضة في هذا العرض.");
    case "expired":
      return tr("لا توجد طلبات منتهية في هذا العرض.");
    case "all":
      return tr("لا توجد أي طلبات انضمام حتى الآن.");
    default:
      return tr("لا توجد طلبات.");
  }
}
