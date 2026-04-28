import { lazy, Suspense, type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthPageShell } from "./components/AuthPageShell";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { AdminPreviewProvider } from "./context/AdminPreviewContext";
import { useAuth } from "./context/AuthContext";
import type { UserRole } from "./types";

const SplashPage = lazy(() => import("./pages/SplashPage").then((m) => ({ default: m.SplashPage })));
const RoleSelectorPage = lazy(() => import("./pages/RoleSelectorPage").then((m) => ({ default: m.RoleSelectorPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const HomePage = lazy(() => import("./pages/dashboard/HomePage").then((m) => ({ default: m.HomePage })));
const CoursesPage = lazy(() => import("./pages/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const AdminEnrollmentRequestsPage = lazy(() =>
  import("./pages/AdminEnrollmentRequestsPage").then((m) => ({ default: m.AdminEnrollmentRequestsPage })),
);
const AdminAdminsPage = lazy(() => import("./pages/AdminAdminsPage").then((m) => ({ default: m.AdminAdminsPage })));
const AdminStudentsPage = lazy(() => import("./pages/AdminStudentsPage").then((m) => ({ default: m.AdminStudentsPage })));
const AdminFoldersPage = lazy(() => import("./pages/AdminFoldersPage").then((m) => ({ default: m.AdminFoldersPage })));
const AdminFolderViewPage = lazy(() =>
  import("./pages/AdminFolderViewPage").then((m) => ({ default: m.AdminFolderViewPage })),
);
const PostsPage = lazy(() => import("./pages/dashboard/PostsPage").then((m) => ({ default: m.PostsPage })));
const NotificationsPage = lazy(() =>
  import("./pages/dashboard/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() => import("./pages/dashboard/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const StudentMyCoursesPage = lazy(() =>
  import("./pages/StudentMyCoursesPage").then((m) => ({ default: m.StudentMyCoursesPage })),
);
const StudentEnrollmentRequestsPage = lazy(() =>
  import("./pages/StudentEnrollmentRequestsPage").then((m) => ({ default: m.StudentEnrollmentRequestsPage })),
);
const StudentMyFilesPage = lazy(() => import("./pages/StudentMyFilesPage").then((m) => ({ default: m.StudentMyFilesPage })));
const StudentExplorePage = lazy(() => import("./pages/StudentExplorePage").then((m) => ({ default: m.StudentExplorePage })));
const StudentFolderViewPage = lazy(() =>
  import("./pages/StudentFolderViewPage").then((m) => ({ default: m.StudentFolderViewPage })),
);
const StudentCourseViewPage = lazy(() =>
  import("./pages/StudentCourseViewPage").then((m) => ({ default: m.StudentCourseViewPage })),
);
const StudentLessonViewPage = lazy(() =>
  import("./pages/StudentLessonViewPage").then((m) => ({ default: m.StudentLessonViewPage })),
);
const StudentQuizViewPage = lazy(() =>
  import("./pages/StudentQuizViewPage").then((m) => ({ default: m.StudentQuizViewPage })),
);
const AdminCourseLessonsPage = lazy(() =>
  import("./pages/AdminCourseLessonsPage").then((m) => ({ default: m.AdminCourseLessonsPage })),
);
const AdminLessonQuizzesPage = lazy(() =>
  import("./pages/AdminLessonQuizzesPage").then((m) => ({ default: m.AdminLessonQuizzesPage })),
);
const AdminQuizEditorPage = lazy(() =>
  import("./pages/AdminQuizEditorPage").then((m) => ({ default: m.AdminQuizEditorPage })),
);

function AuthLoading() {
  return (
    <AuthPageShell>
      <section className="card splash-card" aria-busy="true">
        <p className="badge">أهل الأثر</p>
        <div className="splash-page-spinner" aria-hidden>
          <span className="btn-spinner" />
        </div>
        <h1>جاري التهيئة...</h1>
        <p className="muted">مزامنة الجلسة مع السحابة</p>
      </section>
    </AuthPageShell>
  );
}

function RouteLoading() {
  return (
    <AuthPageShell>
      <section className="card splash-card" aria-busy="true">
        <p className="badge">أهل الأثر</p>
        <div className="splash-page-spinner" aria-hidden>
          <span className="btn-spinner" />
        </div>
        <h1>جاري فتح الصفحة...</h1>
      </section>
    </AuthPageShell>
  );
}

function ProtectedRoute({ role, children }: { role: UserRole; children: ReactElement }) {
  const { ready, user } = useAuth();
  if (!ready) {
    return <AuthLoading />;
  }
  if (!user) {
    return <Navigate to="/role-selector" replace />;
  }
  if (user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return children;
}

function App() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<SplashPage />} />
          <Route path="/role-selector" element={<RoleSelectorPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <HomePage role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <ProtectedRoute role="admin">
                <CoursesPage role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/enrollment-requests"
            element={
              <ProtectedRoute role="admin">
                <AdminEnrollmentRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/admins"
            element={
              <ProtectedRoute role="admin">
                <AdminAdminsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <ProtectedRoute role="admin">
                <AdminStudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/folders"
            element={
              <ProtectedRoute role="admin">
                <AdminFoldersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/folder/:folderId"
            element={
              <ProtectedRoute role="admin">
                <AdminFolderViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/course/:courseId/lessons"
            element={
              <ProtectedRoute role="admin">
                <AdminCourseLessonsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/course/:courseId/lessons/:lessonId/quizzes"
            element={
              <ProtectedRoute role="admin">
                <AdminLessonQuizzesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/course/:courseId/lessons/:lessonId/quiz/:quizId/edit"
            element={
              <ProtectedRoute role="admin">
                <AdminQuizEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/preview/course/:courseId"
            element={
              <ProtectedRoute role="admin">
                <AdminPreviewProvider>
                  <StudentCourseViewPage />
                </AdminPreviewProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/preview/course/:courseId/lesson/:lessonId"
            element={
              <ProtectedRoute role="admin">
                <AdminPreviewProvider>
                  <StudentLessonViewPage />
                </AdminPreviewProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/preview/course/:courseId/lesson/:lessonId/quiz/:quizId"
            element={
              <ProtectedRoute role="admin">
                <AdminPreviewProvider>
                  <StudentQuizViewPage />
                </AdminPreviewProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/posts"
            element={
              <ProtectedRoute role="admin">
                <PostsPage role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute role="admin">
                <NotificationsPage role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <ProtectedRoute role="admin">
                <ProfilePage role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute role="admin">
                <SettingsPage role="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student"
            element={
              <ProtectedRoute role="student">
                <HomePage role="student" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/courses"
            element={
              <ProtectedRoute role="student">
                <CoursesPage role="student" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/mycourses"
            element={
              <ProtectedRoute role="student">
                <StudentMyCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/enrollment-requests"
            element={
              <ProtectedRoute role="student">
                <StudentEnrollmentRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/myfiles"
            element={
              <ProtectedRoute role="student">
                <StudentMyFilesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/explore"
            element={
              <ProtectedRoute role="student">
                <StudentExplorePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/folder/:folderId"
            element={
              <ProtectedRoute role="student">
                <StudentFolderViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/course/:courseId"
            element={
              <ProtectedRoute role="student">
                <StudentCourseViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/course/:courseId/lesson/:lessonId"
            element={
              <ProtectedRoute role="student">
                <StudentLessonViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/course/:courseId/lesson/:lessonId/quiz/:quizId"
            element={
              <ProtectedRoute role="student">
                <StudentQuizViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/posts"
            element={
              <ProtectedRoute role="student">
                <PostsPage role="student" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/notifications"
            element={
              <ProtectedRoute role="student">
                <NotificationsPage role="student" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute role="student">
                <ProfilePage role="student" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/settings"
            element={
              <ProtectedRoute role="student">
                <SettingsPage role="student" />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default App;
