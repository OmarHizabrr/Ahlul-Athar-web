import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import { AlertMessage, ContentList, ContentListItem, EmptyState, PageToolbar, Panel, SectionTitle, StatTile } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { coursesService } from "../services/coursesService";
import { foldersService } from "../services/foldersService";
import type { Folder, FolderFile } from "../types";
import { DashboardLayout } from "./DashboardLayout";

function FilePreview({ file }: { file: FolderFile }) {
  const t = file.fileType ?? "other";
  if (t === "audio") {
    return <audio controls preload="none" src={file.downloadUrl} style={{ width: "100%" }} />;
  }
  if (t === "video") {
    return <video controls preload="metadata" src={file.downloadUrl} style={{ width: "100%", maxHeight: "360px" }} />;
  }
  if (t === "image") {
    return <img src={file.downloadUrl} alt={file.fileName} style={{ width: "100%", borderRadius: "12px" }} loading="lazy" />;
  }
  return null;
}

export function StudentFolderViewPage() {
  const { folderId } = useParams();
  const { user, ready } = useAuth();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allowed, setAllowed] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [fileType, setFileType] = useState<FolderFile["fileType"] | "all">("all");
  const [sortBy, setSortBy] = useState<"name" | "size" | "type">("name");

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
      setMessage("تعذر تحميل ملفات المجلد.");
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
        return bs - as;
      }
      if (sortBy === "type") {
        return String(a.fileType ?? "other").localeCompare(String(b.fileType ?? "other"), "ar");
      }
      return a.fileName.localeCompare(b.fileName, "ar");
    });
    return out;
  }, [files, search, fileType, sortBy]);

  if (!folderId) {
    return (
      <DashboardLayout role="student" title="الملفات" lede="—">
        <AlertMessage kind="error">معرّف المجلد غير صحيح.</AlertMessage>
      </DashboardLayout>
    );
  }

  if (!ready) {
    return (
      <DashboardLayout role="student" title="الملفات" lede="—">
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student" title={folder?.name || "الملفات"} lede="عرض ملفات المجلد للطالب كما في التطبيق، لكن بتخطيط ويب." >
      <PageToolbar>
        <Link to="/student/myfiles" className="ghost-btn toolbar-btn">
          ← الرجوع
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load(folderId)} disabled={loading} aria-busy={loading}>
          تحديث
        </button>
        <input className="text-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في الملفات" aria-label="بحث في الملفات" />
      </PageToolbar>
      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}
      {loading ? (
        <PageLoadHint />
      ) : folder == null ? (
        <EmptyState message="المجلد غير موجود." />
      ) : !allowed ? (
        <AlertMessage kind="error" role="alert">
          هذا المجلد خاص ولا تملك صلاحية الوصول له حالياً.
          <div className="course-actions" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void (async () => {
                if (!user || !folder) return;
                setRequesting(true);
                setMessage(null);
                try {
                  await coursesService.requestFolderEnrollment(user, folder, "طلب انضمام لمجلد");
                  setMessage("تم إرسال طلب الانضمام للمراجعة.");
                } catch {
                  setMessage("تعذر إرسال الطلب. تحقق من الصلاحيات.");
                } finally {
                  setRequesting(false);
                }
              })()}
              disabled={requesting}
              aria-busy={requesting}
            >
              <ButtonBusyLabel busy={requesting}>طلب الانضمام</ButtonBusyLabel>
            </button>
            <Link to="/student/myfiles" className="ghost-btn">
              الرجوع
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
            <select className="select" value={fileType} onChange={(e) => setFileType(e.target.value as typeof fileType)} aria-label="فلتر نوع الملف">
              <option value="all">كل الأنواع</option>
              <option value="pdf">PDF</option>
              <option value="image">صور</option>
              <option value="video">فيديو</option>
              <option value="audio">صوت</option>
              <option value="doc">مستند</option>
              <option value="other">أخرى</option>
            </select>
            <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="ترتيب الملفات">
              <option value="name">ترتيب: الاسم</option>
              <option value="size">ترتيب: الحجم</option>
              <option value="type">ترتيب: النوع</option>
            </select>
          </PageToolbar>
          <div className="grid-2 home-stats-grid">
            <StatTile title="إجمالي الملفات" highlight={files.length} />
            <StatTile title="النتائج" highlight={visibleFiles.length} />
          </div>
          {visibleFiles.length === 0 ? (
            <EmptyState message="لا توجد ملفات." />
          ) : (
            <ContentList>
              {visibleFiles.map((f) => (
                <ContentListItem key={f.id} className="file-row">
                  <div style={{ width: "100%" }}>
                    <h3 className="post-title">{f.fileName}</h3>
                    <p className="muted small">
                      {f.fileType ? `النوع: ${f.fileType}` : "—"} {typeof f.fileSize === "number" ? `· الحجم: ${Math.round(f.fileSize / 1024)} KB` : ""}
                    </p>
                    <div style={{ marginTop: "0.6rem" }}>
                      <FilePreview file={f} />
                    </div>
                  </div>
                  <a className="primary-btn" href={f.downloadUrl} target="_blank" rel="noopener noreferrer">
                    فتح
                  </a>
                </ContentListItem>
              ))}
            </ContentList>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

