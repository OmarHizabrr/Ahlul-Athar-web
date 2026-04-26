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
  targetId: string;
  targetName: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  createdAt?: unknown;
  reviewedAt?: unknown;
}
