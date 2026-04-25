import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RoleSelectorPage } from "./pages/RoleSelectorPage";
import { CoursesPage, HomePage, NotificationsPage, PostsPage, ProfilePage } from "./pages/SharedPages";
import { SplashPage } from "./pages/SplashPage";
import { authService } from "./services/authService";
import type { UserRole } from "./types";

function ProtectedRoute({ role, children }: { role: UserRole; children: ReactElement }) {
  const user = authService.getLocalUser();
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
