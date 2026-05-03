import {
  IoDocumentTextOutline,
  IoImageOutline,
  IoLinkOutline,
  IoMusicalNotesOutline,
  IoOpenOutline,
  IoVideocamOutline,
} from "react-icons/io5";
import { Panel, SectionTitle } from "./ui";
import { LessonAudioBlock, LessonPdfBlock, LessonVideoBlock } from "./LessonMediaBlocks";
import type { LessonAttachment } from "../types";
import { useI18n } from "../context/I18nContext";

function attachmentTypeLabel(type: string, t: (k: string, f?: string) => string): string {
  switch (type) {
    case "pdf":
      return t("web_pages.lesson_attachments.type_pdf", "PDF");
    case "video":
      return t("web_pages.lesson_attachments.type_video", "فيديو");
    case "audio":
      return t("web_pages.lesson_attachments.type_audio", "صوت");
    case "document":
      return t("web_pages.lesson_attachments.type_document", "مستند");
    case "image":
      return t("web_pages.lesson_attachments.type_image", "صورة");
    case "presentation":
      return t("web_pages.lesson_attachments.type_presentation", "عرض تقديمي");
    case "spreadsheet":
      return t("web_pages.lesson_attachments.type_spreadsheet", "جدول");
    default:
      return t("web_pages.lesson_attachments.type_link", "رابط");
  }
}

function looksPdfUrl(url: string): boolean {
  const u = url.toLowerCase();
  return /\.pdf(\?|#|$)/i.test(u) || u.includes("application/pdf") || u.includes("drive.google.com") && u.includes("/preview");
}

function AttachmentTypeIcon({ type }: { type: string }) {
  const cls = "lesson-attach-type-icon";
  switch (type) {
    case "pdf":
      return <IoDocumentTextOutline className={cls} aria-hidden size={22} />;
    case "video":
      return <IoVideocamOutline className={cls} aria-hidden size={22} />;
    case "audio":
      return <IoMusicalNotesOutline className={cls} aria-hidden size={22} />;
    case "image":
      return <IoImageOutline className={cls} aria-hidden size={22} />;
    case "document":
    case "presentation":
    case "spreadsheet":
      return <IoDocumentTextOutline className={cls} aria-hidden size={22} />;
    default:
      return <IoLinkOutline className={cls} aria-hidden size={22} />;
  }
}

function LinkFallbackBlock({ url, t }: { url: string; t: (k: string, f?: string) => string }) {
  return (
    <Panel as="section" className="lesson-media-block lesson-attach-link-block">
      <SectionTitle as="h3" className="lesson-section-label">
        {t("web_pages.lesson_attachments.open_resource", "فتح المورد")}
      </SectionTitle>
      <p className="muted small lesson-attach-url-line" dir="ltr">
        {url}
      </p>
      <a href={url} className="primary-btn lesson-external-fallback-btn" target="_blank" rel="noopener noreferrer">
        <IoOpenOutline aria-hidden style={{ marginInlineEnd: "0.35rem", verticalAlign: "middle" }} />
        {t("web_pages.lesson_attachments.open_in_browser", "فتح في المتصفح")}
      </a>
    </Panel>
  );
}

function AttachmentCard({ a }: { a: LessonAttachment }) {
  const { t } = useI18n();
  const typeNorm = (a.type || "link").toLowerCase();
  const label = attachmentTypeLabel(typeNorm, t);
  const url = a.url?.trim() ?? "";

  const renderMedia = () => {
    if (!url) {
      return (
        <p className="muted small" role="alert">
          {t("web_pages.lesson_attachments.missing_url", "لا يوجد رابط لهذا المرفق.")}
        </p>
      );
    }
    if (typeNorm === "video") {
      return <LessonVideoBlock title={a.title} videoUrl={url} t={t} />;
    }
    if (typeNorm === "pdf" || (typeNorm === "document" && looksPdfUrl(url))) {
      return <LessonPdfBlock pdfUrl={url} t={t} />;
    }
    if (typeNorm === "audio") {
      return <LessonAudioBlock audioUrl={url} t={t} />;
    }
    if (typeNorm === "image") {
      return (
        <Panel as="section" className="lesson-media-block">
          <SectionTitle as="h3" className="lesson-section-label">
            {t("web_pages.lesson_attachments.image_preview", "معاينة الصورة")}
          </SectionTitle>
          <div className="lesson-attach-image-wrap">
            <img src={url} alt={a.title} className="lesson-attach-image" loading="lazy" decoding="async" />
          </div>
          <div className="lesson-file-toolbar">
            <a href={url} className="ghost-btn lesson-file-btn" target="_blank" rel="noopener noreferrer">
              {t("web_pages.lesson_content.open_new_tab", "فتح في تبويب جديد")}
            </a>
          </div>
        </Panel>
      );
    }
    return <LinkFallbackBlock url={url} t={t} />;
  };

  return (
    <article className="lesson-attach-card">
      <header className="lesson-attach-card-head">
        <span
          className={`lesson-attach-type-badge lesson-attach-type-badge--${
            ["pdf", "video", "audio", "image", "document", "presentation", "spreadsheet"].includes(typeNorm) ? typeNorm : "link"
          }`}
        >
          <AttachmentTypeIcon type={typeNorm} />
          <span>{label}</span>
        </span>
        <h4 className="lesson-attach-card-title">{a.title}</h4>
      </header>
      {a.description ? <p className="lesson-attach-desc muted small">{a.description}</p> : null}
      <div className="lesson-attach-card-body">{renderMedia()}</div>
    </article>
  );
}

export function LessonAttachmentsView({ items }: { items: LessonAttachment[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="lesson-attach-stack">
      {items.map((a) => (
        <AttachmentCard key={a.id} a={a} />
      ))}
    </div>
  );
}
