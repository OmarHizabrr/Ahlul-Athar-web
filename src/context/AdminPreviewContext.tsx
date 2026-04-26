import { createContext, useContext, type ReactNode } from "react";

const AdminPreviewContext = createContext(false);

export function AdminPreviewProvider({ children }: { children: ReactNode }) {
  return <AdminPreviewContext.Provider value={true}>{children}</AdminPreviewContext.Provider>;
}

/** صحيح داخل `/admin/preview/...` — يمكّن عرض واجهة الطالب دون تسجيل في المقرر. */
export function useIsAdminPreview(): boolean {
  return useContext(AdminPreviewContext);
}
