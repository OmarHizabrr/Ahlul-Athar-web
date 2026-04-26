/** يُرسل بعد تغيير اختبار/أسئلة لتحدّث صفحات الطالب (مستمع في الدرس/المقرر). */
export function dispatchQuizUpdated(): void {
  window.dispatchEvent(new CustomEvent("ah:quiz-updated"));
}
