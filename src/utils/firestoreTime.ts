/**
 * تنسيق طوابع زمنية من Firestore (Timestamp) أو تاريخات JavaScript.
 */
export function formatFirestoreTime(value: unknown, locale = "ar-SA"): string {
  if (value == null) {
    return "—";
  }
  if (value instanceof Date) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return formatFirestoreTime((value as { toDate: () => Date }).toDate(), locale);
  }
  if (typeof value === "number") {
    return formatFirestoreTime(new Date(value), locale);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatFirestoreTime(parsed, locale);
    }
  }
  return "—";
}
