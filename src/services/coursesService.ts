import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Course, EnrollmentRequest, PlatformUser } from "../types";

const coursesCollection = collection(db, "courses");
const enrollmentRequestsCollection = collection(db, "enrollment_requests");

function generateActivationCode(studentId: string): string {
  const suffix = studentId.length > 6 ? studentId.slice(-6) : studentId;
  const ts = Date.now().toString().slice(-4);
  return `${suffix.toUpperCase()}${ts}`;
}

function firstImageUrlFromRecord(data: Record<string, unknown>): string | undefined {
  const pickString = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
  const keys = [
    "courseImageURL",
    "courseImageURLAr",
    "imageUrl",
    "imageURL",
    "image_url",
    "courseImageUrl",
    "course_image_url",
    "coverImage",
    "coverUrl",
    "courseImage",
    "thumbnailUrl",
    "thumbUrl",
    "thumbnail",
    "bannerUrl",
    "photoUrl",
    "photoURL",
    "iconUrl",
    "image",
  ];
  for (const k of keys) {
    const direct = pickString(data[k]);
    if (direct) {
      return direct;
    }
  }
  const imageObj = data.image;
  if (typeof imageObj === "object" && imageObj !== null) {
    const map = imageObj as Record<string, unknown>;
    const nested = pickString(map.url) ?? pickString(map.src) ?? pickString(map.path);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

const mapCourse = (id: string, data: Record<string, unknown>): Course => {
  const imageUrl = firstImageUrlFromRecord(data);
  return {
    id,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    courseType: (data.courseType === "private" ? "private" : "public") as "public" | "private",
    isActive: Boolean(data.isActive ?? true),
    createdBy: String(data.createdBy ?? ""),
    createdByName: String(data.createdByName ?? ""),
    studentCount: Number(data.studentCount ?? 0),
    lessonCount: Number(data.lessonCount ?? 0),
    ...(imageUrl != null ? { imageUrl } : {}),
  };
};

function timeMillisFromUnknown(v: unknown): number {
  if (v == null) {
    return 0;
  }
  if (v instanceof Timestamp) {
    return v.toMillis();
  }
  if (v instanceof Date) {
    return v.getTime();
  }
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

function mapEnrollmentRequest(docSnap: QueryDocumentSnapshot<DocumentData>): EnrollmentRequest {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    studentId: String(data.studentId ?? ""),
    studentName: String(data.studentName ?? ""),
    studentEmail: String(data.studentEmail ?? ""),
    studentPhone: data.studentPhone != null ? String(data.studentPhone) : undefined,
    studentPhotoURL: data.studentPhotoURL != null ? String(data.studentPhotoURL) : undefined,
    requestType: (data.requestType === "folder" ? "folder" : "course") as EnrollmentRequest["requestType"],
    targetId: String(data.targetId ?? ""),
    targetName: String(data.targetName ?? ""),
    targetDescription: data.targetDescription != null ? String(data.targetDescription) : undefined,
    targetImageURL: data.targetImageURL != null ? String(data.targetImageURL) : undefined,
    status: (data.status ?? "pending") as EnrollmentRequest["status"],
    reason: String(data.reason ?? ""),
    requestedAt: data.requestedAt ?? data.createdAt,
    processedAt: data.processedAt ?? data.reviewedAt,
    adminNotes: data.adminNotes != null ? String(data.adminNotes) : undefined,
  };
}

export type ActivationOptions = {
  isLifetime: boolean;
  days: number;
  expiresAt: Date | null;
};

export const coursesService = {
  async listCoursesForRole(role: PlatformUser["role"]) {
    const q =
      role === "student"
        ? query(coursesCollection, where("isActive", "==", true), orderBy("createdAt", "desc"))
        : query(coursesCollection, orderBy("createdAt", "desc"));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => mapCourse(d.id, d.data()));
  },

  async getCourseById(courseId: string): Promise<Course | null> {
    const ref = doc(db, "courses", courseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return null;
    }
    return mapCourse(snap.id, snap.data() as Record<string, unknown>);
  },

  async createCourse(
    user: PlatformUser,
    payload: Pick<Course, "title" | "description" | "courseType" | "isActive" | "imageUrl">,
  ) {
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

  async updateCourse(
    courseId: string,
    payload: Pick<Course, "title" | "description" | "courseType" | "isActive" | "imageUrl">,
  ) {
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { ...payload, updatedAt: serverTimestamp() });
  },

  async deleteCourse(courseId: string) {
    const courseRef = doc(db, "courses", courseId);
    await deleteDoc(courseRef);
  },

  async requestEnrollment(user: PlatformUser, course: Course) {
    const requestId = `${user.uid}_${course.id}_${Date.now()}`;
    const reqRef = doc(db, "enrollment_requests", requestId);
    await setDoc(reqRef, {
      studentId: user.uid,
      studentName: user.displayName ?? "",
      studentEmail: user.email ?? "",
      studentPhone: user.phoneNumber ?? null,
      studentPhotoURL: user.photoURL ?? null,
      requestType: "course",
      targetId: course.id,
      targetName: course.title,
      targetDescription: course.description,
      targetImageURL: course.imageUrl != null && course.imageUrl !== "" ? course.imageUrl : null,
      status: "pending",
      reason: "طلب انضمام من منصة الويب",
      requestedAt: serverTimestamp(),
    });
  },

  /**
   * يطابق تطبيق Flutter: طلبات من نوع course فقط، مرتبة بـ requestedAt.
   * التصفية حسب الحالة تتم محليًا لتوافق بيانات قديمة.
   */
  async listCourseEnrollmentRequests(status: EnrollmentRequest["status"] | "all" = "pending") {
    let docs: QueryDocumentSnapshot<DocumentData>[];
    try {
      const q = query(
        enrollmentRequestsCollection,
        where("requestType", "==", "course"),
        orderBy("requestedAt", "desc"),
      );
      docs = (await getDocs(q)).docs;
    } catch {
      const q2 = query(enrollmentRequestsCollection, where("requestType", "==", "course"));
      const raw = (await getDocs(q2)).docs;
      docs = raw.slice().sort((a, b) => {
        const ad = a.data();
        const bd = b.data();
        const ta = timeMillisFromUnknown(ad.requestedAt ?? ad.createdAt);
        const tb = timeMillisFromUnknown(bd.requestedAt ?? bd.createdAt);
        return tb - ta;
      });
    }
    const mapped = docs.map((d) => mapEnrollmentRequest(d));
    if (status === "all") {
      return mapped;
    }
    return mapped.filter((r) => r.status === status);
  },

  /**
   * قبول طلب — نفس مسار التطبيق: تحديث الطلب + numbers + Mycourses + studentCount
   * (راجع FirestoreApi.approveEnrollmentRequest + addStudentToCourse)
   */
  async approveEnrollmentRequest(
    request: EnrollmentRequest,
    activation: ActivationOptions,
  ): Promise<{ alreadyEnrolled: boolean }> {
    const user = auth.currentUser;
    const adminNotes = "تمت الموافقة من منصة الويب";
    const requestRef = doc(db, "enrollment_requests", request.id);
    const courseId = request.targetId;
    const studentId = request.studentId;

    const courseRef = doc(db, "courses", courseId);
    const numbersRef = doc(db, "numbers", courseId, "numbers", studentId);
    const myCourseRef = doc(db, "Mycourses", studentId, "Mycourses", courseId);

    const existing = await getDoc(numbersRef);
    const alreadyEnrolled = existing.exists();

    const activationCode = generateActivationCode(studentId);
    const isLifetime = activation.isLifetime;
    const expiresAtStr =
      isLifetime || !activation.expiresAt ? null : activation.expiresAt.toISOString();
    const days = isLifetime ? 30 : activation.days;

    const requestUpdate: Record<string, unknown> = {
      status: "approved",
      processedAt: serverTimestamp(),
      processedBy: user?.uid ?? "",
      processedByName: user?.displayName ?? "",
      adminNotes,
      updatedAt: serverTimestamp(),
      isActivated: true,
      isLifetime,
      expiresAt: expiresAtStr,
      activationDays: days,
      activatedAt: serverTimestamp(),
      activationCode,
    };
    await updateDoc(requestRef, requestUpdate);

    const studentData: Record<string, unknown> = {
      studentId,
      studentName: request.studentName,
      studentEmail: request.studentEmail,
      studentPhone: request.studentPhone ?? null,
      studentPhotoURL: request.studentPhotoURL ?? null,
      enrolledAt: serverTimestamp(),
      isActivated: true,
      isLifetime,
      expiresAt: expiresAtStr,
      activationDays: days,
      activatedAt: serverTimestamp(),
      activationCode,
    };

    const courseData: Record<string, unknown> = {
      courseId,
      courseTitle: request.targetName,
      courseDescription: request.targetDescription ?? "",
      courseImageURL: request.targetImageURL ?? null,
      enrolledAt: serverTimestamp(),
      isActivated: true,
      isLifetime,
      expiresAt: expiresAtStr,
      activationDays: days,
      activatedAt: serverTimestamp(),
      activationCode,
    };

    await setDoc(numbersRef, studentData, { merge: true });
    await setDoc(myCourseRef, courseData, { merge: true });

    if (!alreadyEnrolled) {
      await updateDoc(courseRef, { studentCount: increment(1), updatedAt: serverTimestamp() });
    }

    return { alreadyEnrolled };
  },

  async rejectEnrollmentRequest(requestId: string, reason: string) {
    const user = auth.currentUser;
    const requestRef = doc(db, "enrollment_requests", requestId);
    await updateDoc(requestRef, {
      status: "rejected",
      processedAt: serverTimestamp(),
      processedBy: user?.uid ?? "",
      processedByName: user?.displayName ?? "",
      adminNotes: reason,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * كل طلبات انضمام الطالب للمقررات — الأحدث أولاً (مثل سجل «طلباتي» في التطبيق).
   * عند فشل ترتيب مركب، جلب أوسع ثم ترتيب محلي.
   */
  async listStudentEnrollmentRequests(studentId: string): Promise<EnrollmentRequest[]> {
    try {
      const q = query(
        enrollmentRequestsCollection,
        where("studentId", "==", studentId),
        where("requestType", "==", "course"),
        orderBy("requestedAt", "desc"),
      );
      return (await getDocs(q)).docs.map((d) => mapEnrollmentRequest(d));
    } catch {
      const q2 = query(enrollmentRequestsCollection, where("studentId", "==", studentId));
      const raw = (await getDocs(q2)).docs
        .map((d) => mapEnrollmentRequest(d))
        .filter((r) => r.requestType === "course");
      raw.sort(
        (a, b) =>
          timeMillisFromUnknown(b.requestedAt ?? b.processedAt) -
          timeMillisFromUnknown(a.requestedAt ?? a.processedAt),
      );
      return raw;
    }
  },
};
