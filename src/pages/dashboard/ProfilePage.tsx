import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/authService";
import { userProfileService } from "../../services/userProfileService";
import { ButtonBusyLabel, PageLoadHint } from "../../components/ButtonBusyLabel";
import { DashboardLayout } from "../DashboardLayout";
import type { UserFirestoreProfile, UserRole } from "../../types";

function displayInitials(displayName: string, email: string) {
  const s = (displayName || email || "?").trim();
  if (!s) {
    return "?";
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }
  return s.charAt(0)!.toUpperCase();
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function ProfilePage({ role }: { role: UserRole }) {
  const { user: u, ready, syncUserFromStorage } = useAuth();
  const [profile, setProfile] = useState<UserFirestoreProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
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
        showMsg("تعذر تحميل الملف.", true);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, u]);

  const effectivePhoto = u?.photoURL || profile?.photoURL || null;
  const emailDisplay = u?.email || profile?.email || "—";
  const showName = displayName.trim() || u?.displayName || "—";

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
      showMsg("تم حفظ التعديلات.", false);
    } catch {
      showMsg("تعذر الحفظ.", true);
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
        showMsg("اختر ملف صورة (PNG أو JPEG).", true);
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        showMsg("حجم الصورة كبير جداً (الحد 5 ميغابايت).", true);
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
          showMsg("تم تحديث صورة الملف الشخصي.", false);
        } catch {
          showMsg("تعذر رفع الصورة. تحقق من صلاحيات التخزين.", true);
        } finally {
          setPhotoUploading(false);
        }
      })();
    },
    [u, syncUserFromStorage],
  );

  const profileLede = "تعديل الاسم والجوال وصورة الملف — يطابق مستند المستخدم في Firestore وتطبيق الجوال.";

  if (!ready) {
    return (
      <DashboardLayout role={role} title="الملف الشخصي" lede={profileLede}>
        <PageLoadHint text="جاري التهيئة..." />
      </DashboardLayout>
    );
  }

  if (!u) {
    return null;
  }

  return (
    <DashboardLayout role={role} title="الملف الشخصي" lede={profileLede}>
      {loading ? (
        <PageLoadHint />
      ) : (
        <div className="profile-page">
          <div className="profile-hero card-elevated">
            <div className="profile-avatar-block">
              {effectivePhoto ? (
                <img
                  className="profile-avatar-lg"
                  src={effectivePhoto}
                  alt={showName}
                  width={112}
                  height={112}
                />
              ) : (
                <div className="profile-avatar-fallback-lg" aria-hidden>
                  {displayInitials(displayName, emailDisplay === "—" ? "" : emailDisplay)}
                </div>
              )}
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
                <ButtonBusyLabel busy={photoUploading}>تغيير الصورة</ButtonBusyLabel>
              </button>
            </div>
            <div className="profile-hero-text">
              <h2 className="profile-display-name">{showName}</h2>
              <p className="muted profile-email-line">{emailDisplay}</p>
              {profile != null && profile.profileCompleted ? (
                <span className="profile-badge-complete">مكتمل</span>
              ) : (
                <span className="profile-badge-incomplete">يُنصح بإكمال البيانات</span>
              )}
            </div>
          </div>

          <form className="course-form profile-form card-elevated" onSubmit={onSave}>
            <h3 className="form-section-title">تعديل البيانات</h3>
            <p className="muted small">المعرّف: {u.uid}</p>
            <label>
              <span>الاسم الظاهر</span>
              <input
                className="text-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              <span>رقم الجوال (للتوثيق داخل التطبيق)</span>
              <input
                className="text-input"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                type="tel"
                autoComplete="tel"
              />
            </label>
            <button className="primary-btn" type="submit" disabled={saving} aria-busy={saving}>
              <ButtonBusyLabel busy={saving}>حفظ التعديلات</ButtonBusyLabel>
            </button>
          </form>
        </div>
      )}
      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
    </DashboardLayout>
  );
}
