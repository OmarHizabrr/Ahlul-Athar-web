import { useI18n } from "../context/I18nContext";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="lang-switcher" title={t("web_shell.lang_picker_title", "اختيار اللغة")}>
      <span className="lang-switcher-icon" aria-hidden>🌐</span>
      <span className="lang-switcher-label">{t("settings.language", "اللغة")}</span>
      <select
        className="lang-switcher-select"
        value={lang}
        aria-label={t("web_shell.lang_switch_aria", "تبديل اللغة")}
        onChange={(e) => setLang(e.target.value as "ar" | "en" | "chichewa")}
      >
        <option value="ar">{`${t("web_shell.language_ar", "العربية")} (AR)`}</option>
        <option value="en">{`${t("web_shell.language_en", "الإنجليزية")} (EN)`}</option>
        <option value="chichewa">{`${t("web_shell.language_chichewa", "تشيشيوا")} (NY)`}</option>
      </select>
    </label>
  );
}
