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
import type { WebQuizRow } from "../utils/quizFromFirestore";
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

function firestoreDate(v: unknown): Date | null {
  if (v == null) {
    return null;
  }
  if (v instanceof Object && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return null;
}

function timeObjToParts(v: unknown): { hour: number; minute: number } | null {
  if (v == null || typeof v !== "object") {
    return null;
  }
  const o = v as { hour?: unknown; minute?: unknown };
  const hour = Number(o.hour);
  const minute = Number(o.minute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return { hour, minute };
}

/**
 * فترة الاختبار المجدولة (كما `quiz_file_solve_page` في Flutter).
 */
export function evaluateQuizSchedule(quiz: Record<string, unknown>): {
  allowed: boolean;
  messageAr?: string;
} {
  if (quiz.hasScheduledTime !== true) {
    return { allowed: true };
  }
  const now = new Date();

  let startDateTime: Date | null = null;
  const sDate = firestoreDate(quiz.startDate);
  if (sDate) {
    const st = timeObjToParts(quiz.startTime);
    if (st) {
      startDateTime = new Date(
        sDate.getFullYear(),
        sDate.getMonth(),
        sDate.getDate(),
        st.hour,
        st.minute,
        0,
        0,
      );
    } else {
      startDateTime = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), 0, 0, 0, 0);
    }
  }

  let endDateTime: Date | null = null;
  const eDate = firestoreDate(quiz.endDate);
  if (eDate) {
    const et = timeObjToParts(quiz.endTime);
    if (et) {
      endDateTime = new Date(
        eDate.getFullYear(),
        eDate.getMonth(),
        eDate.getDate(),
        et.hour,
        et.minute,
        0,
        0,
      );
    } else {
      endDateTime = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate(), 23, 59, 59, 999);
    }
  }

  const fmt = (d: Date) =>
    `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} - ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  if (startDateTime && now < startDateTime) {
    let extra = "";
    if (startDateTime) {
      extra += `\nبداية النافذة: ${fmt(startDateTime)}`;
    }
    if (endDateTime) {
      extra += `\nنهاية النافذة: ${fmt(endDateTime)}`;
    }
    return {
      allowed: false,
      messageAr: `لم يبدأ الاختبار بعد.${extra}`,
    };
  }
  if (endDateTime && now > endDateTime) {
    let extra = "";
    if (startDateTime) {
      extra += `\nبداية النافذة: ${fmt(startDateTime)}`;
    }
    if (endDateTime) {
      extra += `\nنهاية النافذة: ${fmt(endDateTime)}`;
    }
    return {
      allowed: false,
      messageAr: `انتهت فترة الاختبار.${extra}`,
    };
  }
  return { allowed: true };
}

export type QuizQuestionKind = "multiple_choice" | "true_false" | "open";

export type QuizQuestionDef = {
  id: string;
  kind: QuizQuestionKind;
  title: string;
  body: string;
  optionTexts: string[];
  /** الدرجة القصوى للسؤال (افتراضي 10 كما في Flutter) */
  maxPoints: number;
  /** للعرض بعد التصحيح إن وُجد في السؤال */
  correctAnswer?: string;
};

async function fetchOptionTextsForQuestion(questionId: string): Promise<string[]> {
  const ocol = collection(db, "question_options", questionId, "question_options");
  const osnap = await getDocs(ocol);
  const opts = osnap.docs.map((od) => {
    const odat = od.data();
    const o = typeof odat.order === "number" ? odat.order : 0;
    return { o, text: String(odat.text ?? "") };
  });
  opts.sort((a, b) => a.o - b.o || 0);
  return opts.map((p) => p.text).filter((x) => x.length > 0);
}

/**
 * `quiz_questions/{quizFileId}/quiz_questions` + `question_options` (مثل `getQuizFileQuestions` في Flutter).
 * جلب خيارات MCQ بشكل متوازٍ؛ سؤال اختيار من متعدد بلا خيارات يُعامَل كسؤال مفتوح.
 */
export async function getQuizQuestionsWithOptions(quizFileId: string): Promise<QuizQuestionDef[]> {
  const col = collection(db, "quiz_questions", quizFileId, "quiz_questions");
  const snap = await getDocs(col);
  type Row = { id: string; order: number; data: DocumentData };
  const rows: Row[] = snap.docs.map((d) => {
    const data = d.data();
    const order = typeof data.order === "number" ? data.order : 0;
    return { id: d.id, order, data };
  });
  rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const mcqIds: string[] = [];
  for (const { id, data } of rows) {
    const t = String((data as { type?: string }).type ?? "open");
    if (t === "multiple_choice") {
      mcqIds.push(id);
    }
  }
  const optionSets = await Promise.all(mcqIds.map((qid) => fetchOptionTextsForQuestion(qid)));
  const optionsById = new Map<string, string[]>();
  for (let i = 0; i < mcqIds.length; i++) {
    const id = mcqIds[i]!;
    optionsById.set(id, optionSets[i]!);
  }

  const out: QuizQuestionDef[] = [];
  for (const { id, data } of rows) {
    const t = String((data as { type?: string }).type ?? "open");
    let kind: QuizQuestionKind =
      t === "multiple_choice" ? "multiple_choice" : t === "true_false" ? "true_false" : "open";
    const title = String((data as { title?: string }).title ?? "");
    const body = String((data as { question?: string }).question ?? "");
    let optionTexts: string[] = kind === "multiple_choice" ? (optionsById.get(id) ?? []) : [];
    if (kind === "multiple_choice" && optionTexts.length === 0) {
      kind = "open";
    }
    const mpRaw = (data as { maxPoints?: unknown }).maxPoints;
    const maxPoints =
      typeof mpRaw === "number" && Number.isFinite(mpRaw) && mpRaw > 0 ? Math.round(mpRaw) : 10;
    const caRaw = (data as { correctAnswer?: unknown }).correctAnswer;
    const correctAnswer =
      caRaw != null && String(caRaw).trim() !== "" ? String(caRaw).trim() : undefined;
    out.push({ id, kind, title, body, optionTexts, maxPoints, correctAnswer });
  }
  return out;
}

/** وجود أسئلة في المسار الفرعي كما في التطبيق (بدون جلب خيارات MCQ). */
export async function quizHasStructuredQuestions(quizFileId: string): Promise<boolean> {
  const col = collection(db, "quiz_questions", quizFileId, "quiz_questions");
  const snap = await getDocs(query(col, limit(1)));
  return snap.docs.length > 0;
}

/** لمسار `questions` داخل وثيقة الاختبار (ميراث) — يُسجَّل بمفاتيح q0 أو id إن وُجد. */
export function webRowsToQuestionDefs(rows: WebQuizRow[]): QuizQuestionDef[] {
  return rows.map((r) => {
    let kind = r.kind;
    const optionTexts = r.kind === "multiple_choice" ? (r.options ?? []) : [];
    if (kind === "multiple_choice" && optionTexts.length === 0) {
      kind = "open";
    }
    return {
      id: r.key,
      kind,
      title: r.title,
      body: r.body,
      optionTexts: kind === "multiple_choice" ? optionTexts : [],
      maxPoints: 10,
      correctAnswer: undefined,
    };
  });
}

/**
 * بُنية إجابات مثل Flutter: `answers` مفتاح = معرف السؤال؛ MCQ = نص الخيار؛ صح/خطأ = boolean؛ مفتوح = نص.
 * الحالة `completed` حتى يُعيّن `graded` للتصحيح.
 */
export function buildStudentAnswersMap(
  questions: QuizQuestionDef[],
  stringValues: Record<string, string>,
): Record<string, string | boolean> {
  const answers: Record<string, string | boolean> = {};
  for (const q of questions) {
    const raw = (stringValues[q.id] ?? "").toString();
    if (q.kind === "true_false") {
      answers[q.id] = raw === "true";
    } else {
      answers[q.id] = raw;
    }
  }
  return answers;
}

/**
 * تسليم إجابات الطالب — نفس الحقول الأساسية لـ`addStudentAnswerToQuizFile` في Flutter.
 */
export async function submitOrUpdateStudentQuiz(
  quizFileId: string,
  studentId: string,
  studentName: string,
  questions: QuizQuestionDef[],
  stringValues: Record<string, string>,
  existingDocumentId: string | null,
): Promise<void> {
  const answers = buildStudentAnswersMap(questions, stringValues);
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).filter((k) => {
    const v = answers[k];
    if (typeof v === "boolean") {
      return true;
    }
    return (v as string).trim().length > 0;
  }).length;

  const col = collection(db, "quiz_answers", quizFileId, "quiz_answers");
  const payload: Record<string, unknown> = {
    studentId,
    studentName,
    answers,
    status: "completed",
    totalQuestions,
    answeredQuestions: answeredCount,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (existingDocumentId) {
    const ref = doc(db, "quiz_answers", quizFileId, "quiz_answers", existingDocumentId);
    await updateDoc(ref, payload);
  } else {
    await addDoc(col, {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
}

/** حالة تسليم الاختبار كما تُعرض في قائمة درس التطبيق */
export type LessonQuizItemStatus = "none" | "pending" | "graded" | "approved" | "rejected";

export type LessonQuizItem = {
  quizFileId: string;
  title: string;
  status: LessonQuizItemStatus;
  /** يوجد `quiz_questions/{id}/...` — تظهر تبويبة النتيجة في صفحة الاختبار */
  hasStructuredQuestions: boolean;
};

function answerDocToLessonQuizStatus(ans: Record<string, unknown> | null): LessonQuizItemStatus {
  if (ans == null) {
    return "none";
  }
  const s = String(ans.status ?? "").toLowerCase();
  if (s === "graded") {
    return "graded";
  }
  if (s === "approved") {
    return "approved";
  }
  if (s === "rejected") {
    return "rejected";
  }
  return "pending";
}

/**
 * اختبارات الدرس وحالة إجابة الطالب (للواجهة).
 */
export async function getLessonQuizzesForStudent(
  studentId: string,
  lessonId: string,
): Promise<LessonQuizItem[]> {
  const files = await listQuizFilesForLesson(lessonId);
  return await Promise.all(
    files.map(async (f) => {
      const d = f.data;
      const title = String(
        d.title ?? d.name ?? d.quizTitle ?? (d as { label?: string }).label ?? "اختبار",
      );
      const [ans, hasStructuredQuestions] = await Promise.all([
        getStudentAnswerForQuiz(f.id, studentId),
        quizHasStructuredQuestions(f.id),
      ]);
      return {
        quizFileId: f.id,
        title,
        status: answerDocToLessonQuizStatus(ans),
        hasStructuredQuestions,
      };
    }),
  );
}

/** قائمة اختبارات الدرس للمعاينة (مشرف) — بلا تسليم طالب. */
export async function getLessonQuizzesForAdminPreview(lessonId: string): Promise<LessonQuizItem[]> {
  const files = await listQuizFilesForLesson(lessonId);
  return await Promise.all(
    files.map(async (f) => {
      const d = f.data;
      const title = String(
        d.title ?? d.name ?? d.quizTitle ?? (d as { label?: string }).label ?? "اختبار",
      );
      const hasStructuredQuestions = await quizHasStructuredQuestions(f.id);
      return { quizFileId: f.id, title, status: "none" as const, hasStructuredQuestions };
    }),
  );
}

/**
 * اجتاز الطالب جميع اختبارات الدرس (مقيّم أو مقبول كما في التطبيق) أو لا يوجد اختبارات.
 * المرفوض أو بلا إجابة أو بانتظار التصحيح = لم يجتز.
 */
export async function hasStudentPassedLessonQuiz(
  studentId: string,
  lessonId: string,
): Promise<boolean> {
  const files = await listQuizFilesForLesson(lessonId);
  if (files.length === 0) {
    return true;
  }
  const answers = await Promise.all(files.map((f) => getStudentAnswerForQuiz(f.id, studentId)));
  for (const ans of answers) {
    const st = answerDocToLessonQuizStatus(ans);
    if (st !== "graded" && st !== "approved") {
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

/** كطلاب يُرى المقرر بكل دروسه مفتوحة (معاينة مشرف). */
export async function getLessonsForAdminPreview(courseId: string): Promise<LessonWithAccess[]> {
  const raw = await lessonsService.listByCourseIdChronologicalAsc(courseId);
  return raw.map((lesson) => ({
    lesson,
    isUnlocked: true,
    blockHint: undefined,
  }));
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
