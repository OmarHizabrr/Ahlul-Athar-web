/** هل يبدو المحتوى HTML (مثل WebView في تطبيق الجوال)؟ */
export function looksLikeLessonHtml(s: string): boolean {
  const t = s.trim();
  if (t.length < 4) {
    return false;
  }
  return /<\s*[a-z][\s\S]*>/i.test(t) && /<\/?[a-z][a-z0-9]*/i.test(t);
}

/** إزالة عناصر خطرة بسيطة قبل عرض HTML من إدارة المحتوى (ليس بديلاً كاملاً عن DOMPurify). */
export function sanitizeLessonHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi, "");
}
