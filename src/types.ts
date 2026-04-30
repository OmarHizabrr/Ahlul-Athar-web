export type UserRole = "admin" | "student";

export interface PlatformUser {
  uid: string;
  role: UserRole;
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  profileCompleted?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  courseType: "public" | "private";
  isActive: boolean;
  createdBy: string;
  createdByName: string;
  studentCount: number;
  lessonCount: number;
  /** غلاف المقرر من Firestore (أسماء الحقول تُوحّد عند الجلب) — مثل تطبيق الجوال. */
  imageUrl?: string;
}

/** صف `Mycourses/{uid}/Mycourses/{courseId}` كما في تطبيق Flutter. */
export interface MyCourseEntry {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseImageURL?: string;
  enrolledAt: unknown;
  isActivated: boolean;
  isLifetime?: boolean;
  /** يدمج بيانات من `courses/{id}` عند الجلب. */
  isActiveOnCatalog?: boolean;
  lessonCount?: number;
  studentCount?: number;
}

/**
 * درس ضمن `lessons/{courseId}/lessons/{lessonId}` — الحقول مرنة لتتوافق مع Flutter.
 */
export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  content?: string;
  txtContent?: string;
  contentType?: string;
  videoUrl?: string;
  pdfUrl?: string;
  audioUrl?: string;
  duration?: number;
  difficulty?: string;
  createdAt: unknown;
  createdByName?: string;
  /** يتطلب اجتياز اختبارات الدرس السابق (كما في Flutter). */
  hasMandatoryQuiz?: boolean;
  /** صورة غلاف / رأس الدرس إن وُجدت في Firestore (أسماء حقول شائعة مع تطبيق الجوال). */
  imageUrl?: string;
}

/** صف مُهيأ للواجهة: درس + هل مفتوح + سبب بسيط عند المنع. */
export type LessonWithAccess = {
  lesson: Lesson;
  isUnlocked: boolean;
  blockHint?: string;
};

/** تعليق على الدرس (واجهة الويب/التطبيق) */
export interface LessonComment {
  id: string;
  lessonId: string;
  courseId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  body: string;
  createdAt: unknown;
}

/** منشور عام / إعلان — يظهر للطلاب عند isPublished. */
export interface Post {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  isPublished: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

/** إشعار مرتبط بمستخدم — يطابق نمط تخزين شائع (user + عنوان + نص + مقروء). */
export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  imageUrl?: string;
  senderId?: string;
  senderName?: string;
  senderPhotoURL?: string;
  read: boolean;
  createdAt: unknown;
}

export interface UserFirestoreProfile {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  photoURL: string;
  role: UserRole;
  profileCompleted: boolean;
}

export interface EnrollmentRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  studentPhotoURL?: string;
  requestType: "course" | "folder";
  targetId: string;
  targetName: string;
  targetDescription?: string;
  targetImageURL?: string;
  status: "pending" | "approved" | "rejected" | "expired";
  reason: string;
  /** يطابق Flutter: requestedAt (الويب القديم قد يستخدم createdAt). */
  requestedAt?: unknown;
  /** يطابق Flutter: processedAt (الويب القديم قد يستخدم reviewedAt). */
  processedAt?: unknown;
  adminNotes?: string;
}

export interface AdminRecord {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  isActive: boolean;
  role?: UserRole;
  createdAt?: unknown;
}

export interface StudentRecord {
  uid: string;
  displayName: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  isActive?: boolean;
  isSuspended?: boolean;
  isActivated?: boolean;
  createdAt?: unknown;
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  folderType?: "public" | "private";
  isActive?: boolean;
  coverImageUrl?: string;
  fileCount?: number;
  memberCount?: number;
  totalSize?: number;
  createdAt?: unknown;
}

export type FolderFileType = "image" | "pdf" | "video" | "audio" | "doc" | "other";

export interface FolderFile {
  id: string;
  fileName: string;
  downloadUrl: string;
  storagePath?: string;
  fileType?: FolderFileType;
  fileSize?: number;
  isActive?: boolean;
  createdAt?: unknown;
}
