import { cn } from "../../utils/cn";

export type CoverImageVariant = "catalog" | "hero" | "thumb";

const frame: Record<CoverImageVariant, string> = {
  catalog: "mycourse-cover",
  hero: "course-hero-cover",
  thumb: "cover-image-thumb",
};

const img: Record<CoverImageVariant, string> = {
  catalog: "mycourse-cover-img",
  hero: "course-hero-img",
  thumb: "cover-image-thumb-img",
};

/**
 * غلاف بصری موحّد (كتالوج مقررات، بطاقة مقرر، رأس المقرر، تلميح مصغّر).
 * لا يُرسم شيئاً عندما يكون `src` فارغاً.
 */
export function CoverImage({
  src,
  alt = "",
  variant,
  className,
  imgClassName,
}: {
  src?: string | null;
  alt?: string;
  variant: CoverImageVariant;
  className?: string;
  imgClassName?: string;
}) {
  const s = typeof src === "string" ? src.trim() : "";
  if (!s) {
    return null;
  }
  const loading = variant === "hero" ? "eager" : "lazy";
  return (
    <div className={cn(frame[variant], className)} aria-hidden={!alt}>
      <img
        src={s}
        alt={alt}
        className={cn(img[variant], imgClassName)}
        loading={loading}
        decoding="async"
        fetchPriority={variant === "hero" ? "high" : undefined}
      />
    </div>
  );
}
