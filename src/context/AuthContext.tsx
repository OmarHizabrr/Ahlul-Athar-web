import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db } from "../firebase";
import { authService, AUTH_LOCAL_KEY } from "../services/authService";
import type { PlatformUser, UserRole } from "../types";
import { roleFromUserDoc } from "../utils/userDocRole";

type AuthState = {
  ready: boolean;
  user: PlatformUser | null;
};

const AuthContext = createContext<AuthState & { syncUserFromStorage: () => void } | null>(null);

function buildPlatformUser(fb: FirebaseUser, data: Record<string, unknown> | undefined): PlatformUser {
  const role: UserRole = roleFromUserDoc(data);
  return {
    uid: fb.uid,
    role,
    email: fb.email,
    displayName: fb.displayName ?? (data?.displayName != null ? String(data.displayName) : null) ?? null,
    phoneNumber: fb.phoneNumber ?? (data?.phoneNumber != null ? String(data.phoneNumber) : null) ?? null,
    photoURL: fb.photoURL ?? (data?.photoURL != null ? String(data.photoURL) : null) ?? null,
    profileCompleted: Boolean(data?.profileCompleted ?? false),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: false, user: null });

  const syncUserFromStorage = useCallback(() => {
    setState({ ready: true, user: authService.getLocalUser() });
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        localStorage.removeItem(AUTH_LOCAL_KEY);
        setState({ ready: true, user: null });
        return;
      }
      const snap = await getDoc(doc(db, "users", fbUser.uid));
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      const platform = buildPlatformUser(fbUser, data);
      authService.persistLocalUser(platform);
      setState({ ready: true, user: platform });
    });
  }, []);

  const value = useMemo(
    () => ({ ...state, syncUserFromStorage }),
    [state, syncUserFromStorage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
