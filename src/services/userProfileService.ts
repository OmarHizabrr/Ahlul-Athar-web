import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { auth, db, storage } from "../firebase";
import type { PlatformUser, UserFirestoreProfile, UserRole } from "../types";

function mapUserDoc(uid: string, data: Record<string, unknown>, fallbackRole: UserRole): UserFirestoreProfile {
  return {
    uid,
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    phoneNumber: String(data.phoneNumber ?? ""),
    photoURL: String(data.photoURL ?? ""),
    role:
      data.role === "admin" || data.role === "student"
        ? (data.role as UserRole)
        : fallbackRole,
    profileCompleted: Boolean(data.profileCompleted ?? false),
  };
}

export const userProfileService = {
  async getProfile(uid: string, fallbackRole: UserRole): Promise<UserFirestoreProfile> {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return {
        uid,
        displayName: "",
        email: "",
        phoneNumber: "",
        photoURL: "",
        role: fallbackRole,
        profileCompleted: false,
      };
    }
    return mapUserDoc(uid, snap.data() as Record<string, unknown>, fallbackRole);
  },

  async updateProfile(
    local: PlatformUser,
    updates: { displayName: string; phoneNumber: string },
  ): Promise<PlatformUser> {
    const ref = doc(db, "users", local.uid);
    const displayName = updates.displayName.trim();
    const phoneNumber = updates.phoneNumber.trim();
    await updateDoc(ref, {
      displayName,
      phoneNumber,
      lastUpdatedAt: serverTimestamp(),
      profileCompleted: true,
    });
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: displayName || undefined });
    }
    const next: PlatformUser = {
      ...local,
      displayName: displayName || null,
      phoneNumber: phoneNumber || null,
    };
    return next;
  },

  /**
   * رفع صورة الملف الشخصي إلى Storage وتحديث Firestore ومصادقة Firebase (مثل سلوك التطبيق).
   */
  async uploadProfilePhoto(local: PlatformUser, file: File): Promise<PlatformUser> {
    const ext = (() => {
      const p = file.name.split(".").pop() || "jpg";
      return p.length > 5 ? "jpg" : p;
    })();
    const path = `users/${local.uid}/profile_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
    const url = await getDownloadURL(storageRef);
    const userRef = doc(db, "users", local.uid);
    await setDoc(
      userRef,
      { photoURL: url, lastUpdatedAt: serverTimestamp() },
      { merge: true },
    );
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { photoURL: url });
    }
    return { ...local, photoURL: url };
  },
};
