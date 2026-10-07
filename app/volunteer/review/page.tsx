'use client';

import { useState } from 'react';
import { MOCK_REVIEW_QUEUE } from '@/lib/volunteer/mock-data';
import type { ReviewQueueItem } from '@/lib/volunteer/types';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function ReviewQueuePage() {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedPack, setSelectedPack] = useState<ReviewQueueItem | null>(null);

  const filteredPacks = MOCK_REVIEW_QUEUE.filter((pack) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['generated', 'under-review', 'reviewed'].includes(pack.status);
    if (filter === 'approved') return pack.status === 'approved';
    if (filter === 'rejected') return pack.status === 'rejected';
    return true;
  });

  const counts = {
    all: MOCK_REVIEW_QUEUE.length,
    pending: MOCK_REVIEW_QUEUE.filter(p => ['generated', 'under-review', 'reviewed'].includes(p.status)).length,
    approved: MOCK_REVIEW_QUEUE.filter(p => p.status === 'approved').length,
    rejected: MOCK_REVIEW_QUEUE.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">审核队列</h1>
        <p className="text-gray-500 mt-1">
          审核AI生成的课件，确保内容适合学生使用
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {[
          { key: 'all' as FilterStatus, label: '全部', count: counts.all },
          { key: 'pending' as FilterStatus, label: '待处理', count: counts.pending },
          { key: 'approved' as FilterStatus, label: '已批准', count: counts.approved },
          { key: 'rejected' as FilterStatus, label: '已拒绝', count: counts.rejected },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pack List */}
        <div className="lg:col-span-2 space-y-4">
          {filteredPacks.map((pack) => (
            <PackCard
              key={pack.packId}
              pack={pack}
              isSelected={selectedPack?.packId === pack.packId}
              onSelect={() => setSelectedPack(pack)}
            />
          ))}

          {filteredPacks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              没有找到符合条件的课件包
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedPack ? (
            <PackDetailPanel pack={selectedPack} />
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
              <p className="text-4xl mb-4">👈</p>
              <p>选择一个课件包查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PackCard({
  pack,
  isSelected,
  onSelect,
}: {
  pack: ReviewQueueItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-100'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{pack.unitTitleZh}</h3>
          <p className="text-gray-500 text-sm">第{pack.unitNumber}单元 · {pack.unitTitle}</p>
        </div>
        <StatusBadge status={pack.status} />
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>📚 {pack.generatedCount}/{pack.lessonCount} 课</span>
        <span>
          {pack.safetyPassed === true && '✅ 安全检查通过'}
          {pack.safetyPassed === false && '❌ 安全检查未通过'}
          {pack.safetyPassed === null && '⚪ 未检查'}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
        更新于 {new Date(pack.updatedAt).toLocaleString('zh-CN')}
      </div>
    </div>
  );
}

function PackDetailPanel({ pack }: { pack: ReviewQueueItem }) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (action: 'approve' | 'reject' | 'start-review') => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert(`操作已提交: ${action}\n课件: ${pack.unitTitleZh}\n备注: ${comment || '无'}`);
    setIsSubmitting(false);
    setComment('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
      <h2 className="font-semibold text-gray-900 text-lg mb-4">{pack.unitTitleZh}</h2>
      
      <div className="space-y-4">
        {/* Info Section */}
        <div className="space-y-2">
          <InfoRow label="单元" value={`第${pack.unitNumber}单元`} />
          <InfoRow label="年级" value="一年级" />
          <InfoRow label="学科" value="数学（人教版）" />
          <InfoRow label="课时" value={`${pack.generatedCount}/${pack.lessonCount} 课`} />
          <InfoRow 
            label="状态" 
            value={<StatusBadge status={pack.status} />} 
          />
          <InfoRow 
            label="安全检查" 
            value={
              pack.safetyPassed === true ? (
                <span className="text-green-600">✅ 通过</span>
              ) : pack.safetyPassed === false ? (
                <span className="text-red-600">❌ 未通过</span>
              ) : (
                <span className="text-gray-400">⚪ 未检查</span>
              )
            } 
          />
        </div>

        {/* Lessons Preview */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="font-medium text-gray-700 mb-2">课时列表</h3>
          <div className="space-y-1 text-sm">
            {['数一数', '比多少'].slice(0, pack.lessonCount).map((title, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-600">
                <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs">
                  {i + 1}
                </span>
                {title || `第${i + 1}课`}
              </div>
            ))}
          </div>
        </div>

        {/* Comment Input */}
        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            审核备注
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="添加审核意见或建议..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {pack.status === 'generated' && (
            <button
              onClick={() => handleAction('start-review')}
              disabled={isSubmitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              开始审核
            </button>
          )}
          
          {['under-review', 'reviewed'].includes(pack.status) && (
            <>
              <button
                onClick={() => handleAction('approve')}
                disabled={isSubmitting || !pack.safetyPassed}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                批准发布
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50"
              >
                拒绝
              </button>
            </>
          )}

          {pack.status === 'approved' && (
            <div className="text-center py-4 text-green-600">
              <p className="text-2xl mb-1">✅</p>
              <p className="font-medium">已批准发布</p>
              <p className="text-sm text-gray-500 mt-1">可导出离线课件包</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
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
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}
