import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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

/** بيانات الدرس كما في تطبيق Flutter: نص + روابط + خيارات. */
export type LessonWritePayload = {
  title: string;
  description: string;
  content: string;
  contentType: string;
  hasMandatoryQuiz?: boolean;
  videoUrl?: string;
  pdfUrl?: string;
  audioUrl?: string;
  duration?: string;
  difficulty?: string;
};

function mergeLessonFields(payload: LessonWritePayload, isUpdate: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: payload.title,
    description: payload.description,
    content: payload.content,
    contentType: payload.contentType,
    hasMandatoryQuiz: payload.hasMandatoryQuiz === true,
    updatedAt: serverTimestamp(),
  };
  const urls = {
    videoUrl: (payload.videoUrl ?? "").trim(),
    pdfUrl: (payload.pdfUrl ?? "").trim(),
    audioUrl: (payload.audioUrl ?? "").trim(),
  } as const;
  for (const k of Object.keys(urls) as (keyof typeof urls)[]) {
    const t = urls[k];
    if (t) {
      out[k] = t;
    } else if (isUpdate) {
      out[k] = deleteField();
    }
  }
  const dur = (payload.duration ?? "").toString().trim();
  if (dur !== "") {
    const n = Number(dur);
    if (!Number.isNaN(n) && n >= 0) {
      out.duration = n;
    }
  } else if (isUpdate) {
    out.duration = deleteField();
  }
  const diff = (payload.difficulty ?? "").trim();
  if (diff) {
    out.difficulty = diff;
  } else if (isUpdate) {
    out.difficulty = deleteField();
  }
  return out;
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

  async createLesson(_user: PlatformUser, courseId: string, payload: LessonWritePayload) {
    const col = lessonsForCourse(courseId);
    const data = mergeLessonFields(payload, false);
    data.createdByName = _user.displayName ?? "Admin";
    data.createdBy = _user.uid;
    data.createdAt = serverTimestamp();
    await addDoc(col, data);
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { lessonCount: increment(1), updatedAt: serverTimestamp() });
  },

  async updateLesson(courseId: string, lessonId: string, payload: LessonWritePayload) {
    const lessonRef = doc(db, "lessons", courseId, "lessons", lessonId);
    const data = mergeLessonFields(payload, true);
    await updateDoc(lessonRef, data);
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
