/**
 * تطبيع بيانات أسئلة اختبار من وثيقة `quiz_files` (أشكال شائعة مع Flutter/لوحة التحكم).
 */
export type WebQuizRow = { key: string; text: string; options?: string[] };

function rowKey(i: number): string {
  return `q${i}`;
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
    const text = String(
      o.question ?? o.text ?? o.title ?? o.label ?? o.name ?? `سؤال ${i + 1}`,
    );
    const opts = o.options ?? o.choices ?? o.answers;
    const options = Array.isArray(opts)
      ? opts.map((x) => (typeof x === "string" ? x : String((x as { text?: string }).text ?? x)))
      : undefined;
    return {
      key: rowKey(i),
      text,
      options: options && options.length > 0 ? options : undefined,
    };
  });
}

/** لعرض إجابات مُخزّنة (أسماء حقول شائعة). */
export function readStoredAnswers(
  data: Record<string, unknown> | null,
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
  for (const k of Object.keys(a)) {
    out[k] = String(a[k] ?? "");
  }
  return Object.keys(out).length > 0 ? out : null;
}
