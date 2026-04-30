import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import type { Folder, FolderFile, PlatformUser, StudentRecord } from "../types";

function mapFolder(d: QueryDocumentSnapshot<DocumentData>): Folder {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name ?? data.title ?? ""),
    description: data.description != null ? String(data.description) : undefined,
    folderType: (data.folderType === "private" ? "private" : "public") as Folder["folderType"],
    isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
    coverImageUrl: data.coverImageUrl != null ? String(data.coverImageUrl) : data.coverImageURL != null ? String(data.coverImageURL) : undefined,
    fileCount: typeof data.fileCount === "number" ? data.fileCount : undefined,
    memberCount: typeof data.memberCount === "number" ? data.memberCount : undefined,
    totalSize: typeof data.totalSize === "number" ? data.totalSize : undefined,
    createdAt: data.createdAt,
  };
}

function firstNonEmptyUrl(data: DocumentData): string {
  const keys = [
    "downloadUrl",
    "url",
    "firebaseStorageUrl",
    "downloadURL",
    "fileUrl",
    "link",
    "publicUrl",
  ] as const;
  for (const k of keys) {
    const v = data[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return "";
}

function firstStoragePath(data: DocumentData): string | undefined {
  const keys = ["storagePath", "firebaseStoragePath", "storage_path", "firebase_storage_path"] as const;
  for (const k of keys) {
    const v = data[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return undefined;
}

function mapFolderFile(d: QueryDocumentSnapshot<DocumentData>): FolderFile {
  const data = d.data();
  const fileName = String(data.fileName ?? data.name ?? d.id);
  const url = firstNonEmptyUrl(data);
  const inferType = (): FolderFile["fileType"] | undefined => {
    const ext = (() => {
      const raw = (fileName || url).split("?")[0] ?? "";
      const last = raw.split(".").pop() ?? "";
      return last.toLowerCase();
    })();
    if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
    if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) return "doc";
    return undefined;
  };
  return {
    id: d.id,
    fileName,
    downloadUrl: url,
    storagePath: firstStoragePath(data),
    fileType: data.fileType != null ? (String(data.fileType) as FolderFile["fileType"]) : inferType(),
    fileSize: typeof data.fileSize === "number" ? data.fileSize : undefined,
    isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
    createdAt: data.createdAt,
  };
}

function mapFolderMember(d: QueryDocumentSnapshot<DocumentData>): StudentRecord {
  const data = d.data();
  return {
    uid: d.id,
    displayName: String(data.createdByName ?? data.displayName ?? data.name ?? d.id),
    email: data.email != null ? String(data.email) : undefined,
    phone: data.phone != null ? String(data.phone) : data.phoneNumber != null ? String(data.phoneNumber) : undefined,
    photoURL: data.photoURL != null ? String(data.photoURL) : data.imageUrl != null ? String(data.imageUrl) : undefined,
    isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
    isSuspended: data.isSuspended != null ? Boolean(data.isSuspended) : undefined,
    isActivated: data.isActivated != null ? Boolean(data.isActivated) : undefined,
    createdAt: data.createdAt,
  };
}

export const foldersService = {
  async listFoldersForAdmin(): Promise<Folder[]> {
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      docs = (await getDocs(query(collection(db, "folders"), orderBy("createdAt", "desc")))).docs;
    } catch {
      docs = (await getDocs(collection(db, "folders"))).docs;
    }
    return docs.map(mapFolder);
  },

  async listPublicFoldersForStudent(): Promise<Folder[]> {
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      docs = (
        await getDocs(
          query(
            collection(db, "folders"),
            where("folderType", "==", "public"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
          ),
        )
      ).docs;
    } catch {
      const raw = (await getDocs(collection(db, "folders"))).docs;
      docs = raw.filter((d) => {
        const data = d.data();
        return String(data.folderType ?? "public") === "public" && Boolean(data.isActive ?? true);
      });
    }
    return docs.map(mapFolder);
  },

  async listExploreFoldersForStudent(): Promise<Folder[]> {
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      docs = (await getDocs(query(collection(db, "folders"), where("isActive", "==", true), orderBy("createdAt", "desc")))).docs;
    } catch {
      const raw = (await getDocs(collection(db, "folders"))).docs;
      docs = raw.filter((d) => Boolean(d.data().isActive ?? true));
    }
    return docs.map(mapFolder);
  },

  async listMyFoldersForStudent(studentId: string): Promise<(Folder & { isActivated?: boolean; isLifetime?: boolean; expiresAt?: string | null })[]> {
    const col = collection(db, "MyFolders", studentId, "MyFolders");
    const snap = await getDocs(col);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    if (rows.length === 0) {
      return [];
    }
    const byId = new Map<string, Folder>();
    await Promise.all(
      rows.map(async (r) => {
        const folderId = String(r.id);
        const f = await this.getFolderById(folderId);
        if (f) byId.set(folderId, f);
      }),
    );
    return rows
      .map((r) => {
        const folderId = String(r.id);
        const base = byId.get(folderId) ?? ({ id: folderId, name: String((r as { name?: unknown }).name ?? folderId) } as Folder);
        return {
          ...base,
          isActivated: (r as { isActivated?: unknown }).isActivated != null ? Boolean((r as { isActivated?: unknown }).isActivated) : undefined,
          isLifetime: (r as { isLifetime?: unknown }).isLifetime != null ? Boolean((r as { isLifetime?: unknown }).isLifetime) : undefined,
          expiresAt: (r as { expiresAt?: unknown }).expiresAt != null ? String((r as { expiresAt?: unknown }).expiresAt) : null,
        };
      })
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ar"));
  },

  async getFolderById(folderId: string): Promise<Folder | null> {
    const snap = await getDoc(doc(db, "folders", folderId));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as Record<string, unknown>;
    return {
      id: snap.id,
      name: String(data.name ?? data.title ?? ""),
      description: data.description != null ? String(data.description) : undefined,
      folderType: (data.folderType === "private" ? "private" : "public") as Folder["folderType"],
      isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
      coverImageUrl: data.coverImageUrl != null ? String(data.coverImageUrl) : data.coverImageURL != null ? String(data.coverImageURL) : undefined,
      fileCount: typeof data.fileCount === "number" ? data.fileCount : undefined,
      memberCount: typeof data.memberCount === "number" ? data.memberCount : undefined,
      totalSize: typeof data.totalSize === "number" ? data.totalSize : undefined,
      createdAt: (data as { createdAt?: unknown }).createdAt,
    };
  },

  async listFolderFiles(folderId: string): Promise<FolderFile[]> {
    const col = collection(db, "file", folderId, "file");
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      docs = (await getDocs(query(col, orderBy("createdAt", "desc")))).docs;
    } catch {
      docs = (await getDocs(col)).docs;
    }
    const mapped = docs.map(mapFolderFile);
    const withUrls = await Promise.all(
      mapped.map(async (f) => {
        if (f.downloadUrl.trim().length > 0) return f;
        const path = f.storagePath?.trim();
        if (!path) return f;
        try {
          const resolved = await getDownloadURL(ref(storage, path));
          return { ...f, downloadUrl: resolved };
        } catch {
          return f;
        }
      }),
    );
    return withUrls.filter((f) => f.downloadUrl.trim().length > 0);
  },

  async listFolderMembers(folderId: string): Promise<StudentRecord[]> {
    const col = collection(db, "memberFolder", folderId, "memberFolder");
    const snap = await getDocs(col);
    return snap.docs.map(mapFolderMember);
  },

  async addMemberToFolder(opts: {
    folder: Folder;
    member: StudentRecord;
    activation: { isLifetime: boolean; days: number; expiresAt: Date | null };
  }) {
    const folderId = opts.folder.id;
    const memberId = opts.member.uid;

    const folderMemberRef = doc(db, "memberFolder", folderId, "memberFolder", memberId);
    const myFolderRef = doc(db, "MyFolders", memberId, "MyFolders", folderId);
    const folderRef = doc(db, "folders", folderId);

    const expiresIso = opts.activation.expiresAt ? opts.activation.expiresAt.toISOString() : null;

    // أبسط تماثل مع Flutter: نكتب نفس مفاتيح التفعيل في memberFolder + MyFolders
    const baseActivation = {
      isActivated: true,
      isLifetime: opts.activation.isLifetime,
      activationDays: opts.activation.days,
      expiresAt: expiresIso,
      activatedAt: serverTimestamp(),
    };

    await Promise.all([
      setDoc(
        folderMemberRef,
        {
          displayName: opts.member.displayName,
          email: opts.member.email ?? null,
          phone: opts.member.phone ?? null,
          photoURL: opts.member.photoURL ?? null,
          ...baseActivation,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      ),
      setDoc(
        myFolderRef,
        {
          id: folderId,
          name: opts.folder.name,
          description: opts.folder.description ?? null,
          coverImageUrl: opts.folder.coverImageUrl ?? null,
          joinedAt: serverTimestamp(),
          ...baseActivation,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      ),
      updateDoc(folderRef, { memberCount: increment(1), updatedAt: serverTimestamp() }),
    ]);
  },

  async removeMemberFromFolder(folderId: string, memberId: string) {
    const folderMemberRef = doc(db, "memberFolder", folderId, "memberFolder", memberId);
    const myFolderRef = doc(db, "MyFolders", memberId, "MyFolders", folderId);
    const folderRef = doc(db, "folders", folderId);
    await Promise.all([
      deleteDoc(folderMemberRef),
      deleteDoc(myFolderRef).catch(() => undefined),
      updateDoc(folderRef, { memberCount: increment(-1), updatedAt: serverTimestamp() }).catch(() => undefined),
    ]);
  },

  async uploadFileToFolder(opts: {
    user: PlatformUser;
    folderId: string;
    file: File;
    fileName?: string;
    fileType?: FolderFile["fileType"];
  }) {
    const safeName = (opts.fileName?.trim() || opts.file.name || "file").replace(/[\\/:*?"<>|]+/g, "_");
    const storagePath = `folders/${opts.folderId}/files/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, opts.file, { contentType: opts.file.type || "application/octet-stream" });
    const url = await getDownloadURL(storageRef);

    const fileId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const fileRef = doc(db, "file", opts.folderId, "file", fileId);
    const folderRef = doc(db, "folders", opts.folderId);

    const size = typeof opts.file.size === "number" ? opts.file.size : 0;
    await Promise.all([
      setDoc(
        fileRef,
        {
          fileName: safeName,
          downloadUrl: url,
          storagePath,
          fileType: opts.fileType ?? null,
          fileSize: size,
          isActive: true,
          createdBy: opts.user.uid,
          createdByName: opts.user.displayName ?? "Admin",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      updateDoc(folderRef, {
        fileCount: increment(1),
        totalSize: increment(size),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined),
    ]);

    return { fileId, downloadUrl: url };
  },

  async removeFileFromFolder(folderId: string, file: FolderFile) {
    const fileRef = doc(db, "file", folderId, "file", file.id);
    const folderRef = doc(db, "folders", folderId);
    await deleteDoc(fileRef);
    const sz = typeof file.fileSize === "number" ? file.fileSize : 0;
    await updateDoc(folderRef, { fileCount: increment(-1), totalSize: increment(-sz), updatedAt: serverTimestamp() }).catch(
      () => undefined,
    );
    if (file.storagePath) {
      await deleteObject(ref(storage, file.storagePath)).catch(() => undefined);
    }
  },
};

