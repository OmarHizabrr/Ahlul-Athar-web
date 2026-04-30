import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import JSZip from "jszip";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, ContentList, ContentListItem, EmptyState, PageToolbar, Panel, SectionTitle, StatTile } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { coursesService } from "../services/coursesService";
import { foldersService } from "../services/foldersService";
import type { Folder, FolderFile } from "../types";
import { formatFirestoreTime } from "../utils/firestoreTime";
import { triggerBrowserDownloadFromUrl } from "../utils/downloadFile";
import { DashboardLayout } from "./DashboardLayout";

function isPreviewable(file: FolderFile) {
  const t = file.fileType ?? "other";
  return t === "audio" || t === "video" || t === "image" || t === "pdf";
}

function formatSize(bytes?: number): string {
  if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function FilePreview({ file }: { file: FolderFile }) {
  const t = file.fileType ?? "other";
  if (t === "audio") {
    return <audio controls preload="none" src={file.downloadUrl} className="file-preview-audio" />;
  }
  if (t === "video") {
    return <video controls preload="metadata" src={file.downloadUrl} className="file-preview-video" />;
  }
  if (t === "image") {
    return <img src={file.downloadUrl} alt={file.fileName} className="file-preview-image" loading="lazy" />;
  }
  if (t === "pdf") {
    return (
      <iframe
        title={file.fileName}
        src={file.downloadUrl}
        className="file-preview-pdf"
      />
    );
  }
  return null;
}

export function StudentFolderViewPage() {
  const { folderId } = useParams();
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allowed, setAllowed] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [fileType, setFileType] = useState<FolderFile["fileType"] | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "size" | "type" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [openPreviewIds, setOpenPreviewIds] = useState<Set<string>>(() => new Set());
  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [downloadFolderBusy, setDownloadFolderBusy] = useState(false);

  const load = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const [f, fs] = await Promise.all([foldersService.getFolderById(id), foldersService.listFolderFiles(id)]);
      setFolder(f);
      setFiles(fs.filter((x) => x.isActive !== false));
      if (f?.folderType === "private" && user) {
        const mine = await foldersService.listMyFoldersForStudent(user.uid);
        setAllowed(mine.some((m) => m.id === id));
      } else {
        setAllowed(true);
      }
    } catch {
      setMessage(tr("تعذر تحميل ملفات المجلد."));
      setFolder(null);
      setFiles([]);
      setAllowed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!folderId) return;
    if (!ready) return;
    void load(folderId);
  }, [folderId, ready, user]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = files;
    if (fileType !== "all") {
      out = out.filter((f) => (f.fileType ?? "other") === fileType);
    }
    if (q) {
      out = out.filter((f) => f.fileName.toLowerCase().includes(q));
    }
    out = out.slice().sort((a, b) => {
      if (sortBy === "size") {
        const as = typeof a.fileSize === "number" ? a.fileSize : 0;
        const bs = typeof b.fileSize === "number" ? b.fileSize : 0;
        return sortDir === "asc" ? as - bs : bs - as;
      }
      if (sortBy === "type") {
        const cmp = String(a.fileType ?? "other").localeCompare(String(b.fileType ?? "other"), "ar");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortBy === "date") {
        const ad = Number((a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0);
        const bd = Number((b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0);
        return sortDir === "asc" ? ad - bd : bd - ad;
      }
      const cmp = a.fileName.localeCompare(b.fileName, "ar");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [files, search, fileType, sortBy, sortDir]);

  const downloadFolderAsZip = async () => {
    if (!folder || files.length === 0) return;
    setDownloadFolderBusy(true);
    setMessage(null);
    try {
      const zip = new JSZip();
      const usedNames = new Map<string, number>();
      await Promise.all(
        files.map(async (f) => {
          const res = await fetch(f.downloadUrl, { mode: "cors", credentials: "omit", cache: "no-store" });
          if (!res.ok) return;
          const blob = await res.blob();
          const base = f.fileName || f.id;
          const count = usedNames.get(base) ?? 0;
          usedNames.set(base, count + 1);
          const finalName = count === 0 ? base : `${base.replace(/(\.[^.]+)?$/, "")} (${count})${base.match(/(\.[^.]+)$/)?.[1] ?? ""}`;
          zip.file(finalName, blob);
        }),
      );
      const content = await zip.generateAsync({ type: "blob" });
      const href = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${folder.name || "folder"}-files.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setMessage(tr("تعذر تنزيل المجلد كاملاً. يمكن تنزيل الملفات بشكل فردي."));
    } finally {
      setDownloadFolderBusy(false);
    }
  };

  const shareFile = async (f: FolderFile) => {
    setShareBusyId(f.id);
    setMessage(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: f.fileName, text: f.fileName, url: f.downloadUrl });
        return;
      }
      await navigator.clipboard.writeText(f.downloadUrl);
      setMessage(tr("تم نسخ رابط الملف للمشاركة."));
    } catch {
      setMessage(tr("تعذر مشاركة الملف من المتصفح الحالي."));
    } finally {
      setShareBusyId(null);
    }
  };

  if (!folderId) {
    return (
      <DashboardLayout role="student" title={tr("الملفات")} lede={tr("—")}>
        <AlertMessage kind="error">{tr("معرّف المجلد غير صحيح.")}</AlertMessage>
      </DashboardLayout>
    );
  }

  if (!ready) {
    return (
      <DashboardLayout role="student" title={tr("الملفات")} lede={tr("—")}>
        <PageLoadHint text={tr("جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student" title={folder?.name || tr("الملفات")} lede={tr("عرض ملفات المجلد للطالب كما في التطبيق، لكن بتخطيط ويب.")} >
      <PageToolbar>
        <Link to="/student/myfiles" className="ghost-btn toolbar-btn">
          {tr("← الرجوع")}
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load(folderId)} disabled={loading} aria-busy={loading}>
          {tr("تحديث")}
        </button>
        <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث في الملفات")} aria-label={tr("بحث في الملفات")} />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {loading ? (
        <PageLoadHint />
      ) : folder == null ? (
        <EmptyState message={tr("المجلد غير موجود.")} />
      ) : !allowed ? (
        <AlertMessage kind="error" role="alert">
          {tr("هذا المجلد خاص ولا تملك صلاحية الوصول له حالياً.")}
          <div className="course-actions" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void (async () => {
                if (!user || !folder) return;
                setRequesting(true);
                setMessage(null);
                try {
                  await coursesService.requestFolderEnrollment(user, folder, tr("طلب انضمام لمجلد"));
                  setMessage(tr("تم إرسال طلب الانضمام للمراجعة."));
                } catch {
                  setMessage(tr("تعذر إرسال الطلب. تحقق من الصلاحيات."));
                } finally {
                  setRequesting(false);
                }
              })()}
              disabled={requesting}
              aria-busy={requesting}
            >
              <ButtonBusyLabel busy={requesting}>{tr("طلب الانضمام")}</ButtonBusyLabel>
            </button>
            <Link to="/student/myfiles" className="ghost-btn">
              {tr("الرجوع")}
            </Link>
          </div>
        </AlertMessage>
      ) : (
        <>
          <Panel className="card-elevated">
            <SectionTitle as="h3">{folder.name}</SectionTitle>
            {folder.description ? <p className="muted small">{folder.description}</p> : null}
          </Panel>
          <PageToolbar>
            <select className="select" value={fileType} onChange={(e) => setFileType(e.target.value as typeof fileType)} aria-label={tr("فلتر نوع الملف")}>
              <option value="all">{tr("كل الأنواع")}</option>
              <option value="pdf">{tr("PDF")}</option>
              <option value="image">{tr("صور")}</option>
              <option value="video">{tr("فيديو")}</option>
              <option value="audio">{tr("صوت")}</option>
              <option value="doc">{tr("مستند")}</option>
              <option value="other">{tr("أخرى")}</option>
            </select>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label={tr("ترتيب الملفات")}>
              <option value="name">{tr("ترتيب: الاسم")}</option>
              <option value="size">{tr("ترتيب: الحجم")}</option>
              <option value="type">{tr("ترتيب: النوع")}</option>
              <option value="date">{tr("ترتيب: التاريخ")}</option>
            </select>
            <select className="select" value={sortDir} onChange={(e) => setSortDir(e.target.value as typeof sortDir)} aria-label={tr("اتجاه الترتيب")}>
              <option value="asc">{tr("تصاعدي")}</option>
              <option value="desc">{tr("تنازلي")}</option>
            </select>
            <button type="button" className="ghost-btn toolbar-btn" onClick={() => void downloadFolderAsZip()} disabled={downloadFolderBusy || files.length === 0} aria-busy={downloadFolderBusy}>
              <ButtonBusyLabel busy={downloadFolderBusy}>{tr("تحميل المجلد كامل")}</ButtonBusyLabel>
            </button>
          </PageToolbar>
          <div className="grid-2 home-stats-grid">
            <StatTile title={tr("إجمالي الملفات")} highlight={files.length} />
            <StatTile title={tr("النتائج")} highlight={visibleFiles.length} />
          </div>
          {visibleFiles.length === 0 ? (
            <EmptyState message={tr("لا توجد ملفات.")} />
          ) : (
            <ContentList>
              {visibleFiles.map((f) => {
                const canPreview = isPreviewable(f);
                const isOpen = openPreviewIds.has(f.id);
                return (
                <ContentListItem key={f.id} className="file-row">
                  <div style={{ width: "100%" }}>
                    <h3 className="post-title">{f.fileName}</h3>
                    <p className="muted small">
                      {f.fileType ? `${tr("النوع")}: ${f.fileType}` : tr("—")} · {tr("الحجم")}: {formatSize(f.fileSize)} · {formatFirestoreTime(f.createdAt)}
                    </p>
                    {canPreview && isOpen ? (
                      <div style={{ marginTop: "0.6rem" }}>
                        <FilePreview file={f} />
                      </div>
                    ) : null}
                  </div>
                  <div className="course-actions">
                    {canPreview ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() =>
                          setOpenPreviewIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.id)) {
                              next.delete(f.id);
                            } else {
                              next.add(f.id);
                            }
                            return next;
                          })
                        }
                      >
                        {isOpen ? tr("إخفاء المعاينة") : tr("معاينة")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={downloadBusyId === f.id}
                      aria-busy={downloadBusyId === f.id}
                      onClick={() =>
                        void (async () => {
                          setDownloadBusyId(f.id);
                          setMessage(null);
                          try {
                            await triggerBrowserDownloadFromUrl(f.downloadUrl, f.fileName);
                          } catch {
                            window.open(f.downloadUrl, "_blank", "noopener,noreferrer");
                            setMessage(tr("تعذر إكمال التحميل كملف؛ تم فتح الرابط في تبويب جديد."));
                          } finally {
                            setDownloadBusyId(null);
                          }
                        })()
                      }
                    >
                      <ButtonBusyLabel busy={downloadBusyId === f.id}>{tr("تحميل")}</ButtonBusyLabel>
                    </button>
                    <a className="ghost-btn" href={f.downloadUrl} target="_blank" rel="noopener noreferrer">
                      {tr("فتح")}
                    </a>
                    <button type="button" className="ghost-btn" onClick={() => void shareFile(f)} disabled={shareBusyId === f.id} aria-busy={shareBusyId === f.id}>
                      <ButtonBusyLabel busy={shareBusyId === f.id}>{tr("مشاركة")}</ButtonBusyLabel>
                    </button>
                  </div>
                </ContentListItem>
              );
              })}
            </ContentList>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

