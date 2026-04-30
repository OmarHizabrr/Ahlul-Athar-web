import { resolveVideoEmbed } from "../utils/lessonMedia";
import { useI18n } from "../context/I18nContext";

type VideoIntroBlockProps = {
  mediaUrl: string;
  /** label للوصولية في iframe */
  title?: string;
  /** عرض أضيق داخل نماذج الإدارة */
  compact?: boolean;
};

/** معاينة رابط فيديو الاختبار/الوسيط — YouTube / Vimeo / ملف مباشر / رابط خارجي. */
export function VideoIntroBlock({ mediaUrl, title, compact }: VideoIntroBlockProps) {
  const { tr } = useI18n();
  const frameTitle = title ?? tr("مقطع فيديو");
  const trimmed = mediaUrl.trim();
  if (!trimmed) {
    return null;
  }
  const { kind, embedSrc } = resolveVideoEmbed(trimmed);
  const wrapClass = `quiz-media-block${compact ? " video-intro-block--compact" : ""}`;

  if (kind === "file" && embedSrc) {
    return (
      <div className={wrapClass}>
        <div className="quiz-video-file-wrap">
          <video className="lesson-video-file" controls playsInline src={embedSrc} preload="metadata" />
        </div>
        <a className="inline-link" href={trimmed} target="_blank" rel="noopener noreferrer">
          {tr("فتح الرابط")}
        </a>
      </div>
    );
  }
  if ((kind === "youtube" || kind === "vimeo") && embedSrc) {
    return (
      <div className={wrapClass}>
        <div className="quiz-video-embed">
          <iframe
            title={frameTitle}
            src={embedSrc}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <a className="inline-link" href={trimmed} target="_blank" rel="noopener noreferrer">
          {tr("فتح في تبويب جديد")}
        </a>
      </div>
    );
  }
  return (
    <div className={wrapClass}>
      <a className="primary-btn lesson-external-fallback-btn" href={trimmed} target="_blank" rel="noopener noreferrer">
        {tr("فتح رابط المقطع")}
      </a>
      <p className="muted small">{tr("رابط غير قابل للتضمين التلقائي — يُفتح في المتصفح.")}</p>
    </div>
  );
}
