import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { IoPhonePortraitOutline } from "react-icons/io5";
import { auth } from "./firebase";

const phoneToSyntheticEmail = (phone: string) => {
  const normalized = phone.replace(/[^\d]/g, "");
  return `${normalized}@ahlul-athar.app`;
};

function App() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showMessage = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    showMessage("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showMessage("تم تسجيل الدخول عبر Google بنجاح.");
    } catch (error) {
      showMessage("تعذر تسجيل الدخول عبر Google، تأكد من تفعيل المزود في Firebase.", true);
    } finally {
      setLoading(false);
    }
  };

  const signInWithPhoneAndPassword = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    showMessage("");
    try {
      if (phone.trim().length < 8) {
        throw new Error("invalid-phone");
      }
      if (password.length < 6) {
        throw new Error("weak-password");
      }

      const emailAlias = phoneToSyntheticEmail(phone);
      await signInWithEmailAndPassword(auth, emailAlias, password);
      showMessage("تم تسجيل الدخول بنجاح.");
    } catch (error: unknown) {
      const text =
        error instanceof Error && error.message === "invalid-phone"
          ? "رقم الهاتف غير صالح."
          : error instanceof Error && error.message === "weak-password"
            ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
            : "فشل تسجيل الدخول. تأكد من إنشاء المستخدم بنفس رقم الهاتف وكلمة المرور مسبقًا.";
      showMessage(text, true);
    } finally {
      setLoading(false);
    }
  };

  const installAsApp = async () => {
    if (!installPrompt) {
      return;
    }
    const deferredEvent = installPrompt as Event & {
      prompt: () => Promise<void>;
    };
    await deferredEvent.prompt();
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="badge">Ahlul Athar Platform</p>
        <h1>تسجيل الدخول</h1>
        <p className="subtitle">ابدأ بمنصة حديثة تعمل على الويب وقابلة للتثبيت كتطبيق.</p>

        <button className="google-btn" onClick={signInWithGoogle} disabled={loading}>
          <FcGoogle size={24} />
          <span>{loading ? "جاري التنفيذ..." : "الدخول عبر Google"}</span>
        </button>

        <div className="separator">
          <span>أو</span>
        </div>

        <form onSubmit={signInWithPhoneAndPassword} className="form">
          <label htmlFor="phone">رقم الهاتف</label>
          <div className="input-wrap">
            <IoPhonePortraitOutline size={20} />
            <input
              id="phone"
              type="tel"
              placeholder="مثال: 9665XXXXXXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </div>

          <label htmlFor="password">كلمة المرور</label>
          <input
            id="password"
            type="password"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "جاري الدخول..." : "الدخول برقم الهاتف وكلمة المرور"}
          </button>
        </form>

        {installPrompt ? (
          <button className="install-btn" onClick={installAsApp}>
            تثبيت التطبيق على الجهاز
          </button>
        ) : null}

        {message ? <p className={isError ? "message error" : "message success"}>{message}</p> : null}
      </section>
    </main>
  );
}

export default App;
