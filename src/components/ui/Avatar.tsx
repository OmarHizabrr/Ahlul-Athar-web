import { cn } from "../../utils/cn";

function initialsFromName(displayName: string | null | undefined, email: string | null | undefined): string {
  const s = (displayName || email || "?").trim();
  if (!s) {
    return "?";
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }
  return s.charAt(0)!.toUpperCase();
}

/**
 * صورة مستخدم موحّدة مع fallback أحرف أولى.
 */
export function Avatar({
  photoURL,
  displayName,
  email,
  alt = "",
  imageClassName,
  fallbackClassName,
  size,
}: {
  photoURL?: string | null;
  displayName?: string | null;
  email?: string | null;
  alt?: string;
  imageClassName: string;
  fallbackClassName: string;
  size?: number;
}) {
  const src = typeof photoURL === "string" ? photoURL.trim() : "";
  if (src) {
    return (
      <img
        className={imageClassName}
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div className={cn(fallbackClassName)} aria-hidden>
      {initialsFromName(displayName, email)}
    </div>
  );
}
