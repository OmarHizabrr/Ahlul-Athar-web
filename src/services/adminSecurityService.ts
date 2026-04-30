import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const SECURITY_DOC_REF = doc(db, "appConfig", "security");
export const DEFAULT_ADMIN_ACCESS_CODE = "777414709";

function normalizeCode(raw: string): string {
  return raw.trim();
}

export const adminSecurityService = {
  async getAdminAccessCode(): Promise<string> {
    const snap = await getDoc(SECURITY_DOC_REF);
    if (!snap.exists()) return DEFAULT_ADMIN_ACCESS_CODE;
    const raw = snap.data().adminAccessCode;
    const code = typeof raw === "string" ? normalizeCode(raw) : "";
    return code.length > 0 ? code : DEFAULT_ADMIN_ACCESS_CODE;
  },

  async verifyAdminAccessCode(candidate: string): Promise<boolean> {
    const expected = await this.getAdminAccessCode();
    return normalizeCode(candidate) === expected;
  },

  async updateAdminAccessCode(nextCode: string, updatedBy: string) {
    const code = normalizeCode(nextCode);
    if (!code) {
      throw new Error("رمز الدخول لا يمكن أن يكون فارغاً.");
    }
    await setDoc(
      SECURITY_DOC_REF,
      {
        adminAccessCode: code,
        updatedAt: serverTimestamp(),
        updatedBy,
      },
      { merge: true },
    );
  },
};
