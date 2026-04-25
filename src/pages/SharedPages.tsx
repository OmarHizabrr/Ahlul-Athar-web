import { DashboardLayout } from "./DashboardLayout";
import type { UserRole } from "../types";

export function HomePage({ role }: { role: UserRole }) {
  return (
    <DashboardLayout role={role} title="الصفحة الأساسية">
      <div className="grid-2">
        <div className="mini-card">ملخص الحساب</div>
        <div className="mini-card">آخر النشاطات</div>
        <div className="mini-card">الوصول السريع</div>
        <div className="mini-card">إحصائيات اليوم</div>
      </div>
    </DashboardLayout>
  );
}

export function CoursesPage({ role }: { role: UserRole }) {
  return (
    <DashboardLayout role={role} title="الدورات">
      <div className="grid-2">
        <div className="mini-card">{role === "admin" ? "إدارة الدورات" : "دوراتي المسجلة"}</div>
        <div className="mini-card">{role === "admin" ? "طلبات التسجيل" : "الدروس المتاحة"}</div>
      </div>
    </DashboardLayout>
  );
}

export function PostsPage({ role }: { role: UserRole }) {
  return (
    <DashboardLayout role={role} title="المنشورات">
      <div className="grid-2">
        <div className="mini-card">{role === "admin" ? "إدارة المنشورات" : "آخر المنشورات"}</div>
        <div className="mini-card">{role === "admin" ? "إنشاء منشور" : "تفاصيل المنشور"}</div>
      </div>
    </DashboardLayout>
  );
}

export function NotificationsPage({ role }: { role: UserRole }) {
  return (
    <DashboardLayout role={role} title="الإشعارات">
      <div className="grid-2">
        <div className="mini-card">الإشعارات الحديثة</div>
        <div className="mini-card">{role === "admin" ? "إدارة الإشعارات" : "الإشعارات الأكاديمية"}</div>
      </div>
    </DashboardLayout>
  );
}

export function ProfilePage({ role }: { role: UserRole }) {
  return (
    <DashboardLayout role={role} title="الملف الشخصي">
      <div className="grid-2">
        <div className="mini-card">البيانات الأساسية</div>
        <div className="mini-card">تعديل الحساب</div>
      </div>
    </DashboardLayout>
  );
}
