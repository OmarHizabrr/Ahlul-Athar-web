import type { Lesson } from "../types";
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
        <h3 className="form-section-title">مشغّل الفيديو</h3>
        <div className="lesson-video-file-wrap">
          <video className="lesson-video-file" controls playsInline src={embedSrc} preload="metadata" />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          فتح الرابط مباشرة
        </a>
        <p className="muted small">ملف فيديو مباشر (mp4 / webm / …) كما في تخزين السحابة.</p>
      </section>
    );
  }
  if ((kind === "youtube" || kind === "vimeo") && embedSrc) {
    return (
      <section className="lesson-media-block card-elevated" aria-label="فيديو الدرس">
        <h3 className="form-section-title">{kind === "youtube" ? "فيديو (YouTube)" : "فيديو (Vimeo)"}</h3>
        <div className="lesson-youtube-embed" style={{ width: "100%", maxWidth: 900 }}>
          <iframe title={title} src={embedSrc} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
        <a href={videoUrl} className="inline-link" target="_blank" rel="noopener noreferrer">
          فتح في تبويب جديد
        </a>
        {kind === "youtube" ? (
          <p className="muted small">YouTube/Shorts يُضمّن تلقائياً.</p>
        ) : null}
      </section>
    );
  }
  return (
    <section className="lesson-media-block card-elevated" aria-label="رابط فيديو">
      <h3 className="form-section-title">رابط الفيديو</h3>
      <p className="muted small">
        لم يُعرف نمط الربط (YouTube / Vimeo / ملف). افتح الرابط في المتصفح — قد يعمل التشغيل حسب الموقع.
      </p>
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
      <h3 className="form-section-title">مستند PDF</h3>
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
      <p className="muted small">إن لم يظهر المعاين، جرّب «فتح في تبويب جديد» (صلاحيات التخزين/المتصفح).</p>
    </section>
  );
}

function AudioSection({ audioUrl }: { audioUrl: string }) {
  return (
    <section className="lesson-media-block card-elevated" aria-label="تسجيل صوتي">
      <h3 className="form-section-title">تسجيل صوتي</h3>
      <audio className="lesson-audio-element" controls preload="metadata" src={audioUrl} />
      <a href={audioUrl} className="inline-link" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: "0.65rem" }}>
        فتح الرابط
      </a>
    </section>
  );
}

/**
 * عرض محتوى الدرس: فيديو (يوتيوب / فيميو / مباشر) + PDF + صوت + نص — مثل تدفق عرض الدرس في تطبيق الجوال.
 */
export function LessonContentView({ lesson }: { lesson: Lesson }) {
  const body = lessonBodyText(lesson);
  const ct = lesson.contentType?.trim() || "text";
  const typeLabel = CONTENT_TYPE_LABEL[ct] ?? ct;

  const hasVideo = Boolean(lesson.videoUrl?.trim());
  const hasPdf = Boolean(lesson.pdfUrl?.trim());
  const hasAudio = Boolean(lesson.audioUrl?.trim());
  const hasText = body.length > 0;

  return (
    <div className="lesson-content-stack">
      {hasVideo ? <VideoSection title={lesson.title} videoUrl={lesson.videoUrl!} /> : null}

      {lesson.contentType === "video" && !hasVideo ? (
        <p className="message error">مُعيّن كفيديو دون رابط — أضف رابط الفيديو من إدارة الدرس.</p>
      ) : null}

      {hasPdf ? <PdfSection pdfUrl={lesson.pdfUrl!} /> : null}
      {lesson.contentType === "pdf" && !hasPdf ? (
        <p className="message error">مُعيّن كـ PDF دون رابط — أضف رابط الملف.</p>
      ) : null}

      {hasAudio ? <AudioSection audioUrl={lesson.audioUrl!} /> : null}
      {lesson.contentType === "audio" && !hasAudio ? (
        <p className="message error">مُعيّن كصوت دون رابط — أضف رابط الملف.</p>
      ) : null}

      {hasText ? (
        <section className="lesson-text-block card-elevated">
          <h3 className="form-section-title">
            {ct === "text" ? "نص الدرس" : "ملاحظات ونص مرفق"}
            <span className="meta-pill meta-pill--muted lesson-type-pill">{typeLabel}</span>
          </h3>
          <div className="lesson-body">
            <pre className="lesson-pre">{body}</pre>
          </div>
        </section>
      ) : null}

      {ct === "text" && !hasText ? <p className="message error">مُعيّن كنص ولا يوجد محتوى نصي.</p> : null}

      {!hasVideo && !hasPdf && !hasAudio && !hasText ? (
        <div className="empty-state-card lesson-empty-content" style={{ maxWidth: "100%" }} role="status">
          <p className="muted" style={{ margin: 0 }}>
            لا يوجد محتوى مرفوع لهذا الدرس بعد (نص / فيديو / PDF / صوت). يمكن للإدارة إضافته من «دروس المقرر».
          </p>
        </div>
      ) : null}
    </div>
  );
}
