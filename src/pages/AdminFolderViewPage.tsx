import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ButtonBusyLabel, PageLoadHint } from "../components/ButtonBusyLabel";
import {
  AlertMessage,
  AppModal,
  AppTabPanel,
  AppTabs,
  Avatar,
  ContentList,
  ContentListItem,
  CoverImage,
  EmptyState,
  PageToolbar,
  Panel,
  SectionTitle,
  StatTile,
  cn,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { foldersService } from "../services/foldersService";
import { directoryService } from "../services/directoryService";
import { coursesService } from "../services/coursesService";
import type { EnrollmentRequest, Folder, FolderFile, StudentRecord } from "../types";
import { triggerBrowserDownloadFromUrl } from "../utils/downloadFile";
import { DashboardLayout } from "./DashboardLayout";

type TabId = "files" | "members" | "requests";

function isPreviewable(file: FolderFile) {
  const t = file.fileType ?? "other";
  return t === "audio" || t === "video" || t === "image" || t === "pdf";
}

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
  if (t === "pdf") {
    return (
      <iframe
        title={file.fileName}
        src={file.downloadUrl}
        style={{ width: "100%", height: "420px", border: "1px solid rgba(51, 65, 85, 0.75)", borderRadius: "12px" }}
      />
    );
  }
  return null;
}

export function AdminFolderViewPage() {
  const { folderId } = useParams();
  const { user, ready } = useAuth();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [files, setFiles] = useState<FolderFile[]>([]);
  const [members, setMembers] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("files");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [openPreviewIds, setOpenPreviewIds] = useState<Set<string>>(() => new Set());
  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [activationLifetime, setActivationLifetime] = useState(true);
  const [activationDays, setActivationDays] = useState(30);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<FolderFile["fileType"]>("other");

  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<"all" | EnrollmentRequest["status"]>("pending");
  const [activationReqOpen, setActivationReqOpen] = useState(false);
  const [activationReqTarget, setActivationReqTarget] = useState<EnrollmentRequest | null>(null);

  const load = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const [f, fs, ms, reqs] = await Promise.all([
        foldersService.getFolderById(id),
        foldersService.listFolderFiles(id),
        foldersService.listFolderMembers(id),
        coursesService.listFolderEnrollmentRequestsForTarget(id, requestFilter),
      ]);
      setFolder(f);
      setFiles(fs);
      setMembers(ms);
      setRequests(reqs);
    } catch {
      setMessage("تعذر تحميل تفاصيل المجلد. تحقق من القواعد أو الفهارس.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!folderId) return;
    void load(folderId);
  }, [folderId, requestFilter]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.fileName.toLowerCase().includes(q));
  }, [files, search]);

  const visibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      return (
        (m.displayName ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q) ||
        m.uid.toLowerCase().includes(q)
      );
    });
  }, [members, search]);

  const visibleRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => {
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentEmail.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q)
      );
    });
  }, [requests, search]);

  const visibleStudentsToAdd = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const existing = new Set(members.map((m) => m.uid));
    const base = allStudents.filter((s) => !existing.has(s.uid));
    if (!q) return base.slice(0, 200);
    return base
      .filter((s) => {
        return (
          (s.displayName ?? "").toLowerCase().includes(q) ||
          (s.email ?? "").toLowerCase().includes(q) ||
          (s.phone ?? "").toLowerCase().includes(q) ||
          s.uid.toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [allStudents, memberSearch, members]);

  const openMemberModal = async () => {
    setMemberModalOpen(true);
    setMemberSearch("");
    setActivationLifetime(true);
    setActivationDays(30);
    try {
      const data = await directoryService.listStudents(1000);
      setAllStudents(data);
    } catch {
      setAllStudents([]);
    }
  };

  const openApproveRequest = (req: EnrollmentRequest) => {
    setActivationReqTarget(req);
    setActivationLifetime(true);
    setActivationDays(30);
    setActivationReqOpen(true);
  };

  const approveRequest = async () => {
    if (!activationReqTarget || !folder || !folderId) return;
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await coursesService.approveFolderEnrollmentRequest(activationReqTarget, {
        isLifetime: activationLifetime,
        days: Math.max(1, activationDays),
        expiresAt,
      });
      await foldersService.addMemberToFolder({
        folder,
        member: {
          uid: activationReqTarget.studentId,
          displayName: activationReqTarget.studentName,
          email: activationReqTarget.studentEmail,
          phone: activationReqTarget.studentPhone,
          photoURL: activationReqTarget.studentPhotoURL,
        },
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      setActivationReqOpen(false);
      setActivationReqTarget(null);
      window.dispatchEvent(new CustomEvent("ah:enrollment-requests-updated"));
      await load(folderId);
    } catch {
      setMessage("تعذر قبول طلب الانضمام للمجلد.");
    } finally {
      setBusy(false);
    }
  };

  const rejectRequest = async (req: EnrollmentRequest) => {
    if (!window.confirm(`رفض الطلب للطالب «${req.studentName}»؟`)) return;
    if (!folderId) return;
    setBusy(true);
    setMessage(null);
    try {
      await coursesService.rejectEnrollmentRequest(req.id, "مرفوض");
      window.dispatchEvent(new CustomEvent("ah:enrollment-requests-updated"));
      await load(folderId);
    } catch {
      setMessage("تعذر رفض الطلب.");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async (m: StudentRecord) => {
    if (!folder || !folderId || !user) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const expiresAt = activationLifetime ? null : new Date(Date.now() + Math.max(1, activationDays) * 86_400_000);
      await foldersService.addMemberToFolder({
        folder,
        member: m,
        activation: { isLifetime: activationLifetime, days: Math.max(1, activationDays), expiresAt },
      });
      setMemberModalOpen(false);
      await load(folderId);
    } catch {
      setMessage("تعذر إضافة العضو للمجلد. تحقق من القواعد/الصلاحيات.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!folderId) return;
    if (!window.confirm("هل تريد إزالة العضو من المجلد؟")) return;
    setBusy(true);
    setMessage(null);
    try {
      await foldersService.removeMemberFromFolder(folderId, memberId);
      await load(folderId);
    } catch {
      setMessage("تعذر إزالة العضو.");
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async () => {
    if (!folderId || !user) return;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setMessage("اختر ملفاً أولاً.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await foldersService.uploadFileToFolder({
        user,
        folderId,
        file,
        fileName: uploadName.trim() || file.name,
        fileType: uploadType,
      });
      setUploadModalOpen(false);
      setUploadName("");
      setUploadType("other");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load(folderId);
    } catch {
      setMessage("تعذر رفع الملف. تحقق من صلاحيات Storage و Firestore.");
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (f: FolderFile) => {
    if (!folderId) return;
    if (!window.confirm(`حذف الملف «${f.fileName}»؟`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await foldersService.removeFileFromFolder(folderId, f);
      await load(folderId);
    } catch {
      setMessage("تعذر حذف الملف.");
    } finally {
      setBusy(false);
    }
  };

  if (!folderId) {
    return (
      <DashboardLayout role="admin" title="المجلد" lede="—">
        <AlertMessage kind="error">معرّف المجلد غير صحيح.</AlertMessage>
      </DashboardLayout>
    );
  }

  if (!ready) {
    return (
      <DashboardLayout role="admin" title="تفاصيل المجلد" lede="—">
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title={folder?.name || "تفاصيل المجلد"} lede="إدارة ملفات وأعضاء المجلد عبر تبويبات (ويب) — مطابق لعمل التطبيق." >
      <PageToolbar>
        <Link to="/admin/folders" className="ghost-btn toolbar-btn">
          ← الرجوع للمجلدات
        </Link>
        <button type="button" className="ghost-btn toolbar-btn" onClick={() => void load(folderId)} disabled={loading || busy} aria-busy={loading || busy}>
          <ButtonBusyLabel busy={loading || busy}>تحديث</ButtonBusyLabel>
        </button>
        {tab === "members" ? (
          <button type="button" className="primary-btn toolbar-btn" onClick={() => void openMemberModal()} disabled={busy || loading}>
            إضافة عضو
          </button>
        ) : tab === "requests" ? (
          <button type="button" className="ghost-btn toolbar-btn" onClick={() => setRequestFilter((f) => (f === "pending" ? "approved" : f === "approved" ? "rejected" : f === "rejected" ? "expired" : f === "expired" ? "all" : "pending"))} disabled={busy || loading}>
            {requestFilter === "all"
              ? "كل الحالات"
              : requestFilter === "pending"
                ? "قيد المراجعة"
                : requestFilter === "approved"
                  ? "المقبولة"
                  : requestFilter === "rejected"
                    ? "المرفوضة"
                    : "المنتهية"}
          </button>
        ) : (
          <button type="button" className="primary-btn toolbar-btn" onClick={() => setUploadModalOpen(true)} disabled={busy || loading}>
            رفع ملف
          </button>
        )}
        <input
          className="text-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === "files" ? "بحث في الملفات" : "بحث في الأعضاء"}
          aria-label={tab === "files" ? "بحث في الملفات" : "بحث في الأعضاء"}
        />
      </PageToolbar>

      {message ? <AlertMessage kind="error">{message}</AlertMessage> : null}

      {loading ? (
        <PageLoadHint />
      ) : folder == null ? (
        <EmptyState message="لم يتم العثور على المجلد." />
      ) : (
        <>
          <Panel className={cn("course-hero", folder.coverImageUrl && "course-hero--img")}>
            {folder.coverImageUrl ? <CoverImage variant="hero" src={folder.coverImageUrl} alt={folder.name} /> : null}
            <div className="course-hero-body">
              <SectionTitle as="h2">{folder.name}</SectionTitle>
              {folder.description ? <p className="muted course-hero-lead">{folder.description}</p> : null}
              <div className="course-meta lesson-course-meta">
                <span>{typeof folder.fileCount === "number" ? `${folder.fileCount} ملف` : `${files.length} ملف`}</span>
                <span>{typeof folder.memberCount === "number" ? `${folder.memberCount} عضو` : `${members.length} عضو`}</span>
                <span>{folder.folderType === "private" ? "خاص" : "عام"}</span>
              </div>
            </div>
          </Panel>

          <AppTabs
            groupId={`admin-folder-${folderId}`}
            ariaLabel="أقسام المجلد"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "files", label: "الملفات" },
              { id: "members", label: "الأعضاء" },
              { id: "requests", label: "طلبات" },
            ]}
          />

          <AppTabPanel tabId="files" groupId={`admin-folder-${folderId}`} hidden={tab !== "files"} className="lesson-tab-panel">
            {!loading ? (
              <div className="grid-2 home-stats-grid">
                <StatTile title="إجمالي الملفات" highlight={files.length} />
                <StatTile title="النتائج" highlight={visibleFiles.length} />
              </div>
            ) : null}
            {visibleFiles.length === 0 ? (
              <EmptyState message="لا توجد ملفات في هذا المجلد." />
            ) : (
              <ContentList>
                {visibleFiles.map((f) => (
                  <ContentListItem key={f.id} className="file-row">
                    <div style={{ width: "100%" }}>
                      <h3 className="post-title">{f.fileName}</h3>
                      <p className="muted small">
                        {f.fileType ? `النوع: ${f.fileType}` : "—"} {typeof f.fileSize === "number" ? `· الحجم: ${Math.round(f.fileSize / 1024)} KB` : ""}
                      </p>
                      {isPreviewable(f) && openPreviewIds.has(f.id) ? (
                        <div style={{ marginTop: "0.6rem" }}>
                          <FilePreview file={f} />
                        </div>
                      ) : null}
                    </div>
                    <div className="course-actions">
                      {isPreviewable(f) ? (
                        <button
                          type="button"
                          className="ghost-btn toolbar-btn"
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
                          {openPreviewIds.has(f.id) ? "إخفاء المعاينة" : "معاينة"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="ghost-btn toolbar-btn"
                        disabled={downloadBusyId === f.id || busy}
                        aria-busy={downloadBusyId === f.id}
                        onClick={() =>
                          void (async () => {
                            setDownloadBusyId(f.id);
                            setMessage(null);
                            try {
                              await triggerBrowserDownloadFromUrl(f.downloadUrl, f.fileName);
                            } catch {
                              window.open(f.downloadUrl, "_blank", "noopener,noreferrer");
                              setMessage("تعذر إكمال التحميل كملف؛ تم فتح الرابط في تبويب جديد.");
                            } finally {
                              setDownloadBusyId(null);
                            }
                          })()
                        }
                      >
                        <ButtonBusyLabel busy={downloadBusyId === f.id}>تحميل</ButtonBusyLabel>
                      </button>
                      <a className="ghost-btn toolbar-btn" href={f.downloadUrl} target="_blank" rel="noopener noreferrer">
                        فتح
                      </a>
                      <button type="button" className="ghost-btn toolbar-btn" onClick={() => void removeFile(f)} disabled={busy}>
                        حذف
                      </button>
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </AppTabPanel>

          <AppTabPanel tabId="members" groupId={`admin-folder-${folderId}`} hidden={tab !== "members"} className="lesson-tab-panel">
            {!loading ? (
              <div className="grid-2 home-stats-grid">
                <StatTile title="إجمالي الأعضاء" highlight={members.length} />
                <StatTile title="النتائج" highlight={visibleMembers.length} />
              </div>
            ) : null}
            {visibleMembers.length === 0 ? (
              <EmptyState message="لا يوجد أعضاء في هذا المجلد." />
            ) : (
              <ContentList>
                {visibleMembers.map((m) => (
                  <ContentListItem key={m.uid} className="user-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                      <Avatar
                        photoURL={m.photoURL}
                        displayName={m.displayName}
                        email={m.email}
                        alt={m.displayName || "عضو"}
                        imageClassName="user-avatar topbar-avatar"
                        fallbackClassName="user-avatar-fallback topbar-avatar"
                        size={40}
                      />
                      <div style={{ minWidth: 0 }}>
                        <h3 className="post-title">{m.displayName || m.uid}</h3>
                        <p className="muted small">
                          {m.email || "—"} {m.phone ? `· ${m.phone}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="course-actions">
                      {m.isActivated === false ? (
                        <span className="meta-pill meta-pill--muted">غير مُفعّل</span>
                      ) : m.isSuspended ? (
                        <span className="meta-pill meta-pill--warn">موقوف</span>
                      ) : (
                        <span className="meta-pill meta-pill--ok">مفعّل</span>
                      )}
                      <button type="button" className="ghost-btn toolbar-btn" onClick={() => void removeMember(m.uid)} disabled={busy}>
                        إزالة
                      </button>
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </AppTabPanel>

          <AppTabPanel tabId="requests" groupId={`admin-folder-${folderId}`} hidden={tab !== "requests"} className="lesson-tab-panel">
            {!loading ? (
              <div className="grid-2 home-stats-grid">
                <StatTile title="الطلبات" highlight={requests.length} />
                <StatTile title="النتائج" highlight={visibleRequests.length} />
              </div>
            ) : null}
            {visibleRequests.length === 0 ? (
              <EmptyState message="لا توجد طلبات لهذا المجلد." />
            ) : (
              <ContentList>
                {visibleRequests.map((r) => (
                  <ContentListItem key={r.id} className="user-row">
                    <div>
                      <h3 className="post-title">{r.studentName || r.studentId}</h3>
                      <p className="muted small">{r.studentEmail || "—"} {r.studentPhone ? `· ${r.studentPhone}` : ""}</p>
                      <p className="muted small">الحالة: {r.status}</p>
                    </div>
                    <div className="course-actions">
                      {r.status === "pending" ? (
                        <>
                          <button type="button" className="primary-btn toolbar-btn" onClick={() => openApproveRequest(r)} disabled={busy}>
                            قبول
                          </button>
                          <button type="button" className="ghost-btn toolbar-btn" onClick={() => void rejectRequest(r)} disabled={busy}>
                            رفض
                          </button>
                        </>
                      ) : (
                        <span className={r.status === "approved" ? "meta-pill meta-pill--ok" : r.status === "rejected" ? "meta-pill meta-pill--warn" : "meta-pill meta-pill--muted"}>
                          {r.status}
                        </span>
                      )}
                    </div>
                  </ContentListItem>
                ))}
              </ContentList>
            )}
          </AppTabPanel>
        </>
      )}

      <AppModal open={memberModalOpen} title="إضافة عضو للمجلد" onClose={() => (busy ? null : setMemberModalOpen(false))}>
        <div className="course-form-modal__form">
          <label className="muted small" htmlFor="memberSearch">
            بحث عن طالب لإضافته
          </label>
          <input
            id="memberSearch"
            className="text-input"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="اكتب الاسم/البريد/الجوال/المعرّف"
          />

          <div className="form-row-2">
            <label className="muted small">
              <input type="checkbox" checked={activationLifetime} onChange={(e) => setActivationLifetime(e.target.checked)} /> تفعيل مدى الحياة
            </label>
            {!activationLifetime ? (
              <input
                className="text-input"
                type="number"
                min={1}
                value={activationDays}
                onChange={(e) => setActivationDays(Number(e.target.value || 30))}
                aria-label="أيام التفعيل"
              />
            ) : (
              <span className="muted small">—</span>
            )}
          </div>

          {visibleStudentsToAdd.length === 0 ? (
            <EmptyState message="لا توجد نتائج لإضافتها." />
          ) : (
            <ContentList>
              {visibleStudentsToAdd.slice(0, 30).map((s) => (
                <ContentListItem key={s.uid} className="user-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                    <Avatar
                      photoURL={s.photoURL}
                      displayName={s.displayName}
                      email={s.email}
                      alt={s.displayName || "طالب"}
                      imageClassName="user-avatar topbar-avatar"
                      fallbackClassName="user-avatar-fallback topbar-avatar"
                      size={40}
                    />
                    <div style={{ minWidth: 0 }}>
                      <h4 className="post-title">{s.displayName || s.uid}</h4>
                      <p className="muted small">
                        {s.email || "—"} {s.phone ? `· ${s.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <button type="button" className="primary-btn toolbar-btn" onClick={() => void addMember(s)} disabled={busy}>
                    <ButtonBusyLabel busy={busy}>إضافة</ButtonBusyLabel>
                  </button>
                </ContentListItem>
              ))}
            </ContentList>
          )}

          <div className="course-actions">
            <button type="button" className="ghost-btn" onClick={() => setMemberModalOpen(false)} disabled={busy}>
              إغلاق
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal open={uploadModalOpen} title="رفع ملف للمجلد" onClose={() => (busy ? null : setUploadModalOpen(false))}>
        <div className="course-form-modal__form">
          <label className="muted small" htmlFor="uploadName">
            اسم الملف (اختياري)
          </label>
          <input id="uploadName" className="text-input" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="اتركه ليأخذ اسم الملف" />

          <label className="muted small" htmlFor="uploadType">
            النوع
          </label>
          <select id="uploadType" className="select" value={uploadType} onChange={(e) => setUploadType(e.target.value as FolderFile["fileType"])}>
            <option value="pdf">PDF</option>
            <option value="image">صورة</option>
            <option value="video">فيديو</option>
            <option value="audio">صوت</option>
            <option value="doc">مستند</option>
            <option value="other">أخرى</option>
          </select>

          <input ref={fileInputRef} type="file" />

          <div className="course-actions">
            <button type="button" className="ghost-btn" onClick={() => setUploadModalOpen(false)} disabled={busy}>
              إلغاء
            </button>
            <button type="button" className="primary-btn" onClick={() => void uploadFile()} disabled={busy || !user}>
              <ButtonBusyLabel busy={busy}>رفع</ButtonBusyLabel>
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal open={activationReqOpen} title="قبول طلب الانضمام" onClose={() => (busy ? null : setActivationReqOpen(false))}>
        <div className="course-form-modal__form">
          <p className="muted small">
            الطالب: <strong>{activationReqTarget?.studentName || "—"}</strong>
          </p>
          <div className="form-row-2">
            <label className="muted small">
              <input type="checkbox" checked={activationLifetime} onChange={(e) => setActivationLifetime(e.target.checked)} /> تفعيل مدى الحياة
            </label>
            {!activationLifetime ? (
              <input
                className="text-input"
                type="number"
                min={1}
                value={activationDays}
                onChange={(e) => setActivationDays(Number(e.target.value || 30))}
                aria-label="أيام التفعيل"
              />
            ) : (
              <span className="muted small">—</span>
            )}
          </div>
          <div className="course-actions">
            <button type="button" className="ghost-btn" onClick={() => setActivationReqOpen(false)} disabled={busy}>
              إلغاء
            </button>
            <button type="button" className="primary-btn" onClick={() => void approveRequest()} disabled={busy}>
              <ButtonBusyLabel busy={busy}>تأكيد القبول</ButtonBusyLabel>
            </button>
          </div>
        </div>
      </AppModal>
    </DashboardLayout>
  );
}

