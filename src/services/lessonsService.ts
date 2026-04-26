import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Lesson, PlatformUser } from "../types";

const lessonsForCourse = (courseId: string) => collection(db, "lessons", courseId, "lessons");

function timeMillisFromUnknown(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "object" && v !== null && "toMillis" in v) {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

function mapLesson(courseId: string, id: string, data: DocumentData): Lesson {
  return {
    id,
    courseId,
    title: String(data.title ?? ""),
    description: data.description != null ? String(data.description) : undefined,
    content: data.content != null ? String(data.content) : undefined,
    txtContent: data.txtContent != null ? String(data.txtContent) : undefined,
    contentType: data.contentType != null ? String(data.contentType) : undefined,
    videoUrl: data.videoUrl != null ? String(data.videoUrl) : undefined,
    pdfUrl: data.pdfUrl != null ? String(data.pdfUrl) : undefined,
    audioUrl: data.audioUrl != null ? String(data.audioUrl) : undefined,
    duration: data.duration != null ? Number(data.duration) : undefined,
    difficulty: data.difficulty != null ? String(data.difficulty) : undefined,
    createdAt: data.createdAt,
    createdByName: data.createdByName != null ? String(data.createdByName) : undefined,
    hasMandatoryQuiz: data.hasMandatoryQuiz === true,
  };
}

export const lessonsService = {
  async listByCourseId(courseId: string): Promise<Lesson[]> {
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      const q = query(lessonsForCourse(courseId), orderBy("createdAt", "desc"));
      docs = (await getDocs(q)).docs;
    } catch {
      const raw = (await getDocs(lessonsForCourse(courseId))).docs;
      return raw
        .map((d) => mapLesson(courseId, d.id, d.data()))
        .sort((a, b) => timeMillisFromUnknown(b.createdAt) - timeMillisFromUnknown(a.createdAt));
    }
    return docs.map((d) => mapLesson(courseId, d.id, d.data()));
  },

  /** ترتيب من الأقدم للأحدث — كما `getCourseLessons` + sort في تطبيق Flutter. */
  async listByCourseIdChronologicalAsc(courseId: string): Promise<Lesson[]> {
    const all = await this.listByCourseId(courseId);
    return all.slice().sort((a, b) => timeMillisFromUnknown(a.createdAt) - timeMillisFromUnknown(b.createdAt));
  },

  async getById(courseId: string, lessonId: string): Promise<Lesson | null> {
    const ref = doc(db, "lessons", courseId, "lessons", lessonId);
    const s = await getDoc(ref);
    if (!s.exists()) {
      return null;
    }
    return mapLesson(courseId, s.id, s.data() as DocumentData);
  },

  async createLesson(
    _user: PlatformUser,
    courseId: string,
    payload: { title: string; description: string; content: string; contentType: string; hasMandatoryQuiz?: boolean },
  ) {
    const col = lessonsForCourse(courseId);
    await addDoc(col, {
      title: payload.title,
      description: payload.description,
      content: payload.content,
      contentType: payload.contentType,
      hasMandatoryQuiz: payload.hasMandatoryQuiz === true,
      createdByName: _user.displayName ?? "Admin",
      createdBy: _user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { lessonCount: increment(1), updatedAt: serverTimestamp() });
  },

  async updateLesson(
    courseId: string,
    lessonId: string,
    payload: { title: string; description: string; content: string; contentType: string; hasMandatoryQuiz?: boolean },
  ) {
    const lessonRef = doc(db, "lessons", courseId, "lessons", lessonId);
    await updateDoc(lessonRef, {
      title: payload.title,
      description: payload.description,
      content: payload.content,
      contentType: payload.contentType,
      hasMandatoryQuiz: payload.hasMandatoryQuiz === true,
      updatedAt: serverTimestamp(),
    });
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { updatedAt: serverTimestamp() });
  },

  async deleteLesson(courseId: string, lessonId: string) {
    const lessonRef = doc(db, "lessons", courseId, "lessons", lessonId);
    await deleteDoc(lessonRef);
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef);
    const current = (courseSnap.data() as { lessonCount?: number } | undefined)?.lessonCount ?? 0;
    if (current > 0) {
      await updateDoc(courseRef, { lessonCount: increment(-1), updatedAt: serverTimestamp() });
    }
  },
};
