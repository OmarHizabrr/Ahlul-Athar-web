import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { LessonComment, PlatformUser } from "../types";

function timeMillisFromUnknown(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof (v as { toMillis: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

function mapLessonComment(d: QueryDocumentSnapshot<DocumentData>): LessonComment {
  const data = d.data();
  return {
    id: d.id,
    lessonId: String(data.lessonId ?? ""),
    courseId: String(data.courseId ?? ""),
    userId: String(data.userId ?? ""),
    userName: String(data.userName ?? "مستخدم"),
    userPhotoURL: data.userPhotoURL != null ? String(data.userPhotoURL) : undefined,
    body: String(data.body ?? ""),
    createdAt: data.createdAt,
  };
}

export const lessonCommentsService = {
  async listByLesson(courseId: string, lessonId: string): Promise<LessonComment[]> {
    const col = collection(db, "lesson_comments", lessonId, "lesson_comments");
    try {
      const q = query(col, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(mapLessonComment);
    } catch {
      const snap = await getDocs(col);
      return snap.docs
        .map(mapLessonComment)
        .filter((c) => c.lessonId === lessonId && c.courseId === courseId)
        .sort((a, b) => timeMillisFromUnknown(b.createdAt) - timeMillisFromUnknown(a.createdAt));
    }
  },

  async addComment(user: PlatformUser, courseId: string, lessonId: string, body: string): Promise<void> {
    const text = body.trim();
    if (!text) {
      return;
    }
    const col = collection(db, "lesson_comments", lessonId, "lesson_comments");
    await addDoc(col, {
      lessonId,
      courseId,
      userId: user.uid,
      userName: user.displayName ?? user.email ?? "مستخدم",
      userPhotoURL: user.photoURL ?? null,
      body: text,
      createdAt: serverTimestamp(),
    });
  },
};
