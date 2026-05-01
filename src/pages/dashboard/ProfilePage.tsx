import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { authService } from "../../services/authService";
import { userProfileService } from "../../services/userProfileService";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import { AlertMessage, AppTabPanel, AppTabs, Avatar, FormPanel, Panel, SectionTitle } from "../../components/ui";
import { DashboardLayout } from "../DashboardLayout";
import type { UserFirestoreProfile, UserRole } from "../../types";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function ProfilePage({ role }: { role: UserRole }) {
  const [searchParams] = useSearchParams();
  const { user: u, ready, syncUserFromStorage } = useAuth();
  const { t } = useI18n();
  const dashEm = t("web_shell.dash_em", "—");
  const [profile, setProfile] = useState<UserFirestoreProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [profileTab, setProfileTab] = useState<"card" | "edit">("card");
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showMsg = (text: string, err: boolean) => {
    setMessage(text);
    setIsError(err);
  };

  useEffect(() => {
    if (!ready || !u) {
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const p = await userProfileService.getProfile(u.uid, u.role);
        setProfile(p);
        setDisplayName(p.displayName || u.displayName || "");
        setPhoneNumber(p.phoneNumber || u.phoneNumber || "");
      } catch {
        showMsg(t("web_pages.profile.load_failed", "تعذر تحميل الملف."), true);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, u, t]);

  useEffect(() => {
    if (searchParams.get("complete") === "1") {
      setProfileTab("edit");
      showMsg(
        t("web_pages.profile.complete_hint", "يرجى إكمال الملف الشخصي (الاسم + الجوال) قبل متابعة الاستخدام."),
        false,
      );
    }
  }, [searchParams, t]);

  const effectivePhoto = u?.photoURL || profile?.photoURL || null;
  const emailDisplay = u?.email || profile?.email || dashEm;
  const showName = displayName.trim() || u?.displayName || dashEm;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!u) {
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const next = await userProfileService.updateProfile(u, { displayName, phoneNumber });
      authService.persistLocalUser(next);
      syncUserFromStorage();
      showMsg(t("web_pages.profile.save_ok", "تم حفظ التعديلات."), false);
    } catch {
      showMsg(t("web_pages.profile.save_failed", "تعذر الحفظ."), true);
    } finally {
      setSaving(false);
    }
  };

  const onPhotoSelected = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !u) {
        return;
      }
      if (!file.type.startsWith("image/")) {
        showMsg(t("web_pages.profile.err_image_type", "اختر ملف صورة (PNG أو JPEG)."), true);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        showMsg(t("web_pages.profile.err_image_size", "حجم الصورة كبير جداً (الحد 5 ميغابايت)."), true);
        return;
      }
      void (async () => {
        setPhotoUploading(true);
        setMessage("");
        try {
          const next = await userProfileService.uploadProfilePhoto(u, file);
          authService.persistLocalUser(next);
          syncUserFromStorage();
          const p = await userProfileService.getProfile(u.uid, u.role);
          setProfile(p);
          showMsg(t("web_pages.profile.photo_ok", "تم تحديث صورة الملف الشخصي."), false);
        } catch {
          showMsg(t("web_pages.profile.photo_failed", "تعذر رفع الصورة. تحقق من صلاحيات التخزين."), true);
        } finally {
          setPhotoUploading(false);
        }
      })();
    },
    [u, syncUserFromStorage, t],
  );

  const onSavePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!u) return;
    const normalizedPhone = phoneNumber.replace(/[^\d]/g, "");
    if (!normalizedPhone) {
      showMsg(t("web_pages.profile.phone_required_first", "أدخل رقم الجوال أولاً ثم احفظه."), true);
      return;
    }
    setSavingPassword(true);
    try {
      await authService.setPhonePasswordForCurrentUser(normalizedPhone, password);
      setPassword("");
      showMsg(t("web_pages.profile.password_ok", "تم ضبط كلمة المرور للدخول برقم الجوال بنجاح."), false);
    } catch {
      showMsg(t("web_pages.profile.password_failed", "تعذر ضبط كلمة المرور. أعد تسجيل الدخول وحاول مرة أخرى."), true);
    } finally {
      setSavingPassword(false);
    }
  };

  if (!ready) {
    return (
      <DashboardLayout
        role={role}
        title={t("web_pages.profile.title", "الملف الشخصي")}
        lede={t(
          "web_pages.profile.lede",
          "تعديل الاسم والجوال وصورة الملف — يطابق مستند المستخدم في Firestore وتطبيق الجوال.",
        )}
      >
        <PageLoadHint text={t("web_shell.auth_initializing", "جاري التهيئة...")} />
      </DashboardLayout>
    );
  }

  if (!u) {
    return null;
  }

  return (
    <DashboardLayout
      role={role}
      title={t("web_pages.profile.title", "الملف الشخصي")}
      lede={t(
        "web_pages.profile.lede",
        "تعديل الاسم والجوال وصورة الملف — يطابق مستند المستخدم في Firestore وتطبيق الجوال.",
      )}
    >
      {loading ? (
        <PageLoadHint />
      ) : (
        <div className="profile-page">
          <AppTabs
            groupId={`profile-${u.uid}`}
            ariaLabel={t("web_pages.profile.tabs_aria", "أقسام الملف الشخصي")}
            value={profileTab}
            onChange={setProfileTab}
            tabs={[
              { id: "card" as const, label: t("web_pages.profile.tab_card", "البطاقة والصورة") },
              { id: "edit" as const, label: t("web_pages.profile.tab_edit", "تعديل البيانات") },
            ]}
          />
          <AppTabPanel tabId="card" groupId={`profile-${u.uid}`} hidden={profileTab !== "card"} className="lesson-tab-panel">
          <Panel className="profile-hero">
            <div className="profile-avatar-block">
              <Avatar
                photoURL={effectivePhoto}
                displayName={displayName}
                email={emailDisplay === dashEm ? "" : emailDisplay}
                alt={showName}
                imageClassName="profile-avatar-lg"
                fallbackClassName="profile-avatar-fallback-lg"
                size={112}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="visually-hidden"
                accept="image/*"
                onChange={onPhotoSelected}
              />
              <button
                type="button"
                className="ghost-btn profile-photo-btn"
                disabled={photoUploading}
                onClick={() => fileInputRef.current?.click()}
                aria-busy={photoUploading}
              >
                <ButtonBusyLabel busy={photoUploading}>
                  {t("web_pages.profile.change_photo", "تغيير الصورة")}
                </ButtonBusyLabel>
              </button>
            </div>
            <div className="profile-hero-text">
              <h2 className="profile-display-name">{showName}</h2>
              <p className="muted profile-email-line">{emailDisplay}</p>
              {profile != null && profile.profileCompleted ? (
                <span className="profile-badge-complete">{t("web_pages.profile.badge_complete", "مكتمل")}</span>
              ) : (
                <span className="profile-badge-incomplete">
                  {t("web_pages.profile.badge_incomplete", "يُنصح بإكمال البيانات")}
                </span>
              )}
            </div>
          </Panel>
          </AppTabPanel>

          <AppTabPanel tabId="edit" groupId={`profile-${u.uid}`} hidden={profileTab !== "edit"} className="lesson-tab-panel">
          <FormPanel className="profile-form" onSubmit={onSave}>
            <SectionTitle as="h3">{t("web_pages.profile.tab_edit", "تعديل البيانات")}</SectionTitle>
            <p className="muted small">
              {t("web_pages.profile.uid_label", "المعرّف")}: {u.uid}
            </p>
            <label>
              <span>{t("web_pages.profile.display_name", "الاسم الظاهر")}</span>
              <input
                className="text-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              <span>{t("web_pages.profile.phone_label", "رقم الجوال (للتوثيق داخل التطبيق)")}</span>
              <input
                className="text-input"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                type="tel"
                autoComplete="tel"
              />
            </label>
            <button className="primary-btn" type="submit" disabled={saving} aria-busy={saving}>
              <ButtonBusyLabel busy={saving}>{t("web_pages.posts.save_changes", "حفظ التعديلات")}</ButtonBusyLabel>
            </button>
          </FormPanel>
          <FormPanel className="profile-form" onSubmit={onSavePassword}>
            <SectionTitle as="h3">{t("web_pages.profile.password_section", "إعداد كلمة مرور دخول الجوال")}</SectionTitle>
            <p className="muted small">
              {t(
                "web_pages.profile.password_hint",
                "بعد الدخول عبر Google، يمكنك تعيين كلمة مرور للدخول لاحقاً باستخدام الجوال + كلمة المرور.",
              )}
            </p>
            <label>
              <span>{t("web_pages.profile.new_password", "كلمة المرور الجديدة")}</span>
              <input
                className="text-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={t("web_pages.login.toggle_password_aria", "إظهار أو إخفاء كلمة المرور")}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
            <button className="primary-btn" type="submit" disabled={savingPassword} aria-busy={savingPassword}>
              <ButtonBusyLabel busy={savingPassword}>
                {t("web_pages.profile.save_password", "حفظ كلمة المرور")}
              </ButtonBusyLabel>
            </button>
          </FormPanel>
          </AppTabPanel>
        </div>
      )}
      {message ? <AlertMessage kind={isError ? "error" : "success"}>{message}</AlertMessage> : null}
    </DashboardLayout>
  );
}
