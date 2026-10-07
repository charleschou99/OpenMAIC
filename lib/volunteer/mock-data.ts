/**
 * Mock data for volunteer dashboard development and testing
 * 
 * In production, this would be replaced with real data from:
 * 1. Pack manifests (review queue)
 * 2. SQLite sync from offline tablets (progress data)
 */

import type { ReviewQueueItem, ClassProgress, StudentProgress, LessonCompletion } from './types';

export const MOCK_REVIEW_QUEUE: ReviewQueueItem[] = [
  {
    packId: 'pack-grade-1-math-unit-1',
    unitNumber: 1,
    unitTitle: 'Preparation',
    unitTitleZh: '准备课',
    gradeId: 'grade-1',
    subjectId: 'math',
    lessonCount: 2,
    generatedCount: 2,
    status: 'generated',
    safetyPassed: true,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-05T10:30:00Z',
  },
  {
    packId: 'pack-grade-1-math-unit-2',
    unitNumber: 2,
    unitTitle: 'Position',
    unitTitleZh: '位置',
    gradeId: 'grade-1',
    subjectId: 'math',
    lessonCount: 2,
    generatedCount: 2,
    status: 'under-review',
    safetyPassed: true,
    createdAt: '2026-10-02T09:00:00Z',
    updatedAt: '2026-10-06T14:00:00Z',
  },
  {
    packId: 'pack-grade-1-math-unit-3',
    unitNumber: 3,
    unitTitle: 'Numbers 1-5 and Operations',
    unitTitleZh: '1-5的认识和加减法',
    gradeId: 'grade-1',
    subjectId: 'math',
    lessonCount: 5,
    generatedCount: 3,
    status: 'draft',
    safetyPassed: null,
    createdAt: '2026-10-03T10:00:00Z',
    updatedAt: '2026-10-03T10:00:00Z',
  },
  {
    packId: 'pack-grade-1-math-unit-4',
    unitNumber: 4,
    unitTitle: 'Recognizing Shapes (1)',
    unitTitleZh: '认识图形（一）',
    gradeId: 'grade-1',
    subjectId: 'math',
    lessonCount: 2,
    generatedCount: 2,
    status: 'reviewed',
    safetyPassed: true,
    createdAt: '2026-10-01T11:00:00Z',
    updatedAt: '2026-10-07T09:00:00Z',
  },
  {
    packId: 'pack-grade-1-math-unit-5',
    unitNumber: 5,
    unitTitle: 'Numbers 6-10 and Operations',
    unitTitleZh: '6-10的认识和加减法',
    gradeId: 'grade-1',
    subjectId: 'math',
    lessonCount: 6,
    generatedCount: 6,
    status: 'approved',
    safetyPassed: true,
    createdAt: '2026-09-28T08:00:00Z',
    updatedAt: '2026-10-04T16:00:00Z',
  },
];

const createStudentProgress = (
  label: string,
  completionRate: number,
  avgScore: number,
  totalLessons: number
): StudentProgress => {
  const lessonsCompleted = Math.floor(totalLessons * completionRate);
  const lessons = [];
  
  for (let i = 1; i <= totalLessons; i++) {
    const completed = i <= lessonsCompleted;
    lessons.push({
      lessonId: `lesson-${i}`,
      lessonTitle: `第${i}课`,
      completed,
      score: completed ? Math.floor(avgScore + (Math.random() - 0.5) * 20) : null,
      completedAt: completed ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
  }
  
  return {
    label,
    lessonsCompleted,
    totalLessons,
    averageScore: avgScore,
    lastActivity: lessons.filter(l => l.completedAt).sort((a, b) => 
      (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
    )[0]?.completedAt ?? new Date().toISOString(),
    lessonDetails: lessons,
  };
};

export const MOCK_CLASS_PROGRESS: ClassProgress[] = [
  {
    packId: 'pack-grade-1-math-unit-5',
    unitTitle: '6-10的认识和加减法',
    totalStudents: 8,
    averageCompletion: 0.75,
    averageScore: 82,
    students: [
      createStudentProgress('学生A', 1.0, 95, 6),
      createStudentProgress('学生B', 0.83, 88, 6),
      createStudentProgress('学生C', 0.83, 85, 6),
      createStudentProgress('学生D', 0.67, 78, 6),
      createStudentProgress('学生E', 0.67, 82, 6),
      createStudentProgress('学生F', 0.5, 75, 6),
      createStudentProgress('学生G', 0.5, 72, 6),
      createStudentProgress('学生H', 0.33, 70, 6),
    ],
  },
  {
    packId: 'pack-grade-1-math-unit-1',
    unitTitle: '准备课',
    totalStudents: 8,
    averageCompletion: 1.0,
    averageScore: 90,
    students: [
      createStudentProgress('学生A', 1.0, 98, 2),
      createStudentProgress('学生B', 1.0, 92, 2),
      createStudentProgress('学生C', 1.0, 90, 2),
      createStudentProgress('学生D', 1.0, 88, 2),
      createStudentProgress('学生E', 1.0, 90, 2),
      createStudentProgress('学生F', 1.0, 85, 2),
      createStudentProgress('学生G', 1.0, 88, 2),
      createStudentProgress('学生H', 1.0, 89, 2),
    ],
  },
];

export const MOCK_RECENT_COMPLETIONS: LessonCompletion[] = [
  {
    id: 'completion-1',
    studentLabel: '学生A',
    lessonId: 'lesson-5-6',
    packId: 'pack-grade-1-math-unit-5',
    completedAt: '2026-10-07T10:30:00Z',
    durationSeconds: 2100,
    score: 95,
    quizResults: [
      { questionId: 'q1', correct: true },
      { questionId: 'q2', correct: true },
      { questionId: 'q3', correct: true },
      { questionId: 'q4', correct: false },
      { questionId: 'q5', correct: true },
    ],
  },
  {
    id: 'completion-2',
    studentLabel: '学生B',
    lessonId: 'lesson-5-5',
    packId: 'pack-grade-1-math-unit-5',
    completedAt: '2026-10-07T09:45:00Z',
    durationSeconds: 1980,
    score: 88,
    quizResults: [
      { questionId: 'q1', correct: true },
      { questionId: 'q2', correct: true },
      { questionId: 'q3', correct: false },
      { questionId: 'q4', correct: true },
      { questionId: 'q5', correct: true },
    ],
  },
  {
    id: 'completion-3',
    studentLabel: '学生C',
    lessonId: 'lesson-5-5',
    packId: 'pack-grade-1-math-unit-5',
    completedAt: '2026-10-07T09:15:00Z',
    durationSeconds: 2250,
    score: 85,
    quizResults: [
      { questionId: 'q1', correct: true },
      { questionId: 'q2', correct: false },
      { questionId: 'q3', correct: true },
      { questionId: 'q4', correct: true },
      { questionId: 'q5', correct: true },
    ],
  },
];
