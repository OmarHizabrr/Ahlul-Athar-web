import type { ReactNode } from "react";
import { AlertMessage, EmptyState, Panel, SectionTitle } from "./ui";
import type { Lesson } from "../types";
import { looksLikeLessonHtml, sanitizeLessonHtml } from "../utils/lessonBodyFormat";
import { resolveVideoEmbed } from "../utils/lessonMedia";
import { useI18n } from "../context/I18nContext";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  text: "نص",
  video: "فيديو",
  pdf: "PDF",
  audio: "صوت",
};

function lessonBodyText(lesson: Lesson): string {
  return String(lesson.txtContent ?? lesson.content ?? "").trim();
}

function VideoSection({ title, videoUrl, tr }: { title: string; videoUrl: string; tr: (text: string) => string }) {
  const { kind, embedSrc } = resolveVideoEmbed(videoUrl);
  if (kind === "file" && embedSrc) {
    return (
      <Panel as="section" className="lesson-media-block" aria-label={tr("فيديو الدرس")}>
        <SectionTitle as="h3" className="lesson-section-label">
          {tr("مشغّل الفيديو")}
        </SectionTitle>
        <div className="lesson-video-file-wrap">
          <video className="lesson-video-file" controls playsInline src={embedSrc} preload="metadata" />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          {tr("فتح الرابط مباشرة")}
        </a>
        <p className="muted small">{tr("ملف فيديو مباشر (mp4 / webm / …).")}</p>
      </Panel>
    );
  }
  if ((kind === "youtube" || kind === "vimeo") && embedSrc) {
    return (
      <Panel as="section" className="lesson-media-block" aria-label={tr("فيديو الدرس")}>
        <SectionTitle as="h3" className="lesson-section-label">
          {kind === "youtube" ? tr("فيديو (YouTube)") : tr("فيديو (Vimeo)")}
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
          {tr("فتح في تبويب جديد")}
        </a>
      </Panel>
    );
  }
  return (
    <Panel as="section" className="lesson-media-block" aria-label={tr("رابط فيديو")}>
      <SectionTitle as="h3" className="lesson-section-label">
        {tr("رابط الفيديو")}
      </SectionTitle>
      <p className="muted small">{tr("افتح الرابط في المتصفح إن لم يُضمَّن تلقائياً.")}</p>
      <a
        href={videoUrl}
        className="primary-btn lesson-external-fallback-btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        {tr("فتح رابط الفيديو")}
      </a>
    </Panel>
  );
}

function PdfSection({ pdfUrl, tr }: { pdfUrl: string; tr: (text: string) => string }) {
  return (
    <Panel as="section" className="lesson-media-block" aria-label={tr("مستند PDF")}>
      <SectionTitle as="h3" className="lesson-section-label">
        {tr("مستند PDF")}
      </SectionTitle>
      <div className="lesson-pdf-frame-wrap">
        <iframe className="lesson-pdf-iframe" title={tr("مستند PDF")} src={pdfUrl} />
      </div>
      <div className="lesson-file-toolbar">
        <a href={pdfUrl} className="ghost-btn lesson-file-btn" target="_blank" rel="noopener noreferrer">
          {tr("فتح في تبويب جديد")}
        </a>
        <a href={pdfUrl} className="ghost-btn lesson-file-btn" download>
          {tr("تنزيل")}
        </a>
      </div>
      <p className="muted small">{tr("إن لم تظهر المعاينة، استخدم «فتح في تبويب جديد».")}</p>
    </Panel>
  );
}

function AudioSection({ audioUrl, tr }: { audioUrl: string; tr: (text: string) => string }) {
  return (
    <Panel as="section" className="lesson-media-block" aria-label={tr("تسجيل صوتي")}>
      <SectionTitle as="h3" className="lesson-section-label">
        {tr("تسجيل صوتي")}
      </SectionTitle>
      <audio className="lesson-audio-element" controls preload="metadata" src={audioUrl} />
      <a href={audioUrl} className="inline-link" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: "0.65rem" }}>
        {tr("فتح الرابط")}
      </a>
    </Panel>
  );
}

function TextSection({
  body,
  ct,
  typeLabel,
  tr,
}: {
  body: string;
  ct: string;
  typeLabel: string;
  tr: (text: string) => string;
}) {
  const useHtml = looksLikeLessonHtml(body);
  const html = useHtml ? sanitizeLessonHtml(body) : "";
  return (
    <Panel as="section" className="lesson-text-block">
      <SectionTitle as="h3">
        {ct === "text" ? tr("نص الدرس") : tr("الشرح والملاحظات")}{" "}
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
  const { tr } = useI18n();
  const body = lessonBodyText(lesson);
  const ctRaw = (lesson.contentType?.trim() || "text").toLowerCase();
  const typeLabel = tr(CONTENT_TYPE_LABEL[ctRaw] ?? lesson.contentType ?? ctRaw);
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
      blocks.push(<VideoSection key="slot-video" title={lesson.title} videoUrl={lesson.videoUrl!} tr={tr} />);
    }
    if (k === "pdf" && hasPdf) {
      blocks.push(<PdfSection key="slot-pdf" pdfUrl={lesson.pdfUrl!} tr={tr} />);
    }
    if (k === "audio" && hasAudio) {
      blocks.push(<AudioSection key="slot-audio" audioUrl={lesson.audioUrl!} tr={tr} />);
    }
    if (k === "text" && hasText) {
      blocks.push(<TextSection key="slot-text" body={body} ct={ctRaw} typeLabel={typeLabel} tr={tr} />);
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

      {showVideoErr ? <AlertMessage kind="error">{tr("مُعيّن كفيديو دون رابط فيديو.")}</AlertMessage> : null}
      {showPdfErr ? <AlertMessage kind="error">{tr("مُعيّن كـ PDF دون رابط للملف.")}</AlertMessage> : null}
      {showAudioErr ? <AlertMessage kind="error">{tr("مُعيّن كصوت دون رابط.")}</AlertMessage> : null}
      {showTextErr ? <AlertMessage kind="error">{tr("مُعيّن كنص ولا يوجد نص في الحقل.")}</AlertMessage> : null}

      {empty ? (
        <EmptyState
          className="lesson-empty-content"
          message={tr("لا يوجد محتوى مضاف (نص / فيديو / PDF / صوت). راجع الدرس من لوحة المشرف إن لزم.")}
        />
      ) : null}
    </div>
  );
}
