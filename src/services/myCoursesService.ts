import { collection, getDocs, query, getDoc, doc, orderBy, type DocumentData, type DocumentReference } from "firebase/firestore";
import { db } from "../firebase";
import { coursesService } from "./coursesService";
import type { MyCourseEntry } from "../types";

function mapMycourseDoc(
  courseId: string,
  myData: Record<string, unknown>,
  catalog: Awaited<ReturnType<typeof coursesService.getCourseById>>,
): MyCourseEntry {
  return {
    courseId,
    courseTitle: String(myData.courseTitle ?? catalog?.title ?? ""),
    courseDescription: String((myData.courseDescription ?? myData.description ?? catalog?.description) ?? ""),
    courseImageURL: myData.courseImageURL != null ? String(myData.courseImageURL) : undefined,
    enrolledAt: myData.enrolledAt,
    linkedByName:
      myData.updatedByName != null
        ? String(myData.updatedByName)
        : myData.createdByName != null
          ? String(myData.createdByName)
          : undefined,
    linkedAt: myData.updatedAt ?? myData.activatedAt ?? myData.enrolledAt,
    isActivated: Boolean(myData.isActivated ?? true),
    isLifetime: myData.isLifetime != null ? Boolean(myData.isLifetime) : undefined,
    isActiveOnCatalog: catalog?.isActive,
    lessonCount: catalog?.lessonCount,
    studentCount: catalog?.studentCount,
  };
}

export const myCoursesService = {
  /**
   * دورات الطالب — نفس `getStudentCoursesWithData` في Flutter (دمج Mycourses + جدول courses).
   */
  async listForStudent(uid: string): Promise<MyCourseEntry[]> {
    const myCol = collection(db, "Mycourses", uid, "Mycourses");
    let snap;
    try {
      snap = await getDocs(query(myCol, orderBy("enrolledAt", "desc")));
    } catch {
      const raw = (await getDocs(myCol)).docs;
      raw.sort((a, b) => {
        const at = a.data().enrolledAt;
        const bt = b.data().enrolledAt;
        return String(bt) < String(at) ? -1 : 1;
      });
      return await mergeWithCatalog(
        raw.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> })),
      );
    }
    return await mergeWithCatalog(
      snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> })),
    );
  },
};

async function mergeWithCatalog(
  rows: { id: string; data: Record<string, unknown> }[],
): Promise<MyCourseEntry[]> {
  const out: MyCourseEntry[] = [];
  for (const { id, data } of rows) {
    const catalog = await coursesService.getCourseById(id);
    out.push(mapMycourseDoc(id, data, catalog));
  }
  return out;
}

/**
 * هل مسجّل في الدورة (يوجد وثيقة Mycourse).
 */
export async function isStudentEnrolledInCourse(studentId: string, courseId: string): Promise<boolean> {
  const ref: DocumentReference<DocumentData> = doc(db, "Mycourses", studentId, "Mycourses", courseId);
  return (await getDoc(ref)).exists();
}
