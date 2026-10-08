'use client';

import Link from 'next/link';
import {
  MOCK_REVIEW_QUEUE,
  MOCK_CLASS_PROGRESS,
  MOCK_RECENT_COMPLETIONS,
} from '@/lib/volunteer/mock-data';

export default function VolunteerDashboard() {
  // Calculate stats
  const pendingReview = MOCK_REVIEW_QUEUE.filter(
    (p) => p.status === 'generated' || p.status === 'under-review',
  ).length;
  const approved = MOCK_REVIEW_QUEUE.filter((p) => p.status === 'approved').length;

  const totalStudents = MOCK_CLASS_PROGRESS.reduce((sum, c) => sum + c.totalStudents, 0);
  const avgCompletion =
    MOCK_CLASS_PROGRESS.reduce((sum, c) => sum + c.averageCompletion, 0) /
    MOCK_CLASS_PROGRESS.length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">欢迎，志愿者！</h1>
        <p className="text-blue-100">感谢您为乡村儿童教育贡献力量。这里是您的工作台。</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon="📋"
          label="待审核课件"
          value={pendingReview}
          color="yellow"
          href="/volunteer/review"
        />
        <StatCard icon="✅" label="已批准课件" value={approved} color="green" />
        <StatCard
          icon="👨‍🎓"
          label="学习中学生"
          value={totalStudents}
          color="blue"
          href="/volunteer/progress"
        />
        <StatCard
          icon="📊"
          label="平均完成率"
          value={`${Math.round(avgCompletion * 100)}%`}
          color="purple"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Queue Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">审核队列</h2>
            <Link href="/volunteer/review" className="text-blue-600 hover:text-blue-700 text-sm">
              查看全部 →
            </Link>
          </div>

          <div className="space-y-3">
            {MOCK_REVIEW_QUEUE.filter((p) => p.status !== 'approved' && p.status !== 'rejected')
              .slice(0, 4)
              .map((pack) => (
                <div
                  key={pack.packId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{pack.unitTitleZh}</p>
                    <p className="text-sm text-gray-500">
                      第{pack.unitNumber}单元 · {pack.generatedCount}/{pack.lessonCount}课
                    </p>
                  </div>
                  <StatusBadge status={pack.status} />
                </div>
              ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">最近学习记录</h2>
            <Link href="/volunteer/progress" className="text-blue-600 hover:text-blue-700 text-sm">
              查看全部 →
            </Link>
          </div>

          <div className="space-y-3">
            {MOCK_RECENT_COMPLETIONS.slice(0, 4).map((completion) => (
              <div
                key={completion.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {completion.studentLabel.slice(-1)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{completion.studentLabel}</p>
                    <p className="text-sm text-gray-500">
                      完成课程 ·{' '}
                      {new Date(completion.completedAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{completion.score}分</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            icon="📋"
            title="审核课件"
            description="审核AI生成的课件，确保内容适合学生"
            href="/volunteer/review"
          />
          <QuickAction
            icon="📈"
            title="查看进度"
            description="查看学生的学习进度和测验成绩"
            href="/volunteer/progress"
          />
          <QuickAction
            icon="📚"
            title="导出课件包"
            description="导出已批准的课件用于离线分发"
            href="/volunteer/review?filter=approved"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  href,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: 'yellow' | 'green' | 'blue' | 'purple';
  href?: string;
}) {
  const colorClasses = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const content = (
    <div
      className={`rounded-xl p-5 border ${colorClasses[color]} ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: '草稿' },
    generated: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '待审核' },
    'under-review': { bg: 'bg-blue-100', text: 'text-blue-700', label: '审核中' },
    reviewed: { bg: 'bg-purple-100', text: 'text-purple-700', label: '已审核' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: '已批准' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: '已拒绝' },
  };

  const { bg, text, label } = config[status] ?? config.draft;

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>{label}</span>
  );
}

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
