import {
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import type { PlatformUser } from "../types";
import { buildScheduleWriteFields } from "../utils/quizScheduleFields";

const quizFilesCol = (lessonId: string) => collection(db, "quiz_files", lessonId, "quiz_files");
const questionsCol = (quizFileId: string) => collection(db, "quiz_questions", quizFileId, "quiz_questions");
const optionsCol = (questionId: string) => collection(db, "question_options", questionId, "question_options");
const answersCol = (quizFileId: string) => collection(db, "quiz_answers", quizFileId, "quiz_answers");

export type QuizQuestionKind = "multiple_choice" | "true_false" | "open";

export type AdminQuizListItem = { id: string; data: DocumentData };

export async function adminListQuizFiles(lessonId: string): Promise<AdminQuizListItem[]> {
  const snap = await getDocs(quizFilesCol(lessonId));
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/** بيانات واجهة للجدولة — نفس الحقول التي يقرأها `evaluateQuizSchedule` في واجهة الطالب. */
export type QuizFileScheduleForm = { hasScheduledTime: boolean; start: string; end: string };

export type QuizFileFormInput = {
  title: string;
  description?: string;
  duration?: number;
  videoUrl?: string;
  /** عند إرساله من نموذج: يضبط `hasScheduledTime` و`startDate`/`endDate`/`startTime`/`endTime`. */
  schedule?: QuizFileScheduleForm;
};

export async function adminCreateQuizFile(
  lessonId: string,
  user: PlatformUser,
  input: QuizFileFormInput,
): Promise<string> {
  const name = user.displayName?.trim() || user.email?.trim() || "—";
  const ref = doc(quizFilesCol(lessonId));
  const data: Record<string, unknown> = {
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    duration: input.duration != null && Number.isFinite(input.duration) ? input.duration : 0,
    videoUrl: (input.videoUrl ?? "").trim(),
    questionsCount: 0,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByName: name,
  };
  if (input.schedule != null) {
    try {
      const sch = buildScheduleWriteFields(
        input.schedule.hasScheduledTime,
        input.schedule.start,
        input.schedule.end,
        "create",
      );
      Object.assign(data, sch);
    } catch {
      throw new Error("invalid schedule");
    }
  } else {
    data.hasScheduledTime = false;
  }
  await setDoc(ref, data);
  return ref.id;
}

export async function adminUpdateQuizFile(
  lessonId: string,
  quizFileId: string,
  input: Partial<QuizFileFormInput>,
): Promise<void> {
  const r = doc(db, "quiz_files", lessonId, "quiz_files", quizFileId);
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.title != null) {
    patch.title = input.title.trim();
  }
  if (input.description != null) {
    patch.description = input.description.trim();
  }
  if (input.duration != null) {
    patch.duration = input.duration;
  }
  if (input.videoUrl != null) {
    patch.videoUrl = input.videoUrl.trim();
  }
  if (input.schedule != null) {
    try {
      const sch = buildScheduleWriteFields(
        input.schedule.hasScheduledTime,
        input.schedule.start,
        input.schedule.end,
        "update",
      );
      Object.assign(patch, sch);
    } catch {
      throw new Error("invalid schedule");
    }
  }
  await updateDoc(r, patch);
}

async function updateQuestionsCount(lessonId: string, quizFileId: string): Promise<void> {
  const n = (await getDocs(questionsCol(quizFileId))).size;
  await updateDoc(doc(db, "quiz_files", lessonId, "quiz_files", quizFileId), {
    questionsCount: n,
    updatedAt: serverTimestamp(),
  });
}

/** حذف كل خيارات سؤال (لإعادة كتابتها عند التعديل أو قبل حذف السؤال). */
export async function adminDeleteAllOptionsForQuestion(questionId: string): Promise<void> {
  const snap = await getDocs(optionsCol(questionId));
  const batch = writeBatch(db);
  for (const d of snap.docs) {
    batch.delete(d.ref);
  }
  await batch.commit();
}

export type AdminQuestionDoc = {
  id: string;
  data: DocumentData;
  options: { id: string; text: string; order: number }[];
};

export async function adminListQuestionDocs(quizFileId: string): Promise<AdminQuestionDoc[]> {
  const snap = await getDocs(questionsCol(quizFileId));
  const rows: { id: string; data: DocumentData; order: number }[] = snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, data, order: typeof data.order === "number" ? data.order : 0 };
  });
  rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const optionSnaps = await Promise.all(rows.map((row) => getDocs(optionsCol(row.id))));
  return rows.map((row, i) => {
    const os = optionSnaps[i]!;
    const opts = os.docs
      .map((od) => {
        const odat = od.data();
        return {
          id: od.id,
          text: String(odat.text ?? ""),
          order: typeof odat.order === "number" ? odat.order : 0,
        };
      })
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    return { id: row.id, data: row.data, options: opts };
  });
}

async function nextQuestionOrder(quizFileId: string): Promise<number> {
  const snap = await getDocs(questionsCol(quizFileId));
  let max = 0;
  for (const d of snap.docs) {
    const o = d.data().order;
    if (typeof o === "number" && o > max) {
      max = o;
    }
  }
  return max + 1;
}

export async function adminAddQuestion(
  lessonId: string,
  quizFileId: string,
  user: PlatformUser,
  kind: QuizQuestionKind,
  title: string,
  body: string,
  optionLines: string[],
): Promise<void> {
  const name = user.displayName?.trim() || user.email?.trim() || "—";
  const qref = doc(questionsCol(quizFileId));
  const order = await nextQuestionOrder(quizFileId);
  await setDoc(qref, {
    title: title.trim(),
    question: body.trim(),
    type: kind,
    maxPoints: 10,
    order,
    isActive: true,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    createdByName: name,
  });
  if (kind === "multiple_choice" && optionLines.length > 0) {
    for (let i = 0; i < optionLines.length; i++) {
      const text = optionLines[i]!.trim();
      if (!text) {
        continue;
      }
      const oref = doc(optionsCol(qref.id));
      await setDoc(oref, { text, order: i + 1, isCorrect: false });
    }
  }
  await updateQuestionsCount(lessonId, quizFileId);
}

export async function adminUpdateQuestion(
  lessonId: string,
  quizFileId: string,
  user: PlatformUser,
  questionId: string,
  kind: QuizQuestionKind,
  title: string,
  body: string,
  optionLines: string[],
): Promise<void> {
  const name = user.displayName?.trim() || user.email?.trim() || "—";
  const qref = doc(db, "quiz_questions", quizFileId, "quiz_questions", questionId);
  await updateDoc(qref, {
    title: title.trim(),
    question: body.trim(),
    type: kind,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedByName: name,
  });
  await adminDeleteAllOptionsForQuestion(questionId);
  if (kind === "multiple_choice" && optionLines.length > 0) {
    for (let i = 0; i < optionLines.length; i++) {
      const text = optionLines[i]!.trim();
      if (!text) {
        continue;
      }
      const oref = doc(optionsCol(questionId));
      await setDoc(oref, { text, order: i + 1, isCorrect: false });
    }
  }
  await updateQuestionsCount(lessonId, quizFileId);
}

export async function adminDeleteQuestion(
  lessonId: string,
  quizFileId: string,
  questionId: string,
): Promise<void> {
  await adminDeleteAllOptionsForQuestion(questionId);
  await deleteDoc(doc(db, "quiz_questions", quizFileId, "quiz_questions", questionId));
  await updateQuestionsCount(lessonId, quizFileId);
}

async function deleteAllInCollection(col: ReturnType<typeof collection>): Promise<void> {
  const snap = await getDocs(col);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + 500)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

/**
 * مثل تطبيق Flutter: حذف وثيقة تقدم الطالب للدرس لكل المستخدمين (بعد تغيير/حذف اختبارات الدرس).
 * المسار: `student_lesson_progress/{uid}/student_lesson_progress/{lessonId}`.
 */
async function adminResetAllStudentLessonProgressForLesson(lessonId: string): Promise<void> {
  const q = query(collectionGroup(db, "student_lesson_progress"), where(documentId(), "==", lessonId));
  const snap = await getDocs(q);
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + 500)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

/**
 * حذف اختبار كامل: إجابات الطلاب، ثم أسئلة وخيارات، ثم مستند الاختبار،
 * ثم إعادة تعيين تقدم الدرس لجميع الطلاب (مطابقة Flutter).
 */
export async function adminDeleteQuizFile(lessonId: string, quizFileId: string): Promise<void> {
  await deleteAllInCollection(answersCol(quizFileId));
  const qSnap = await getDocs(questionsCol(quizFileId));
  for (const q of qSnap.docs) {
    await adminDeleteAllOptionsForQuestion(q.id);
    await deleteDoc(q.ref);
  }
  await deleteDoc(doc(db, "quiz_files", lessonId, "quiz_files", quizFileId));
  await adminResetAllStudentLessonProgressForLesson(lessonId);
}

export type AdminQuizAnswerRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentPhotoURL?: string;
  status: string;
  submittedAt: unknown;
  score: unknown;
  answers: Record<string, unknown>;
};

function answerTimeMs(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "object" && v !== null && "toMillis" in v) {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

/** قراءة كل إجابات الطلاب لملف اختبار (للمشرف فقط في القواعد). */
export async function adminListQuizAnswers(quizFileId: string): Promise<AdminQuizAnswerRow[]> {
  const snap = await getDocs(answersCol(quizFileId));
  const rows: AdminQuizAnswerRow[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      studentId: String(x.studentId ?? ""),
      studentName: String(x.studentName ?? ""),
      studentPhotoURL:
        typeof x.studentPhotoURL === "string" && x.studentPhotoURL.trim()
          ? x.studentPhotoURL.trim()
          : typeof x.userPhotoURL === "string" && x.userPhotoURL.trim()
            ? x.userPhotoURL.trim()
            : undefined,
      status: String(x.status ?? ""),
      submittedAt: x.submittedAt,
      score: x.score != null ? x.score : x.grade,
      answers: (x.answers as Record<string, unknown>) ?? {},
    };
  });
  rows.sort((a, b) => answerTimeMs(b.submittedAt) - answerTimeMs(a.submittedAt));
  return rows;
}

/**
 * اعتماد التصحيح — `status: graded` كي يُحتسب الاجتياز في `hasStudentPassedLessonQuiz`.
 */
export async function adminGradeQuizAnswer(
  quizFileId: string,
  answerId: string,
  admin: PlatformUser,
  score: number | null,
): Promise<void> {
  const r = doc(db, "quiz_answers", quizFileId, "quiz_answers", answerId);
  const patch: Record<string, unknown> = {
    status: "graded",
    gradedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    gradedBy: admin.uid,
    gradedByName: admin.displayName?.trim() || admin.email?.trim() || "—",
  };
  if (score != null && Number.isFinite(score)) {
    patch.score = score;
  } else {
    patch.score = deleteField();
  }
  await updateDoc(r, patch);
}

/** إعادة الإجابة إلى completed (لتصحيح لاحق) — يزيل درجة التصحيح. */
export async function adminReopenQuizAnswer(quizFileId: string, answerId: string): Promise<void> {
  const r = doc(db, "quiz_answers", quizFileId, "quiz_answers", answerId);
  await updateDoc(r, {
    status: "completed",
    updatedAt: serverTimestamp(),
    gradedAt: deleteField(),
    gradedBy: deleteField(),
    gradedByName: deleteField(),
    score: deleteField(),
  });
}
