import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Lang = "ar" | "en" | "chichewa";
type FlatMap = Record<string, string>;

const I18N_LOCAL_KEY = "ah:lang";

const I18nContext = createContext<{
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: string, fallback?: string) => string;
  tr: (arabicText: string) => string;
}>({
  lang: "ar",
  setLang: () => undefined,
  t: (_key, fallback = "") => fallback,
  tr: (arabicText) => arabicText,
});

function flattenStrings(node: unknown, out: FlatMap = {}, prefix = ""): FlatMap {
  if (typeof node === "string") {
    out[prefix] = node;
    return out;
  }
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    flattenStrings(v, out, key);
  }
  return out;
}

function walkTextNodes(root: ParentNode, cb: (node: Text) => void) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null = walker.nextNode();
  while (n) {
    cb(n as Text);
    n = walker.nextNode();
  }
}

function translateInDom(root: ParentNode, arToTarget: Map<string, string>) {
  walkTextNodes(root, (node) => {
    const original = node.nodeValue?.trim();
    if (!original) return;
    const translated = arToTarget.get(original);
    if (translated && translated !== original) {
      node.nodeValue = node.nodeValue?.replace(original, translated) ?? node.nodeValue;
    }
  });
  const attrs = ["placeholder", "title", "aria-label"] as const;
  const elements = root instanceof Document ? root.querySelectorAll("*") : (root as Element).querySelectorAll("*");
  for (const el of Array.from(elements)) {
    for (const attr of attrs) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const translated = arToTarget.get(value.trim());
      if (translated && translated !== value) {
        el.setAttribute(attr, translated);
      }
    }
  }
}

function translateInlineText(text: string, arToTarget: Map<string, string>): string {
  let next = text;
  for (const [ar, target] of arToTarget.entries()) {
    if (!ar || ar === target) continue;
    if (next.includes(ar)) {
      next = next.replaceAll(ar, target);
    }
  }
  return next;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = window.localStorage.getItem(I18N_LOCAL_KEY);
    if (saved === "en" || saved === "chichewa" || saved === "ar") return saved;
    return "ar";
  });
  const [arFlat, setArFlat] = useState<FlatMap>({});
  const [targetFlat, setTargetFlat] = useState<FlatMap>({});

  useEffect(() => {
    window.localStorage.setItem(I18N_LOCAL_KEY, lang);
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang === "chichewa" ? "ny" : lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const t = useMemo(
    () => (key: string, fallback?: string) => {
      const fromTarget = targetFlat[key];
      if (typeof fromTarget === "string" && fromTarget.trim()) return fromTarget;
      const fromAr = arFlat[key];
      if (typeof fromAr === "string" && fromAr.trim()) return fromAr;
      return fallback ?? key;
    },
    [arFlat, targetFlat],
  );

  useEffect(() => {
    if (!Object.keys(arFlat).length) return;
    document.title = t("web_shell.document_title", "أهل الأثر | منصة تعليمية متكاملة");
  }, [arFlat, targetFlat, t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [arRes, targetRes] = await Promise.all([
        fetch("/lang/ar.json"),
        fetch(`/lang/${lang}.json`),
      ]);
      const [arJson, targetJson] = await Promise.all([arRes.json(), targetRes.json()]);
      if (cancelled) return;
      setArFlat(flattenStrings(arJson));
      setTargetFlat(flattenStrings(targetJson));
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const arToTarget = useMemo(() => {
    const m = new Map<string, string>();
    for (const [k, arVal] of Object.entries(arFlat)) {
      const targetVal = targetFlat[k];
      if (typeof arVal === "string" && typeof targetVal === "string") {
        m.set(arVal.trim(), targetVal.trim());
      }
    }
    return m;
  }, [arFlat, targetFlat]);

  const tr = useMemo(
    () => (arabicText: string) => {
      if (lang === "ar") return arabicText;
      return arToTarget.get(arabicText.trim()) ?? arabicText;
    },
    [arToTarget, lang],
  );

  useEffect(() => {
    if (lang === "ar") return;
    translateInDom(document, arToTarget);
    const observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of Array.from(rec.addedNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent?.trim();
            if (!t) continue;
            const translated = arToTarget.get(t);
            if (translated) {
              node.textContent = translated;
              continue;
            }
            const originalNodeText = node.textContent ?? "";
            const inlineTranslated = translateInlineText(originalNodeText, arToTarget);
            if (inlineTranslated !== originalNodeText) {
              node.textContent = inlineTranslated;
            }
            continue;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateInDom(node as Element, arToTarget);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [lang, arToTarget]);

  return <I18nContext.Provider value={{ lang, setLang, t, tr }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
