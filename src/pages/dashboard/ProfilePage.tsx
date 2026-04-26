import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { DashboardLayout } from "../DashboardLayout";
import { authService } from "../../services/authService";
import { userProfileService } from "../../services/userProfileService";
import type { UserFirestoreProfile, UserRole } from "../../types";

export function ProfilePage({ role }: { role: UserRole }) {
  const { user: u, ready, syncUserFromStorage } = useAuth();
  const [profile, setProfile] = useState<UserFirestoreProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
        setMessage("تعذر تحميل الملف.");
        setIsError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, u]);

  if (!ready) {
    return (
      <DashboardLayout role={role} title="الملف الشخصي">
        <p className="muted">جاري التهيئة...</p>
      </DashboardLayout>
    );
  }

  if (!u) {
    return null;
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const next = await userProfileService.updateProfile(u, { displayName, phoneNumber });
      authService.persistLocalUser(next);
      syncUserFromStorage();
      setMessage("تم حفظ التعديلات.");
      setIsError(false);
    } catch {
      setMessage("تعذر الحفظ.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role={role} title="الملف الشخصي">
      {loading ? (
        <p className="muted">جاري التحميل...</p>
      ) : (
        <form className="course-form" onSubmit={onSave}>
          <p className="muted small">المعرّف: {u.uid}</p>
          <p className="muted small">البريد: {u.email || profile?.email || "—"}</p>
          <label>
            <span>الاسم الظاهر</span>
            <input
              className="text-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            <span>رقم الجوال (للتوثيق داخل التطبيق)</span>
            <input
              className="text-input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              type="tel"
            />
          </label>
          <button className="primary-btn" type="submit" disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </form>
      )}
      {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
    </DashboardLayout>
  );
}
