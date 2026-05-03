/** يُمرَّر مع <Link state={dashboardBackLinkState('/path')} /> ليعرف غلاف اللوحة أين يُرجِع المستخدم */
export const DASHBOARD_BACK_STATE_KEY = "ahDashboardBack" as const;

export type DashboardBackLocationState = {
  [DASHBOARD_BACK_STATE_KEY]?: string;
};

export function dashboardBackLinkState(fromPath: string): { state: DashboardBackLocationState } {
  return { state: { [DASHBOARD_BACK_STATE_KEY]: fromPath } };
}

function readBackFromState(state: unknown): string | undefined {
  if (!state || typeof state !== "object") {
    return undefined;
  }
  const raw = (state as DashboardBackLocationState)[DASHBOARD_BACK_STATE_KEY];
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
}

/**
 * يحدد مسار الرجوع للصفحات داخل لوحة التحكم (مسارات متداخلة فقط).
 * لمسارات مثل مقرر الطالب قد يُكمِّل `location.state` الافتراضي (مثلاً مقرراتي مقابل الاستكشاف).
 */
export function resolveDashboardBackHref(pathname: string, locationState: unknown): string | null {
  const fromState = readBackFromState(locationState);

  if (/^\/student\/course\/[^/]+$/.test(pathname)) {
    return fromState ?? "/student/mycourses";
  }
  if (/^\/student\/folder\/[^/]+$/.test(pathname)) {
    return fromState ?? "/student/myfiles";
  }

  if (pathname.startsWith("/admin/student/")) {
    const rest = pathname.slice("/admin/student/".length);
    if (rest && !rest.includes("/")) {
      return fromState ?? "/admin/students";
    }
  }

  if (pathname.startsWith("/admin/folder/")) {
    const rest = pathname.slice("/admin/folder/".length);
    if (rest && !rest.includes("/")) {
      return fromState ?? "/admin/folders";
    }
  }

  const adminQuizEdit = pathname.match(/^\/admin\/course\/([^/]+)\/lessons\/([^/]+)\/quiz\/([^/]+)\/edit$/);
  if (adminQuizEdit) {
    return `/admin/course/${adminQuizEdit[1]}/lessons/${adminQuizEdit[2]}/quizzes`;
  }

  const adminQuizzes = pathname.match(/^\/admin\/course\/([^/]+)\/lessons\/([^/]+)\/quizzes$/);
  if (adminQuizzes) {
    return `/admin/course/${adminQuizzes[1]}/lessons`;
  }

  const adminLessons = pathname.match(/^\/admin\/course\/([^/]+)\/lessons$/);
  if (adminLessons) {
    return fromState ?? "/admin/courses";
  }

  const prevQuiz = pathname.match(/^\/admin\/preview\/course\/([^/]+)\/lesson\/([^/]+)\/quiz\/([^/]+)$/);
  if (prevQuiz) {
    return `/admin/preview/course/${prevQuiz[1]}/lesson/${prevQuiz[2]}`;
  }

  const prevLesson = pathname.match(/^\/admin\/preview\/course\/([^/]+)\/lesson\/([^/]+)$/);
  if (prevLesson) {
    return `/admin/preview/course/${prevLesson[1]}`;
  }

  const prevCourse = pathname.match(/^\/admin\/preview\/course\/([^/]+)$/);
  if (prevCourse) {
    return fromState ?? `/admin/course/${prevCourse[1]}/lessons`;
  }

  const stQuiz = pathname.match(/^\/student\/course\/([^/]+)\/lesson\/([^/]+)\/quiz\/([^/]+)$/);
  if (stQuiz) {
    return `/student/course/${stQuiz[1]}/lesson/${stQuiz[2]}`;
  }

  const stLesson = pathname.match(/^\/student\/course\/([^/]+)\/lesson\/([^/]+)$/);
  if (stLesson) {
    return `/student/course/${stLesson[1]}`;
  }

  return null;
}
