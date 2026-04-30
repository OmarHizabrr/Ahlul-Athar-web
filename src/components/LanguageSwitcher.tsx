import { useI18n } from "../context/I18nContext";

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <label className="lang-switcher">
      <span className="lang-switcher-label">اللغة</span>
      <select
        className="lang-switcher-select"
        value={lang}
        onChange={(e) => setLang(e.target.value as "ar" | "en" | "chichewa")}
      >
        <option value="ar">العربية</option>
        <option value="en">English</option>
        <option value="chichewa">Chichewa</option>
      </select>
    </label>
  );
}
