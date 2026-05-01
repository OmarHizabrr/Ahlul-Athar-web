import type { UserRole } from "../types";

/** يتوافق مع مستند users القادم من الويب أو تطبيق Flutter (role / isAdmin). */
export function roleFromUserDoc(data: Record<string, unknown> | undefined | null): UserRole {
  if (!data) return "student";
  if (data.isAdmin === true) return "admin";
  const r = data.role;
  if (typeof r === "string" && r.toLowerCase() === "admin") return "admin";
  return "student";
}
