import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import type { LessonWithAccess } from "../types";
import { lessonsService } from "./lessonsService";

const progressPath = (studentId: string, lessonId: string) =>
  doc(db, "student_lesson_progress", studentId, "student_lesson_progress", lessonId);

export async function getStudentLessonProgress(
  studentId: string,
  lessonId: string,
): Promise<Record<string, unknown> | null> {
  const s = await getDoc(progressPath(studentId, lessonId));
  if (!s.exists()) {
    return null;
  }
  return s.data() as Record<string, unknown>;
}

/** `quiz_files/{lessonId}/quiz_files` */
async function listQuizFilesForLesson(lessonId: string): Promise<{ id: string; data: DocumentData }[]> {
  const col = collection(db, "quiz_files", lessonId, "quiz_files");
  const snap = await getDocs(col);
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * `quiz_answers/{quizFileId}/quiz_answers` — إجابة الطلب الحالية (كما getStudentAnswerForQuizFile).
 */
export async function getStudentAnswerForQuiz(
  quizFileId: string,
  studentId: string,
): Promise<Record<string, unknown> | null> {
  const col = collection(db, "quiz_answers", quizFileId, "quiz_answers");
  const q = query(col, where("studentId", "==", studentId), limit(1));
  const snap = await getDocs(q);
  const d = snap.docs[0];
  if (!d) {
    return null;
  }
  return { id: d.id, ...d.data() } as Record<string, unknown>;
}

/**
 * بيانات ملف اختبار درس (مستند `quiz_files/{lessonId}/quiz_files/{id}`).
 */
export async function getQuizFileById(
  lessonId: string,
  quizFileId: string,
): Promise<DocumentData | null> {
  const r = doc(db, "quiz_files", lessonId, "quiz_files", quizFileId);
  const s = await getDoc(r);
  if (!s.exists()) {
    return null;
  }
  return s.data();
}

/**
 * تسليم إجابات الطالب من الويب. الحالة `submitted` حتى يُعيّن المسؤول/التطبيق `graded` للنجاح.
 */
export async function submitOrUpdateStudentQuiz(
  quizFileId: string,
  studentId: string,
  answers: Record<string, string>,
  existingDocumentId: string | null,
): Promise<void> {
  const col = collection(db, "quiz_answers", quizFileId, "quiz_answers");
  if (existingDocumentId) {
    const ref = doc(db, "quiz_answers", quizFileId, "quiz_answers", existingDocumentId);
    await updateDoc(ref, {
      studentId,
      answers,
      status: "submitted",
      updatedAt: serverTimestamp(),
    });
  } else {
    await addDoc(col, {
      studentId,
      answers,
      status: "submitted",
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
}

export type LessonQuizItemStatus = "none" | "pending" | "graded";

export type LessonQuizItem = {
  quizFileId: string;
  title: string;
  status: LessonQuizItemStatus;
};

/**
 * اختبارات الدرس وحالة إجابة الطالب (للواجهة).
 */
export async function getLessonQuizzesForStudent(
  studentId: string,
  lessonId: string,
): Promise<LessonQuizItem[]> {
  const files = await listQuizFilesForLesson(lessonId);
  const out: LessonQuizItem[] = [];
  for (const f of files) {
    const d = f.data;
    const title = String(
      d.title ?? d.name ?? d.quizTitle ?? (d as { label?: string }).label ?? "اختبار",
    );
    const ans = await getStudentAnswerForQuiz(f.id, studentId);
    let status: LessonQuizItemStatus = "none";
    if (ans) {
      const s = String(ans.status ?? "");
      status = s === "graded" ? "graded" : "pending";
    }
    out.push({ quizFileId: f.id, title, status });
  }
  return out;
}

/**
 * اجتاز الطالب جميع اختبارات الدرس (الحالة graded) أو لا يوجد اختبارات.
 */
export async function hasStudentPassedLessonQuiz(
  studentId: string,
  lessonId: string,
): Promise<boolean> {
  const files = await listQuizFilesForLesson(lessonId);
  if (files.length === 0) {
    return true;
  }
  for (const f of files) {
    const ans = await getStudentAnswerForQuiz(f.id, studentId);
    if (ans == null || String(ans.status ?? "") !== "graded") {
      return false;
    }
  }
  return true;
}

/**
 * منطق قريب من `getStudentLessonsStatus` في Flutter: أول درس مفتوح دائماً، ثم اختياري حسب
 * `isUnlocked` في التقدم أو اختبارات الدرس السابق.
 */
export async function getLessonsWithAccessForStudent(
  studentId: string,
  courseId: string,
): Promise<LessonWithAccess[]> {
  const raw = await lessonsService.listByCourseIdChronologicalAsc(courseId);
  const out: LessonWithAccess[] = [];

  for (let i = 0; i < raw.length; i++) {
    const lesson = raw[i];
    let isUnlocked = i === 0;
    let blockHint: string | undefined;

    if (i > 0) {
      const progress = await getStudentLessonProgress(studentId, lesson.id);
      isUnlocked = progress != null && progress.isUnlocked === true;
      if (!isUnlocked) {
        const previous = raw[i - 1];
        if (previous.hasMandatoryQuiz === true) {
          const passed = await hasStudentPassedLessonQuiz(studentId, previous.id);
          isUnlocked = passed;
          if (!passed) {
            blockHint = "يتطلب اجتياز اختبار الدرس السابق";
          }
        } else {
          isUnlocked = true;
        }
      }
    }

    if (!isUnlocked && !blockHint) {
      blockHint = "مقفل";
    }

    out.push({ lesson, isUnlocked, blockHint: isUnlocked ? undefined : blockHint });
  }

  return out;
}

/**
 * فتح الدرس في الصفحة — يطابق منطق `canStudentAccessLesson` (بدون أدوار إدمن هنا).
 */
export async function canStudentOpenLesson(
  studentId: string,
  courseId: string,
  lessonId: string,
): Promise<{ ok: boolean; message?: string }> {
  const ordered = await lessonsService.listByCourseIdChronologicalAsc(courseId);
  const idx = ordered.findIndex((l) => l.id === lessonId);
  if (idx < 0) {
    return { ok: false, message: "الدرس غير ضمن المقرر." };
  }

  if (idx === 0) {
    return { ok: true };
  }

  const progress = await getStudentLessonProgress(studentId, lessonId);
  if (progress != null && progress.isUnlocked === true) {
    return { ok: true };
  }

  const previous = ordered[idx - 1];
  if (previous.hasMandatoryQuiz === true) {
    const passed = await hasStudentPassedLessonQuiz(studentId, previous.id);
    if (!passed) {
      return {
        ok: false,
        message: "لا يمكن فتح هذا الدرس قبل اجتياز الاختبار الإجباري في الدرس السابق.",
      };
    }
  }
  // بدون اختبار إجباري في الدرس السابق، أو بعد الاجتياز: مسموح (مطابق نهاية canStudentAccessLesson في Flutter)
  return { ok: true };
}
