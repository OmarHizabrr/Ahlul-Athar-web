import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
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
};
