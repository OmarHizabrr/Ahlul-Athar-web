const INVALID_FILE_CHARS = /[\\/:*?"<>|]+/g;

export function safeDownloadFileName(name: string): string {
  const trimmed = name.trim() || "download";
  return trimmed.replace(INVALID_FILE_CHARS, "_").slice(0, 200);
}

/**
 * حفظ الملف محلياً باسم واضح (مماثل لسلوك التطبيق: تحميل وليس مجرد فتح المتصفح).
 * يعتمد على fetch + blob حتى يُحترم اسم الملف مع روابط Firebase.
 */
export async function triggerBrowserDownloadFromUrl(url: string, fileName: string): Promise<void> {
  const name = safeDownloadFileName(fileName);
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
