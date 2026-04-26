import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { UserNotification, UserRole } from "../types";

const notifCol = collection(db, "notifications");

function timeMillisFromUnknown(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof (v as { toMillis: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

function mapNotif(d: QueryDocumentSnapshot<DocumentData>): UserNotification {
  const data = d.data();
  return {
    id: d.id,
    userId: String(data.userId ?? ""),
    title: String(data.title ?? ""),
    body: String(data.body ?? data.message ?? ""),
    read: Boolean(data.read ?? false),
    createdAt: data.createdAt,
  };
}

export const notificationsService = {
  async listForUser(uid: string): Promise<UserNotification[]> {
    try {
      const q = query(notifCol, where("userId", "==", uid), orderBy("createdAt", "desc"));
      return (await getDocs(q)).docs.map(mapNotif);
    } catch {
      const q2 = query(notifCol, where("userId", "==", uid));
      const raw = (await getDocs(q2)).docs;
      return raw
        .map(mapNotif)
        .sort((a, b) => timeMillisFromUnknown(b.createdAt) - timeMillisFromUnknown(a.createdAt));
    }
  },

  async countUnread(uid: string): Promise<number> {
    const all = await this.listForUser(uid);
    return all.filter((n) => !n.read).length;
  },

  async markRead(notificationId: string) {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  },

  async markAllReadForUser(uid: string) {
    const items = await this.listForUser(uid);
    await Promise.all(items.filter((n) => !n.read).map((n) => this.markRead(n.id)));
  },

  /**
   * إرسال إشعار لمستخدم — يُستخدم من لوحة المسؤول.
   * لإشعار جميع الطلاب: استدعاء متعدد من الواجهة أو دالة منفصلة لاحقاً.
   */
  async sendToUser(_senderRole: UserRole, targetUserId: string, title: string, body: string) {
    if (!targetUserId.trim()) {
      throw new Error("target_user_required");
    }
    await addDoc(notifCol, {
      userId: targetUserId.trim(),
      title: title.trim(),
      body: body.trim(),
      read: false,
      createdAt: serverTimestamp(),
    });
  },
};
