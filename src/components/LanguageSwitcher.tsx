import { useI18n } from "../context/I18nContext";

export function LanguageSwitcher() {
  const { lang, setLang, tr } = useI18n();
  return (
    <label className="lang-switcher" title={tr("اختيار اللغة")}>
      <span className="lang-switcher-icon" aria-hidden>🌐</span>
      <span className="lang-switcher-label">{tr("اللغة")}</span>
      <select
        className="lang-switcher-select"
        value={lang}
        aria-label={tr("تبديل اللغة")}
        onChange={(e) => setLang(e.target.value as "ar" | "en" | "chichewa")}
      >
        <option value="ar">{`${tr("العربية")} (AR)`}</option>
        <option value="en">{`${tr("الإنجليزية")} (EN)`}</option>
        <option value="chichewa">{`${tr("تشيشيوا")} (NY)`}</option>
      </select>
    </label>
  );
}
