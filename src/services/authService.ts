import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { PlatformUser, UserRole } from "../types";

export const AUTH_LOCAL_KEY = "almosawa_user";
const STORAGE_KEY = AUTH_LOCAL_KEY;

const PHONE_EMAIL_DOMAINS = ["ahlul-athar.app", "almosawa.app"] as const;

const phoneToEmailAliases = (phone: string) => {
  const normalized = phone.replace(/[^\d]/g, "");
  return PHONE_EMAIL_DOMAINS.map((d) => `${normalized}@${d}`);
};

const mapFirebaseUser = (role: UserRole): PlatformUser => ({
  uid: auth.currentUser?.uid ?? "",
  role,
  email: auth.currentUser?.email,
  displayName: auth.currentUser?.displayName,
  phoneNumber: auth.currentUser?.phoneNumber,
  photoURL: auth.currentUser?.photoURL,
});

const saveLocalUser = (user: PlatformUser) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
};

const createOrUpdateUserDoc = async (user: PlatformUser) => {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  const prior = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
  const profileCompleted = Boolean(
    prior?.profileCompleted ??
      ((user.displayName?.trim() || "").length > 0 && (user.phoneNumber?.trim() || "").length > 0),
  );

  await setDoc(
    userRef,
    {
      uid: user.uid,
      role: user.role,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoURL ?? "",
      phoneNumber: user.phoneNumber ?? "",
      isActive: true,
      profileCompleted,
      createdBy: user.uid,
      createdByName: user.displayName ?? "",
      createdAt: snapshot.exists() ? snapshot.data().createdAt : serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const authService = {
  async setPhonePasswordForCurrentUser(phone: string, password: string) {
    const current = auth.currentUser;
    if (!current) {
      throw new Error("no-auth-user");
    }
    const normalized = phone.replace(/[^\d]/g, "");
    if (!normalized) {
      throw new Error("phone-required");
    }
    if (password.trim().length < 6) {
      throw new Error("password-too-short");
    }
    const alias = phoneToEmailAliases(normalized)[0];
    const credential = EmailAuthProvider.credential(alias, password);
    try {
      await linkWithCredential(current, credential);
    } catch {
      // if already linked, just update password
      await updatePassword(current, password);
    }
    await setDoc(
      doc(db, "users", current.uid),
      { phoneNumber: normalized, phone: normalized, lastUpdatedAt: serverTimestamp() },
      { merge: true },
    );
    const local = this.getLocalUser();
    if (local?.uid === current.uid) {
      this.persistLocalUser({ ...local, phoneNumber: normalized });
    }
  },

  async signInWithGoogle(role: UserRole) {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    const mapped = mapFirebaseUser(role);
    await createOrUpdateUserDoc(mapped);
    saveLocalUser(mapped);
    return mapped;
  },

  async signInWithPhoneAndPassword(role: UserRole, phone: string, password: string) {
    const emails = phoneToEmailAliases(phone);
    let last: unknown;
    for (const email of emails) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        const mapped = mapFirebaseUser(role);
        await createOrUpdateUserDoc(mapped);
        saveLocalUser(mapped);
        return mapped;
      } catch (e) {
        last = e;
      }
    }
    throw last;
  },

  getLocalUser(): PlatformUser | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as PlatformUser;
    } catch {
      return null;
    }
  },

  /** بعد تحديث بيانات الملف في Firestore أو في ذاكرة التطبيق. */
  persistLocalUser(user: PlatformUser) {
    saveLocalUser(user);
  },

  async logout() {
    await signOut(auth);
    localStorage.removeItem(STORAGE_KEY);
  },
};
