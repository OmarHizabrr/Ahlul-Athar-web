import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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
      profileCompleted: false,
      createdBy: user.uid,
      createdByName: user.displayName ?? "",
      createdAt: snapshot.exists() ? snapshot.data().createdAt : serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const authService = {
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
