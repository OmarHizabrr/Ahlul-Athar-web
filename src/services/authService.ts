import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { PlatformUser, UserRole } from "../types";

const STORAGE_KEY = "almosawa_user";

const phoneToEmailAlias = (phone: string) => {
  const normalized = phone.replace(/[^\d]/g, "");
  return `${normalized}@almosawa.app`;
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
    const alias = phoneToEmailAlias(phone);
    await signInWithEmailAndPassword(auth, alias, password);
    const mapped = mapFirebaseUser(role);
    await createOrUpdateUserDoc(mapped);
    saveLocalUser(mapped);
    return mapped;
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
