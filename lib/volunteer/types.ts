/**
 * Types for the volunteer dashboard
 */

export interface ReviewQueueItem {
  packId: string;
  unitNumber: number;
  unitTitle: string;
  unitTitleZh: string;
  gradeId: string;
  subjectId: string;
  lessonCount: number;
  generatedCount: number;
  status: 'draft' | 'generated' | 'under-review' | 'reviewed' | 'approved' | 'rejected';
  safetyPassed: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProgress {
  label: string;
  lessonsCompleted: number;
  totalLessons: number;
  averageScore: number;
  lastActivity: string;
  lessonDetails: {
    lessonId: string;
    lessonTitle: string;
    completed: boolean;
    score: number | null;
    completedAt: string | null;
  }[];
}

export interface ClassProgress {
  packId: string;
  unitTitle: string;
  totalStudents: number;
  averageCompletion: number;
  averageScore: number;
  students: StudentProgress[];
}

export interface QuizResult {
  questionId: string;
  questionText?: string;
  correct: boolean;
  studentAnswer?: string;
  correctAnswer?: string;
}

export interface LessonCompletion {
  id: string;
  studentLabel: string;
  lessonId: string;
  packId: string;
  completedAt: string;
  durationSeconds: number;
  quizResults: QuizResult[];
  score: number;
}
