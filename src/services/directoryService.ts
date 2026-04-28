import { collection, getDocs, limit, orderBy, query, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import type { AdminRecord, StudentRecord } from "../types";

function mapAdminDoc(d: QueryDocumentSnapshot<DocumentData>): AdminRecord {
  const data = d.data();
  return {
    uid: d.id,
    displayName: String(data.displayName ?? data.name ?? data.createdByName ?? d.id),
    email: data.email != null ? String(data.email) : undefined,
    isActive: Boolean(data.isActive ?? true),
    createdAt: data.createdAt,
  };
}

function mapStudentDoc(d: QueryDocumentSnapshot<DocumentData>): StudentRecord {
  const data = d.data();
  return {
    uid: d.id,
    displayName: String(data.displayName ?? data.name ?? data.createdByName ?? d.id),
    email: data.email != null ? String(data.email) : undefined,
    phone: data.phone != null ? String(data.phone) : data.phoneNumber != null ? String(data.phoneNumber) : undefined,
    photoURL: data.photoURL != null ? String(data.photoURL) : undefined,
    isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
    isSuspended: data.isSuspended != null ? Boolean(data.isSuspended) : undefined,
    isActivated: data.isActivated != null ? Boolean(data.isActivated) : undefined,
    createdAt: data.createdAt,
  };
}

/**
 * دليل الإدارة (طلاب/مشرفين).
 * Flutter يعتمد غالبًا على مجموعتي `students` و `admins`.
 * هذه الخدمة تحاول القراءة منها، وإن فشلت ترجع لقائمة `users` إن كانت القواعد تسمح.
 */
export const directoryService = {
  async listAdmins(max = 500): Promise<AdminRecord[]> {
    try {
      const snap = await getDocs(query(collection(db, "admins"), orderBy("createdAt", "desc"), limit(max)));
      return snap.docs.map(mapAdminDoc);
    } catch {
      const snap = await getDocs(query(collection(db, "users"), limit(max)));
      return snap.docs
        .filter((d) => String(d.data().role ?? "student") === "admin")
        .map(mapAdminDoc);
    }
  },

  async listStudents(max = 1000): Promise<StudentRecord[]> {
    try {
      const snap = await getDocs(query(collection(db, "students"), orderBy("createdAt", "desc"), limit(max)));
      return snap.docs.map(mapStudentDoc);
    } catch {
      const snap = await getDocs(query(collection(db, "users"), limit(max)));
      return snap.docs
        .filter((d) => String(d.data().role ?? "student") === "student")
        .map(mapStudentDoc);
    }
  },
};

