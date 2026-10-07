'use client';

import { useState } from 'react';
import { MOCK_CLASS_PROGRESS, MOCK_RECENT_COMPLETIONS } from '@/lib/volunteer/mock-data';
import type { ClassProgress, StudentProgress } from '@/lib/volunteer/types';

export default function ProgressPage() {
  const [selectedClass, setSelectedClass] = useState<ClassProgress | null>(MOCK_CLASS_PROGRESS[0] ?? null);
  const [selectedStudent, setSelectedStudent] = useState<StudentProgress | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">学习进度</h1>
        <p className="text-gray-500 mt-1">
          查看学生的学习进度和测验成绩（数据来自离线设备同步）
        </p>
      </div>

      {/* Class Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">选择课件单元</h2>
        <div className="flex gap-2 flex-wrap">
          {MOCK_CLASS_PROGRESS.map((classData) => (
            <button
              key={classData.packId}
              onClick={() => {
                setSelectedClass(classData);
                setSelectedStudent(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedClass?.packId === classData.packId
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {classData.unitTitle}
            </button>
          ))}
        </div>
      </div>

      {selectedClass && (
        <>
          {/* Class Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon="👨‍🎓"
              label="学生人数"
              value={selectedClass.totalStudents}
              color="blue"
            />
            <StatCard
              icon="📊"
              label="平均完成率"
              value={`${Math.round(selectedClass.averageCompletion * 100)}%`}
              color="purple"
            />
            <StatCard
              icon="📝"
              label="平均分数"
              value={`${Math.round(selectedClass.averageScore)}分`}
              color="green"
            />
            <StatCard
              icon="📚"
              label="课时总数"
              value={selectedClass.students[0]?.totalLessons ?? 0}
              color="yellow"
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student List */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">学生列表</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {selectedClass.students.map((student) => (
                  <StudentRow
                    key={student.label}
                    student={student}
                    isSelected={selectedStudent?.label === student.label}
                    onSelect={() => setSelectedStudent(student)}
                  />
                ))}
              </div>
            </div>

            {/* Student Detail */}
            <div className="lg:col-span-1">
              {selectedStudent ? (
                <StudentDetailPanel student={selectedStudent} />
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                  <p className="text-4xl mb-4">👈</p>
                  <p>选择学生查看详细进度</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">最近学习记录</h2>
            <div className="space-y-3">
              {MOCK_RECENT_COMPLETIONS.map((completion) => (
                <div
                  key={completion.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium">
                      {completion.studentLabel.slice(-1)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{completion.studentLabel}</p>
                      <p className="text-sm text-gray-500">
                        完成 {completion.lessonId} · 用时 {Math.round(completion.durationSeconds / 60)} 分钟
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${
                      completion.score >= 90 ? 'text-green-600' :
                      completion.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {completion.score}分
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(completion.completedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: string;
  label: string;
  value: number | string;
  color: 'yellow' | 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`rounded-xl p-5 border ${colorClasses[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );
}

function StudentRow({
  student,
  isSelected,
  onSelect,
}: {
  student: StudentProgress;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const completionPercent = Math.round((student.lessonsCompleted / student.totalLessons) * 100);
  
  return (
    <div
      onClick={onSelect}
      className={`px-6 py-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 text-white rounded-full flex items-center justify-center font-medium">
            {student.label.slice(-1)}
          </div>
          <div>
            <p className="font-medium text-gray-900">{student.label}</p>
            <p className="text-sm text-gray-500">
              {student.lessonsCompleted}/{student.totalLessons} 课已完成
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Progress Bar */}
          <div className="w-32">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  completionPercent === 100 ? 'bg-green-500' :
                  completionPercent >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">{completionPercent}%</p>
          </div>
          
          {/* Score */}
          <div className="text-right w-16">
            <p className={`text-lg font-semibold ${
              student.averageScore >= 90 ? 'text-green-600' :
              student.averageScore >= 70 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.round(student.averageScore)}
            </p>
            <p className="text-xs text-gray-400">平均分</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentDetailPanel({ student }: { student: StudentProgress }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-purple-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
          {student.label.slice(-1)}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 text-lg">{student.label}</h2>
          <p className="text-sm text-gray-500">
            最后活动: {new Date(student.lastActivity).toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{student.lessonsCompleted}</p>
          <p className="text-xs text-blue-600">已完成课时</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{Math.round(student.averageScore)}</p>
          <p className="text-xs text-green-600">平均分数</p>
        </div>
      </div>

      {/* Lesson Progress */}
      <div>
        <h3 className="font-medium text-gray-700 mb-3">课时进度</h3>
        <div className="space-y-2">
          {student.lessonDetails.map((lesson) => (
            <div
              key={lesson.lessonId}
              className={`flex items-center justify-between p-3 rounded-lg ${
                lesson.completed ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={lesson.completed ? 'text-green-500' : 'text-gray-400'}>
                  {lesson.completed ? '✅' : '⚪'}
                </span>
                <span className={`text-sm ${lesson.completed ? 'text-gray-700' : 'text-gray-500'}`}>
                  {lesson.lessonTitle}
                </span>
              </div>
              {lesson.score !== null && (
                <span className={`text-sm font-medium ${
                  lesson.score >= 90 ? 'text-green-600' :
                  lesson.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {lesson.score}分
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          🔒 数据匿名化处理，无个人隐私信息
        </p>
      </div>
    </div>
  );
}
