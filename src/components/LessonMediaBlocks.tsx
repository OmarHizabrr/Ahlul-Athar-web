import { Panel, SectionTitle } from "./ui";
import { resolveVideoEmbed } from "../utils/lessonMedia";

export type LessonMediaTFn = (key: string, fallback?: string) => string;

/** كتلة فيديو (YouTube / Vimeo / ملف مباشر / رابط خارجي) — تُستعمل في محتوى الدرس ومرفقات Firestore. */
export function LessonVideoBlock({ title, videoUrl, t }: { title: string; videoUrl: string; t: LessonMediaTFn }) {
  const { kind, embedSrc } = resolveVideoEmbed(videoUrl);
  if (kind === "file" && embedSrc) {
    return (
      <Panel as="section" className="lesson-media-block" aria-label={t("web_pages.lesson_content.video_block_aria", "فيديو الدرس")}>
        <SectionTitle as="h3" className="lesson-section-label">
          {t("web_pages.lesson_content.video_player", "مشغّل الفيديو")}
        </SectionTitle>
        <div className="lesson-video-file-wrap">
          <video className="lesson-video-file" controls playsInline src={embedSrc} preload="metadata" />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          {t("web_pages.lesson_content.open_link_direct", "فتح الرابط مباشرة")}
        </a>
        <p className="muted small">{t("web_pages.lesson_content.video_file_hint", "ملف فيديو مباشر (mp4 / webm / …).")}</p>
      </Panel>
    );
  }
  if ((kind === "youtube" || kind === "vimeo") && embedSrc) {
    return (
      <Panel as="section" className="lesson-media-block" aria-label={t("web_pages.lesson_content.video_block_aria", "فيديو الدرس")}>
        <SectionTitle as="h3" className="lesson-section-label">
          {kind === "youtube"
            ? t("web_pages.lesson_content.video_youtube", "فيديو (YouTube)")
            : t("web_pages.lesson_content.video_vimeo", "فيديو (Vimeo)")}
        </SectionTitle>
        <div className="lesson-youtube-embed" style={{ width: "100%", maxWidth: 900 }}>
          <iframe
            title={title}
            src={embedSrc}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          {t("web_pages.lesson_content.open_new_tab", "فتح في تبويب جديد")}
        </a>
      </Panel>
    );
  }
  return (
    <Panel as="section" className="lesson-media-block" aria-label={t("web_pages.lesson_content.video_link_aria", "رابط فيديو")}>
      <SectionTitle as="h3" className="lesson-section-label">
        {t("web_pages.lesson_content.video_url_title", "رابط الفيديو")}
      </SectionTitle>
      <p className="muted small">{t("web_pages.lesson_content.video_fallback_hint", "افتح الرابط في المتصفح إن لم يُضمَّن تلقائياً.")}</p>
      <a href={videoUrl} className="primary-btn lesson-external-fallback-btn" target="_blank" rel="noopener noreferrer">
        {t("web_pages.lesson_content.open_video_link", "فتح رابط الفيديو")}
      </a>
    </Panel>
  );
}

export function LessonPdfBlock({ pdfUrl, t }: { pdfUrl: string; t: LessonMediaTFn }) {
  const pdfTitle = t("web_pages.lesson_content.pdf_title", "مستند PDF");
  return (
    <Panel as="section" className="lesson-media-block" aria-label={t("web_pages.lesson_content.pdf_aria", "مستند PDF")}>
      <SectionTitle as="h3" className="lesson-section-label">
        {pdfTitle}
      </SectionTitle>
      <div className="lesson-pdf-frame-wrap">
        <iframe className="lesson-pdf-iframe" title={pdfTitle} src={pdfUrl} />
      </div>
      <div className="lesson-file-toolbar">
        <a href={pdfUrl} className="ghost-btn lesson-file-btn" target="_blank" rel="noopener noreferrer">
          {t("web_pages.lesson_content.open_new_tab", "فتح في تبويب جديد")}
        </a>
        <a href={pdfUrl} className="ghost-btn lesson-file-btn" download>
          {t("web_pages.lesson_content.download", "تنزيل")}
        </a>
      </div>
      <p className="muted small">{t("web_pages.lesson_content.pdf_hint", "إن لم تظهر المعاينة، استخدم «فتح في تبويب جديد».")}</p>
    </Panel>
  );
}

export function LessonAudioBlock({ audioUrl, t }: { audioUrl: string; t: LessonMediaTFn }) {
  return (
    <Panel as="section" className="lesson-media-block" aria-label={t("web_pages.lesson_content.audio_aria", "تسجيل صوتي")}>
      <SectionTitle as="h3" className="lesson-section-label">
        {t("web_pages.lesson_content.audio_title", "تسجيل صوتي")}
      </SectionTitle>
      <audio className="lesson-audio-element" controls preload="metadata" src={audioUrl} />
      <a href={audioUrl} className="inline-link" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: "0.65rem" }}>
        {t("web_pages.lesson_content.open_link", "فتح الرابط")}
      </a>
    </Panel>
  );
}
