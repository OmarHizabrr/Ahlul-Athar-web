/** Labels primary lesson content types for web UI (keys under web_pages.student_course_view). */
export function lessonContentTypeLabel(
  raw: string | undefined,
  t: (key: string, fallback?: string) => string,
): string {
  const trimmed = raw?.trim();
  if (!trimmed) return t("web_shell.dash_em", "—");
  const key = trimmed.toLowerCase();
  switch (key) {
    case "text":
      return t("web_pages.student_course_view.ctype_text", "نص");
    case "video":
      return t("web_pages.student_course_view.ctype_video", "فيديو");
    case "pdf":
      return t("web_pages.student_course_view.ctype_pdf", "PDF");
    case "audio":
      return t("web_pages.student_course_view.ctype_audio", "صوت");
    default:
      return trimmed;
  }
}
