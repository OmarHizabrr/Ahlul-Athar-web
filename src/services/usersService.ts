import { collection, getDocs, limit, query, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { UserRole } from "../types";

/**
 * لاستخدام واجهة المسؤول (إرسال إشعار، إلخ). يتطلب قواعد Firestore تسمح للمشرف بقراءة users.
 */
export const usersService = {
  async listRecentUsers(max = 200): Promise<{ uid: string; displayName: string; role: UserRole }[]> {
    const q = query(collection(db, "users"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName: String(data.displayName ?? "").trim() || d.id,
        role: (data.role === "admin" ? "admin" : "student") as UserRole,
      };
    });
  },
};
