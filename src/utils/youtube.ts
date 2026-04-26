/** يحويل رابط YouTube/Shorts لصيغة embed آمنة للـ iframe. */
export function getYoutubeEmbedUrlFromWatchUrl(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === "m.youtube.com" || u.hostname === "www.youtube.com" || u.hostname === "youtube.com") {
      const v = u.searchParams.get("v");
      if (v) {
        return `https://www.youtube.com/embed/${v}`;
      }
      const p = u.pathname;
      if (p.startsWith("/shorts/")) {
        const id = p.split("/").filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}
