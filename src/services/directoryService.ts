import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { AdminRecord, StudentRecord } from "../types";

function mapAdminDoc(d: QueryDocumentSnapshot<DocumentData>): AdminRecord {
  const data = d.data();
  return {
    uid: d.id,
    displayName: String(data.displayName ?? data.name ?? data.createdByName ?? d.id),
    email: data.email != null ? String(data.email) : undefined,
    photoURL: data.photoURL != null ? String(data.photoURL) : data.imageUrl != null ? String(data.imageUrl) : undefined,
    isActive: Boolean(data.isActive ?? true),
    createdAt: data.createdAt,
  };
}

function mapStudentDoc(d: QueryDocumentSnapshot<DocumentData>): StudentRecord {
  const data = d.data();
  return mapStudentData(d.id, data);
}

function mapStudentData(uid: string, data: Record<string, unknown>): StudentRecord {
  return {
    uid,
    displayName: String(data.displayName ?? data.name ?? data.createdByName ?? uid),
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

  async getStudentById(uid: string): Promise<StudentRecord | null> {
    try {
      const s = await getDoc(doc(db, "students", uid));
      if (s.exists()) {
        return mapStudentData(s.id, s.data() as Record<string, unknown>);
      }
    } catch {
      // fallback below
    }
    const u = await getDoc(doc(db, "users", uid));
    if (!u.exists()) return null;
    return mapStudentData(u.id, u.data() as Record<string, unknown>);
  },

  async updateStudentProfile(
    uid: string,
    updates: {
      displayName: string;
      phone: string;
      isActive: boolean;
      isSuspended: boolean;
      isActivated: boolean;
    },
  ) {
    const payload = {
      displayName: updates.displayName.trim(),
      phoneNumber: updates.phone.trim(),
      phone: updates.phone.trim(),
      isActive: updates.isActive,
      isSuspended: updates.isSuspended,
      isActivated: updates.isActivated,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, "users", uid), payload).catch(async () => {
      await setDoc(doc(db, "users", uid), payload, { merge: true });
    });
    await setDoc(doc(db, "students", uid), payload, { merge: true }).catch(() => undefined);
  },
};

