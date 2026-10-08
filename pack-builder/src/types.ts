/**
 * Types for the pack-builder CLI
 */

export interface Grade {
  id: string;
  name: string;
  nameZh: string;
  level: number;
  ageRange: { min: number; max: number };
  semester: '上学期' | '下学期' | 'full-year';
}

export interface TextbookEdition {
  id: 'pep' | 'tongbian' | 'jiaoke' | 'other';
  nameZh: string;
  publisher: string;
  fullName?: string;
}

export interface CurriculumStandard {
  year: number;
  name: string;
  coreCompetencies?: string[];
}

export interface Subject {
  id: string;
  name: string;
  nameZh: string;
  textbookEdition: TextbookEdition;
  curriculumStandard: CurriculumStandard;
  sessionDurationMinutes: number;
  lessonsPerWeek?: number;
  contentCharacteristics?: {
    visualHeavy?: boolean;
    interactiveSimulations?: boolean;
    voiceHeavy?: boolean;
    minimalText?: boolean;
  };
}

export interface GenerationHints {
  ageAppropriate?: boolean;
  visualHeavy?: boolean;
  interactiveElements?: string[];
  quizTypes?: string[];
  voiceStyle?: string;
}

export interface Lesson {
  id: string;
  order: number;
  title: string;
  titleZh: string;
  topic: string;
  durationMinutes?: number;
  sceneTypes?: ('slide' | 'quiz' | 'interactive' | 'pbl')[];
  generationHints?: GenerationHints;
  stageId?: string;
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  titleZh: string;
  textbookPages?: string;
  objectives?: string[];
  lessons: Lesson[];
}

export interface ReviewComment {
  timestamp: string;
  reviewer: string;
  comment: string;
  lessonId?: string;
}

export type ReviewStatus =
  | 'draft'
  | 'generated'
  | 'under-review'
  | 'reviewed'
  | 'approved'
  | 'rejected';

export interface ReviewState {
  status: ReviewStatus;
  reviewer?: string;
  reviewedAt?: string;
  approvedAt?: string;
  comments?: ReviewComment[];
}

export interface SafetyIssue {
  lessonId: string;
  severity: 'warning' | 'error';
  message: string;
  location?: string;
  matchedTerm?: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  checkedAt: string;
  issues: SafetyIssue[];
}

export interface ExportInfo {
  exportedAt: string;
  format: 'maic-zip' | 'standalone-html' | 'usb-bundle';
  outputPath: string;
}

export interface GenerationInfo {
  model?: string;
  provider?: string;
  cost?: number;
  generatedAt?: string;
}

export interface LessonPackMetadata {
  createdAt: string;
  updatedAt: string;
  generatedWith?: GenerationInfo;
}

export interface LessonPack {
  id: string;
  version: string;
  gradeId: string;
  subjectId: string;
  unit: Unit;
  lessons: Lesson[];
  reviewStatus?: ReviewState;
  safetyCheck?: SafetyCheckResult;
  exportInfo?: ExportInfo;
  metadata?: LessonPackMetadata;
}

export interface Manifest {
  grade: Grade;
  subject: Subject;
  units: Unit[];
}

export interface ProgressRecord {
  id: string;
  studentLabel: string;
  lessonId: string;
  packId: string;
  completedAt: string;
  durationSeconds: number;
  quizResults?: {
    questionId: string;
    correct: boolean;
    answer?: string;
  }[];
  score?: number;
}

export interface ClassProgress {
  packId: string;
  students: {
    label: string;
    lessonsCompleted: number;
    totalLessons: number;
    averageScore: number;
    lastActivity: string;
  }[];
}

export interface ReviewAction {
  action: 'start-review' | 'submit-review' | 'approve' | 'reject' | 'add-comment';
  reviewer: string;
  comment?: string;
  lessonId?: string;
}
