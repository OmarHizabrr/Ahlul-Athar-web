export type UserRole = "admin" | "student";

export interface PlatformUser {
  uid: string;
  role: UserRole;
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
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
