import type { ReactNode } from "react";
import type { Lesson } from "../types";
import { looksLikeLessonHtml, sanitizeLessonHtml } from "../utils/lessonBodyFormat";
import { resolveVideoEmbed } from "../utils/lessonMedia";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  text: "نص",
  video: "فيديو",
  pdf: "PDF",
  audio: "صوت",
};

function lessonBodyText(lesson: Lesson): string {
  return String(lesson.txtContent ?? lesson.content ?? "").trim();
}

function VideoSection({ title, videoUrl }: { title: string; videoUrl: string }) {
  const { kind, embedSrc } = resolveVideoEmbed(videoUrl);
  if (kind === "file" && embedSrc) {
    return (
      <section className="lesson-media-block card-elevated" aria-label="فيديو الدرس">
        <h3 className="form-section-title lesson-section-label">مشغّل الفيديو</h3>
        <div className="lesson-video-file-wrap">
          <video className="lesson-video-file" controls playsInline src={embedSrc} preload="metadata" />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          فتح الرابط مباشرة
        </a>
        <p className="muted small">ملف فيديو مباشر (mp4 / webm / …).</p>
      </section>
    );
  }
  if ((kind === "youtube" || kind === "vimeo") && embedSrc) {
    return (
      <section className="lesson-media-block card-elevated" aria-label="فيديو الدرس">
        <h3 className="form-section-title lesson-section-label">
          {kind === "youtube" ? "فيديو (YouTube)" : "فيديو (Vimeo)"}
        </h3>
        <div className="lesson-youtube-embed" style={{ width: "100%", maxWidth: 900 }}>
          <iframe
            title={title}
            src={embedSrc}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          فتح في تبويب جديد
        </a>
      </section>
    );
  }
  return (
    <section className="lesson-media-block card-elevated" aria-label="رابط فيديو">
      <h3 className="form-section-title lesson-section-label">رابط الفيديو</h3>
      <p className="muted small">افتح الرابط في المتصفح إن لم يُضمَّن تلقائياً.</p>
      <a
        href={videoUrl}
        className="primary-btn lesson-external-fallback-btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        فتح رابط الفيديو
      </a>
    </section>
  );
}

function PdfSection({ pdfUrl }: { pdfUrl: string }) {
  return (
    <section className="lesson-media-block card-elevated" aria-label="مستند PDF">
      <h3 className="form-section-title lesson-section-label">مستند PDF</h3>
      <div className="lesson-pdf-frame-wrap">
        <iframe className="lesson-pdf-iframe" title="PDF" src={pdfUrl} />
      </div>
      <div className="lesson-file-toolbar">
        <a href={pdfUrl} className="ghost-btn lesson-file-btn" target="_blank" rel="noopener noreferrer">
          فتح في تبويب جديد
        </a>
        <a href={pdfUrl} className="ghost-btn lesson-file-btn" download>
          تنزيل
        </a>
      </div>
      <p className="muted small">إن لم تظهر المعاينة، استخدم «فتح في تبويب جديد».</p>
    </section>
  );
}

function AudioSection({ audioUrl }: { audioUrl: string }) {
  return (
    <section className="lesson-media-block card-elevated" aria-label="تسجيل صوتي">
      <h3 className="form-section-title lesson-section-label">تسجيل صوتي</h3>
      <audio className="lesson-audio-element" controls preload="metadata" src={audioUrl} />
      <a href={audioUrl} className="inline-link" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: "0.65rem" }}>
        فتح الرابط
      </a>
    </section>
  );
}

function TextSection({
  body,
  ct,
  typeLabel,
}: {
  body: string;
  ct: string;
  typeLabel: string;
}) {
  const useHtml = looksLikeLessonHtml(body);
  const html = useHtml ? sanitizeLessonHtml(body) : "";
  return (
    <section className="lesson-text-block card-elevated">
      <h3 className="form-section-title">
        {ct === "text" ? "نص الدرس" : "الشرح والملاحظات"}
        <span className="meta-pill meta-pill--muted lesson-type-pill">{typeLabel}</span>
      </h3>
      <div className="lesson-body lesson-body--flush">
        {useHtml ? (
          <div className="lesson-prose" dir="auto" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="lesson-pre">{body}</pre>
        )}
      </div>
    </section>
  );
}

/**
 * عرض محتوى الدرس بترتيب «النوع الأساسي» أولاً (مثل تطبيق الجوال) ثم باقي الوسائط والنص.
 */
export function LessonContentView({ lesson }: { lesson: Lesson }) {
  const body = lessonBodyText(lesson);
  const ctRaw = (lesson.contentType?.trim() || "text").toLowerCase();
  const typeLabel = CONTENT_TYPE_LABEL[ctRaw] ?? lesson.contentType ?? ctRaw;
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
      blocks.push(<VideoSection key="slot-video" title={lesson.title} videoUrl={lesson.videoUrl!} />);
    }
    if (k === "pdf" && hasPdf) {
      blocks.push(<PdfSection key="slot-pdf" pdfUrl={lesson.pdfUrl!} />);
    }
    if (k === "audio" && hasAudio) {
      blocks.push(<AudioSection key="slot-audio" audioUrl={lesson.audioUrl!} />);
    }
    if (k === "text" && hasText) {
      blocks.push(<TextSection key="slot-text" body={body} ct={ctRaw} typeLabel={typeLabel} />);
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

      {showVideoErr ? <p className="message error">مُعيّن كفيديو دون رابط فيديو.</p> : null}
      {showPdfErr ? <p className="message error">مُعيّن كـ PDF دون رابط للملف.</p> : null}
      {showAudioErr ? <p className="message error">مُعيّن كصوت دون رابط.</p> : null}
      {showTextErr ? <p className="message error">مُعيّن كنص ولا يوجد نص في الحقل.</p> : null}

      {empty ? (
        <div className="empty-state-card lesson-empty-content" style={{ maxWidth: "100%" }} role="status">
          <p className="muted" style={{ margin: 0 }}>
            لا يوجد محتوى مضاف (نص / فيديو / PDF / صوت). راجع الدرس من لوحة المشرف إن لزم.
          </p>
        </div>
      ) : null}
    </div>
  );
}
