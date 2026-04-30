import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { PlatformUser, Post, UserRole } from "../types";

const postsCol = collection(db, "posts");

function timeMillisFromUnknown(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof (v as { toMillis: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

function mapPost(d: QueryDocumentSnapshot<DocumentData>): Post {
  const data = d.data();
  return {
    id: d.id,
    title: String(data.title ?? ""),
    body: String(data.body ?? data.content ?? ""),
    authorId: String(data.authorId ?? ""),
    authorName: String(data.authorName ?? ""),
    authorPhotoURL: typeof data.authorPhotoURL === "string" ? data.authorPhotoURL : undefined,
    isPublished: Boolean(data.isPublished ?? data.published ?? false),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function sortPostsDesc(docs: QueryDocumentSnapshot<DocumentData>[]): Post[] {
  return docs
    .map(mapPost)
    .sort((a, b) => timeMillisFromUnknown(b.createdAt) - timeMillisFromUnknown(a.createdAt));
}

export const postsService = {
  async listForRole(role: UserRole): Promise<Post[]> {
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      if (role === "student") {
        const q = query(postsCol, where("isPublished", "==", true), orderBy("createdAt", "desc"));
        docs = (await getDocs(q)).docs;
      } else {
        const q = query(postsCol, orderBy("createdAt", "desc"));
        docs = (await getDocs(q)).docs;
      }
    } catch {
      const snap = await getDocs(postsCol);
      const raw = snap.docs;
      const filtered = role === "student" ? raw.filter((d) => Boolean(d.data().isPublished ?? d.data().published)) : raw;
      return sortPostsDesc(filtered);
    }
    return docs.map(mapPost);
  },

  async create(user: PlatformUser, payload: { title: string; body: string; publish: boolean }) {
    await addDoc(postsCol, {
      title: payload.title,
      body: payload.body,
      authorId: user.uid,
      authorName: user.displayName ?? "Admin",
      authorPhotoURL: user.photoURL ?? "",
      isPublished: payload.publish,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updatePublish(postId: string, isPublished: boolean) {
    await updateDoc(doc(db, "posts", postId), {
      isPublished,
      updatedAt: serverTimestamp(),
    });
  },

  async updatePost(
    postId: string,
    payload: { title: string; body: string; isPublished: boolean },
  ) {
    await updateDoc(doc(db, "posts", postId), {
      title: payload.title.trim(),
      body: payload.body.trim(),
      isPublished: payload.isPublished,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(postId: string) {
    await deleteDoc(doc(db, "posts", postId));
  },
};
