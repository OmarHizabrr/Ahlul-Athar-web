import type { StudentRecord } from "../types";
import { formatFirestoreTime } from "./firestoreTime";

export function inferMemberLifetime(m: Pick<StudentRecord, "isLifetime" | "expiresAt">): boolean {
  if (m.isLifetime === false) return false;
  if (m.isLifetime === true) return true;
  const exp = m.expiresAt;
  return exp == null || String(exp).trim() === "";
}

export function inferActivationDaysForForm(m: StudentRecord): number {
  if (typeof m.activationDays === "number" && m.activationDays > 0) return m.activationDays;
  const expRaw = m.expiresAt;
  if (expRaw != null && String(expRaw).trim() !== "") {
    const exp = new Date(String(expRaw)).getTime();
    if (!Number.isNaN(exp)) {
      const d = Math.ceil((exp - Date.now()) / 86_400_000);
      return Math.max(1, d);
    }
  }
  return 30;
}

export function folderMemberAccessSummary(m: StudentRecord, t: (key: string, fallback?: string) => string): string {
  if (inferMemberLifetime(m)) {
    return t("web_pages.admin_folders.member_access_lifetime", "وصول: مدى الحياة");
  }
  const exp = m.expiresAt;
  if (exp != null && String(exp).trim() !== "") {
    return `${t("web_pages.admin_folders.member_access_until", "ينتهي الوصول")}: ${formatFirestoreTime(exp)}`;
  }
  const d = m.activationDays;
  if (typeof d === "number" && d > 0) {
    return `${t("web_pages.admin_folders.member_access_days", "مدة الوصول")}: ${d} ${t("web_pages.admin_folders.member_access_days_unit", "يومًا")}`;
  }
  return t("web_pages.admin_folders.member_access_unknown", "وصول: غير محدد");
}
