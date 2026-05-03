import type { ReactNode } from "react";
import { AlertMessage, EmptyState, Panel, SectionTitle } from "./ui";
import { LessonAudioBlock, LessonPdfBlock, LessonVideoBlock } from "./LessonMediaBlocks";
import type { Lesson } from "../types";
import { looksLikeLessonHtml, sanitizeLessonHtml } from "../utils/lessonBodyFormat";
import { useI18n } from "../context/I18nContext";
import { lessonContentTypeLabel } from "../utils/lessonContentTypeLabel";

function lessonBodyText(lesson: Lesson): string {
  return String(lesson.txtContent ?? lesson.content ?? "").trim();
}

type TFn = (key: string, fallback?: string) => string;

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
      blocks.push(<LessonVideoBlock key="slot-video" title={lesson.title} videoUrl={lesson.videoUrl!} t={t} />);
    }
    if (k === "pdf" && hasPdf) {
      blocks.push(<LessonPdfBlock key="slot-pdf" pdfUrl={lesson.pdfUrl!} t={t} />);
    }
    if (k === "audio" && hasAudio) {
      blocks.push(<LessonAudioBlock key="slot-audio" audioUrl={lesson.audioUrl!} t={t} />);
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
