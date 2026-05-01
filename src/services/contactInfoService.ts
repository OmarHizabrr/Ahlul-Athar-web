import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase";
import type { ContactChannel, ContactChannelKind } from "../types";

const contactInfosCol = collection(db, "contact_infos");

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** رابط قابل للاستخدام في واجهة الزائر. */
export function contactChannelHref(c: ContactChannel): string {
  const v = c.value.trim();
  switch (c.kind) {
    case "phone":
      return `tel:${digitsOnly(v)}`;
    case "whatsapp": {
      const d = digitsOnly(v);
      return d ? `https://wa.me/${d}` : "#";
    }
    case "email":
      return `mailto:${v}`;
    case "link":
      if (/^https?:\/\//i.test(v)) return v;
      return `https://${v}`;
    default:
      return "#";
  }
}

function mapDoc(id: string, data: DocumentData): ContactChannel {
  const kind = (data.kind as ContactChannelKind) || "phone";
  const allowed: ContactChannelKind[] = ["phone", "whatsapp", "email", "link"];
  return {
    id,
    kind: allowed.includes(kind) ? kind : "phone",
    label: typeof data.label === "string" ? data.label : "",
    value: typeof data.value === "string" ? data.value : "",
    sortOrder: typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder) ? data.sortOrder : 0,
  };
}

export async function listContactChannels(): Promise<ContactChannel[]> {
  const q = query(contactInfosCol, orderBy("sortOrder", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function addContactChannel(input: {
  kind: ContactChannelKind;
  label: string;
  value: string;
  sortOrder: number;
}): Promise<string> {
  const ref = await addDoc(contactInfosCol, {
    kind: input.kind,
    label: input.label.trim(),
    value: input.value.trim(),
    sortOrder: input.sortOrder,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateContactChannel(
  id: string,
  patch: Partial<Pick<ContactChannel, "kind" | "label" | "value" | "sortOrder">>,
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.kind != null) payload.kind = patch.kind;
  if (patch.label != null) payload.label = patch.label.trim();
  if (patch.value != null) payload.value = patch.value.trim();
  if (patch.sortOrder != null) payload.sortOrder = patch.sortOrder;
  await updateDoc(doc(db, "contact_infos", id), payload);
}

export async function deleteContactChannel(id: string): Promise<void> {
  await deleteDoc(doc(db, "contact_infos", id));
}
