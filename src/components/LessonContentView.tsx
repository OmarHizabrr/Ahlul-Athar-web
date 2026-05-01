import type { ReactNode } from "react";
import { AlertMessage, EmptyState, Panel, SectionTitle } from "./ui";
import type { Lesson } from "../types";
import { looksLikeLessonHtml, sanitizeLessonHtml } from "../utils/lessonBodyFormat";
import { resolveVideoEmbed } from "../utils/lessonMedia";
import { useI18n } from "../context/I18nContext";
import { lessonContentTypeLabel } from "../utils/lessonContentTypeLabel";

function lessonBodyText(lesson: Lesson): string {
  return String(lesson.txtContent ?? lesson.content ?? "").trim();
}

type TFn = (key: string, fallback?: string) => string;

function VideoSection({ title, videoUrl, t }: { title: string; videoUrl: string; t: TFn }) {
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
      <a
        href={videoUrl}
        className="primary-btn lesson-external-fallback-btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("web_pages.lesson_content.open_video_link", "فتح رابط الفيديو")}
      </a>
    </Panel>
  );
}

function PdfSection({ pdfUrl, t }: { pdfUrl: string; t: TFn }) {
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

function AudioSection({ audioUrl, t }: { audioUrl: string; t: TFn }) {
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

function TextSection({
  body,
  ct,
  typeLabel,
  t,
}: {
  body: string;
  ct: string;
  typeLabel: string;
  t: TFn;
}) {
  const useHtml = looksLikeLessonHtml(body);
  const html = useHtml ? sanitizeLessonHtml(body) : "";
  return (
    <Panel as="section" className="lesson-text-block">
      <SectionTitle as="h3">
        {ct === "text"
          ? t("web_pages.lesson_content.text_body", "نص الدرس")
          : t("web_pages.lesson_content.text_notes", "الشرح والملاحظات")}{" "}
        <span className="meta-pill meta-pill--muted lesson-type-pill">{typeLabel}</span>
      </SectionTitle>
      <div className="lesson-body lesson-body--flush">
        {useHtml ? (
          <div className="lesson-prose" dir="auto" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="lesson-pre">{body}</pre>
        )}
      </div>
    </Panel>
  );
}

/**
 * عرض محتوى الدرس بترتيب «النوع الأساسي» أولاً (مثل تطبيق الجوال) ثم باقي الوسائط والنص.
 */
export function LessonContentView({ lesson }: { lesson: Lesson }) {
  const { t } = useI18n();
  const body = lessonBodyText(lesson);
  const ctRaw = (lesson.contentType?.trim() || "text").toLowerCase();
  const typeLabel = lessonContentTypeLabel(lesson.contentType, t);
  const primary: "video" | "pdf" | "audio" | "text" =
    ctRaw === "video" || ctRaw === "pdf" || ctRaw === "audio" || ctRaw === "text" ? ctRaw : "text";

  const hasVideo = Boolean(lesson.videoUrl?.trim());
  const hasPdf = Boolean(lesson.pdfUrl?.trim());
  const hasAudio = Boolean(lesson.audioUrl?.trim());
  const hasText = body.length > 0;

  const order: Array<"video" | "pdf" | "audio" | "text"> = [
    primary,
    ...(["video", "pdf", "audio", "text"] as const).filter((k) => k !== primary),
  ];

  const blocks: ReactNode[] = [];
  for (const k of order) {
    if (k === "video" && hasVideo) {
      blocks.push(<VideoSection key="slot-video" title={lesson.title} videoUrl={lesson.videoUrl!} t={t} />);
    }
    if (k === "pdf" && hasPdf) {
      blocks.push(<PdfSection key="slot-pdf" pdfUrl={lesson.pdfUrl!} t={t} />);
    }
    if (k === "audio" && hasAudio) {
      blocks.push(<AudioSection key="slot-audio" audioUrl={lesson.audioUrl!} t={t} />);
    }
    if (k === "text" && hasText) {
      blocks.push(<TextSection key="slot-text" body={body} ct={ctRaw} typeLabel={typeLabel} t={t} />);
    }
  }

  const showVideoErr = ctRaw === "video" && !hasVideo;
  const showPdfErr = ctRaw === "pdf" && !hasPdf;
  const showAudioErr = ctRaw === "audio" && !hasAudio;
  const showTextErr = ctRaw === "text" && !hasText;
  const empty = !hasVideo && !hasPdf && !hasAudio && !hasText;

  return (
    <div className="lesson-content-stack">
      {blocks}

      {showVideoErr ? (
        <AlertMessage kind="error">{t("web_pages.lesson_content.err_video", "مُعيّن كفيديو دون رابط فيديو.")}</AlertMessage>
      ) : null}
      {showPdfErr ? (
        <AlertMessage kind="error">{t("web_pages.lesson_content.err_pdf", "مُعيّن كـ PDF دون رابط للملف.")}</AlertMessage>
      ) : null}
      {showAudioErr ? (
        <AlertMessage kind="error">{t("web_pages.lesson_content.err_audio", "مُعيّن كصوت دون رابط.")}</AlertMessage>
      ) : null}
      {showTextErr ? (
        <AlertMessage kind="error">{t("web_pages.lesson_content.err_text", "مُعيّن كنص ولا يوجد نص في الحقل.")}</AlertMessage>
      ) : null}

      {empty ? (
        <EmptyState
          className="lesson-empty-content"
          message={t(
            "web_pages.lesson_content.empty",
            "لا يوجد محتوى مضاف (نص / فيديو / PDF / صوت). راجع الدرس من لوحة المشرف إن لزم.",
          )}
        />
      ) : null}
    </div>
  );
}
