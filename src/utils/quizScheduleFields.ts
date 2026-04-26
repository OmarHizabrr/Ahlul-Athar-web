import { Timestamp, deleteField } from "firebase/firestore";

function firestoreToDate(v: unknown): Date | null {
  if (v == null) {
    return null;
  }
  if (v instanceof Object && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return null;
}

function timeObj(v: unknown): { hour: number; minute: number } {
  if (v != null && typeof v === "object" && "hour" in v && "minute" in v) {
    const o = v as { hour: unknown; minute: unknown };
    const h = Number(o.hour);
    const m = Number(o.minute);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return { hour: h, minute: m };
    }
  }
  return { hour: 0, minute: 0 };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** لقيم `datetime-local` من مستند اختبار (مثل `quiz_file_solve_page` في Flutter). */
export function quizDocumentToScheduleFormStrings(
  quiz: Record<string, unknown> | null | undefined,
): { hasScheduledTime: boolean; start: string; end: string } {
  if (quiz == null || quiz.hasScheduledTime !== true) {
    return { hasScheduledTime: false, start: "", end: "" };
  }
  const sd = firestoreToDate(quiz.startDate);
  const ed = firestoreToDate(quiz.endDate);
  const st = timeObj(quiz.startTime);
  const et = timeObj(quiz.endTime);
  const toLocal = (d: Date | null, t: { hour: number; minute: number }): string => {
    if (d == null) {
      return "";
    }
    const full = new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.hour, t.minute, 0, 0);
    return `${full.getFullYear()}-${pad2(full.getMonth() + 1)}-${pad2(full.getDate())}T${pad2(full.getHours())}:${pad2(full.getMinutes())}`;
  };
  return {
    hasScheduledTime: true,
    start: toLocal(sd, st),
    end: toLocal(ed, et),
  };
}

type Parsed = { day: Date; t: { hour: number; minute: number } };

function parseDatetimeLocal(s: string): Parsed | null {
  if (!s || !s.trim()) {
    return null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return {
    day: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
    t: { hour: d.getHours(), minute: d.getMinutes() },
  };
}

/**
 * لكتابة Firestore: `startDate`/`endDate` كـ Timestamps (يوم فقط) و`startTime`/`endTime` كساعة/دقيقة.
 * عند `hasScheduledTime: false` يعيد `deleteField()` للحقول الأربعة (للتحديث فقط).
 */
export function buildScheduleWriteFields(
  hasScheduledTime: boolean,
  start: string,
  end: string,
  mode: "create" | "update",
): Record<string, unknown> {
  if (!hasScheduledTime) {
    if (mode === "update") {
      return {
        hasScheduledTime: false,
        startDate: deleteField(),
        endDate: deleteField(),
        startTime: deleteField(),
        endTime: deleteField(),
      };
    }
    return { hasScheduledTime: false };
  }
  const a = parseDatetimeLocal(start);
  const b = parseDatetimeLocal(end);
  if (!a || !b) {
    throw new Error("schedule");
  }
  return {
    hasScheduledTime: true,
    startDate: Timestamp.fromDate(a.day),
    endDate: Timestamp.fromDate(b.day),
    startTime: a.t,
    endTime: b.t,
  };
}
