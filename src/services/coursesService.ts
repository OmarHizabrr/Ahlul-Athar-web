import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Course, PlatformUser } from "../types";

const coursesCollection = collection(db, "courses");

const mapCourse = (id: string, data: Record<string, unknown>): Course => ({
  id,
  title: String(data.title ?? ""),
  description: String(data.description ?? ""),
  courseType: (data.courseType === "private" ? "private" : "public") as "public" | "private",
  isActive: Boolean(data.isActive ?? true),
  createdBy: String(data.createdBy ?? ""),
  createdByName: String(data.createdByName ?? ""),
  studentCount: Number(data.studentCount ?? 0),
  lessonCount: Number(data.lessonCount ?? 0),
});

export const coursesService = {
  async listCoursesForRole(role: PlatformUser["role"]) {
    const q =
      role === "student"
        ? query(coursesCollection, where("isActive", "==", true), orderBy("createdAt", "desc"))
        : query(coursesCollection, orderBy("createdAt", "desc"));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapCourse(d.id, d.data()));
  },

  async createCourse(user: PlatformUser, payload: Pick<Course, "title" | "description" | "courseType" | "isActive">) {
    await addDoc(coursesCollection, {
      ...payload,
      createdBy: user.uid,
      createdByName: user.displayName ?? "Admin",
      studentCount: 0,
      lessonCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateCourse(courseId: string, payload: Pick<Course, "title" | "description" | "courseType" | "isActive">) {
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { ...payload, updatedAt: serverTimestamp() });
  },

  async deleteCourse(courseId: string) {
    const courseRef = doc(db, "courses", courseId);
    await deleteDoc(courseRef);
  },

  async requestEnrollment(user: PlatformUser, course: Course) {
    const requestId = `${user.uid}_${course.id}`;
    const reqRef = doc(db, "enrollmentRequests", requestId);
    await setDoc(
      reqRef,
      {
        studentId: user.uid,
        studentName: user.displayName ?? "",
        studentEmail: user.email ?? "",
        requestType: "course",
        targetId: course.id,
        targetName: course.title,
        targetDescription: course.description,
        status: "pending",
        reason: "طلب انضمام من منصة الويب",
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
  },
};
