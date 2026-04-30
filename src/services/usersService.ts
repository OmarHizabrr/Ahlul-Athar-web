import { collection, getDocs, limit, query, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { UserRole } from "../types";

/**
 * لاستخدام واجهة المسؤول (إرسال إشعار، إلخ). يتطلب قواعد Firestore تسمح للمشرف بقراءة users.
 */
export const usersService = {
  async listRecentUsers(max = 200): Promise<{ uid: string; displayName: string; role: UserRole; photoURL?: string; email?: string; isActive?: boolean }[]> {
    const q = query(collection(db, "users"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: String(data.displayName ?? "").trim() || d.id,
        role: (data.role === "admin" ? "admin" : "student") as UserRole,
        photoURL:
          typeof data.photoURL === "string" && data.photoURL.trim()
            ? data.photoURL.trim()
            : typeof data.imageUrl === "string" && data.imageUrl.trim()
              ? data.imageUrl.trim()
              : undefined,
        email: typeof data.email === "string" ? data.email : undefined,
        isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
      };
    });
  },
};
