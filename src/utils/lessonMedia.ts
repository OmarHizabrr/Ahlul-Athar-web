import { getYoutubeEmbedUrlFromWatchUrl } from "./youtube";

/** رابط مباشر لملف فيديو شائع (ليس YouTube). */
export function isDirectVideoFileUrl(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }
  const u = url.trim().toLowerCase();
  return /\.(mp4|webm|ogv|ogg|m3u8|mov)(\?|#|$)/i.test(u);
}

/**
 * تضمين Vimeo — `vimeo.com/123456` أو `player.vimeo.com/...`
 */
export function getVimeoEmbedFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const path = u.pathname;
      const m =
        path.match(/\/(\d{4,})/) ??
        path.match(/\/video\/(\d{4,})/) ??
        (host === "player.vimeo.com" ? path.match(/\/video\/(\d{4,})/) : null);
      const id = m?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type VideoEmbedKind = "youtube" | "vimeo" | "file" | "external";

export function resolveVideoEmbed(url: string): { kind: VideoEmbedKind; embedSrc: string | null } {
  const yt = getYoutubeEmbedUrlFromWatchUrl(url);
  if (yt) {
    return { kind: "youtube", embedSrc: yt };
  }
  const vm = getVimeoEmbedFromUrl(url);
  if (vm) {
    return { kind: "vimeo", embedSrc: vm };
  }
  if (isDirectVideoFileUrl(url)) {
    return { kind: "file", embedSrc: url.trim() };
  }
  return { kind: "external", embedSrc: null };
}
