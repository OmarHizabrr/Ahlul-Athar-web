/**
 * تطبيع بيانات أسئلة اختبار من وثيقة `quiz_files` (أشكال شائعة) أو دمجها مع
 * مسار `quiz_questions` (تطبيق الجوال).
 */
export type WebQuizRowKind = "multiple_choice" | "true_false" | "open";

export type WebQuizRow = {
  key: string;
  /** سطر عرضي مركّب (للتوافق مع واجهات سابقة) */
  text: string;
  title: string;
  body: string;
  kind: WebQuizRowKind;
  options?: string[];
};

function rowKey(i: number): string {
  return `q${i}`;
}

function inferKind(o: Record<string, unknown>, hasOptions: boolean): WebQuizRowKind {
  const t = String(o.type ?? "").toLowerCase().replaceAll("_", "");
  if (t === "multiplechoice" || t === "mcq") {
    return "multiple_choice";
  }
  if (t === "truefalse" || t === "true_false") {
    return "true_false";
  }
  if (hasOptions) {
    return "multiple_choice";
  }
  return "open";
}

export function extractQuizRows(quiz: Record<string, unknown>): WebQuizRow[] {
  const raw =
    (quiz.questions as unknown) ??
    (quiz as { Questions?: unknown }).Questions ??
    (quiz as { questionList?: unknown }).questionList ??
    (quiz as { questionsList?: unknown }).questionsList ??
    (quiz as { items?: unknown }).items;

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  return raw.map((row, i) => {
    const o = row as Record<string, unknown>;
    const title = String(o.title ?? "");
    const body = String(
      o.question ?? o.text ?? o.title ?? o.label ?? o.name ?? (title ? "" : `سؤال ${i + 1}`),
    );
    const opts = o.options ?? o.choices ?? o.answers;
    const options = Array.isArray(opts)
      ? opts.map((x) => (typeof x === "string" ? x : String((x as { text?: string }).text ?? x)))
      : undefined;
    const hasOpt = (options && options.length > 0) === true;
    const kind = inferKind(o, hasOpt);
    const key = o.id != null && String(o.id).length > 0 ? String(o.id) : rowKey(i);
    const text = title && body ? `${title}\n${body}` : body || title;
    return {
      key,
      text,
      title,
      body,
      kind,
      options: kind === "multiple_choice" && hasOpt && options ? options : undefined,
    };
  });
}

/**
 * لعرض إجابات مُخزّنة — مفاتيح = معرّف السؤال؛ صح/خطأ تُقارن كقيمة منطقية.
 */
export function readStoredAnswers(
  data: Record<string, unknown> | null,
  questionKeys: string[],
): Record<string, string> | null {
  if (data == null) {
    return null;
  }
  const a =
    (data.answers as Record<string, unknown> | undefined) ??
    (data.responses as Record<string, unknown> | undefined) ??
    (data.userAnswers as Record<string, unknown> | undefined);
  if (a == null || typeof a !== "object") {
    return null;
  }
  const out: Record<string, string> = {};
  for (const k of questionKeys) {
    if (!(k in a)) {
      continue;
    }
    const v = a[k];
    if (typeof v === "boolean") {
      out[k] = v ? "true" : "false";
    } else {
      out[k] = v != null ? String(v) : "";
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
