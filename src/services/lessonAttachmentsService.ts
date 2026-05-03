import {
  collection,
  getDocs,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { LessonAttachment } from "../types";

const attachmentsForLesson = (lessonId: string) => collection(db, "lesson_attachments", lessonId, "lesson_attachments");

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

function mapAttachment(lessonId: string, id: string, data: DocumentData): LessonAttachment {
  const title =
    String(data.title ?? data.name ?? data.label ?? "").trim() ||
    String(data.url ?? data.link ?? "").trim().slice(0, 80) ||
    id;
  const url = String(data.url ?? data.link ?? data.fileUrl ?? "").trim();
  const rawType = String(data.type ?? "link").trim().toLowerCase();
  return {
    id,
    lessonId: String(data.lessonId ?? lessonId),
    courseId: data.courseId != null ? String(data.courseId) : undefined,
    title,
    description: data.description != null ? String(data.description).trim() : undefined,
    url,
    type: rawType,
    createdAt: data.createdAt,
    createdByName: data.createdByName != null ? String(data.createdByName) : undefined,
  };
}

/**
 * مرفقات الدرس كما في تطبيق Flutter: `lesson_attachments/{lessonId}/lesson_attachments/{id}`.
 */
export const lessonAttachmentsService = {
  async listByLessonId(lessonId: string): Promise<LessonAttachment[]> {
    if (!lessonId) {
      return [];
    }
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      const q = query(attachmentsForLesson(lessonId), orderBy("createdAt", "desc"));
      docs = (await getDocs(q)).docs;
    } catch {
      const raw = (await getDocs(attachmentsForLesson(lessonId))).docs;
      return raw
        .map((d) => mapAttachment(lessonId, d.id, d.data()))
        .sort((a, b) => timeMillisFromUnknown(b.createdAt) - timeMillisFromUnknown(a.createdAt));
    }
    return docs.map((d) => mapAttachment(lessonId, d.id, d.data()));
  },
};
