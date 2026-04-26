/** دمج أسماء الفئات — تخطي القيم الفارغة. */
export function cn(...parts: (string | undefined | null | false)[]): string {
  return parts.filter((p) => p && typeof p === "string").join(" ");
}
