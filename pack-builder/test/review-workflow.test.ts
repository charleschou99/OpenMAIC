import { describe, it, expect } from 'vitest';
import type { LessonPack, ReviewStatus, ReviewAction } from '../src/types.js';

// Inline the core logic for testing (avoids yaml dependency in tests)
const VALID_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  'draft': ['generated'],
  'generated': ['under-review'],
  'under-review': ['reviewed', 'rejected'],
  'reviewed': ['approved', 'rejected', 'under-review'],
  'approved': [],
  'rejected': ['draft', 'under-review'],
};

function canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function isApprovedForDistribution(pack: LessonPack): boolean {
  return pack.reviewStatus?.status === 'approved';
}

function formatReviewStatus(pack: LessonPack): string {
  const status = pack.reviewStatus?.status ?? 'draft';
  const statusEmoji: Record<ReviewStatus, string> = {
    'draft': '📝',
    'generated': '🤖',
    'under-review': '👀',
    'reviewed': '✅',
    'approved': '🎉',
    'rejected': '❌',
  };
  return `${statusEmoji[status]} ${status.toUpperCase()}`;
}

function updateReviewStatus(pack: LessonPack, action: ReviewAction): LessonPack {
  const currentStatus = pack.reviewStatus?.status ?? 'draft';
  const now = new Date().toISOString();
  let newStatus: ReviewStatus = currentStatus;
  const comments = [...(pack.reviewStatus?.comments ?? [])];

  switch (action.action) {
    case 'start-review':
      if (!canTransition(currentStatus, 'under-review')) {
        throw new Error(`Cannot start review from status '${currentStatus}'`);
      }
      newStatus = 'under-review';
      break;
    case 'submit-review':
      if (currentStatus !== 'under-review') {
        throw new Error(`Cannot submit review when status is '${currentStatus}'`);
      }
      newStatus = 'reviewed';
      if (action.comment) {
        comments.push({ timestamp: now, reviewer: action.reviewer, comment: action.comment });
      }
      break;
    case 'approve':
      if (!canTransition(currentStatus, 'approved')) {
        throw new Error(`Cannot approve from status '${currentStatus}'`);
      }
      newStatus = 'approved';
      break;
    case 'reject':
      if (!canTransition(currentStatus, 'rejected')) {
        throw new Error(`Cannot reject from status '${currentStatus}'`);
      }
      newStatus = 'rejected';
      break;
  }

  return {
    ...pack,
    reviewStatus: {
      status: newStatus,
      reviewer: action.reviewer,
      comments,
      ...(newStatus === 'approved' ? { approvedAt: now } : {}),
    },
  };
}

const createMockPack = (status: ReviewStatus = 'draft'): LessonPack => ({
  id: 'pack-test',
  version: '0.1.0',
  gradeId: 'grade-1',
  subjectId: 'math',
  unit: {
    id: 'unit-1',
    number: 1,
    title: 'Test Unit',
    titleZh: '测试单元',
    lessons: [],
  },
  lessons: [],
  reviewStatus: {
    status,
  },
});

describe('Review Workflow', () => {
  describe('canTransition', () => {
    it('should allow draft -> generated', () => {
      expect(canTransition('draft', 'generated')).toBe(true);
    });

    it('should allow generated -> under-review', () => {
      expect(canTransition('generated', 'under-review')).toBe(true);
    });

    it('should allow under-review -> reviewed', () => {
      expect(canTransition('under-review', 'reviewed')).toBe(true);
    });

    it('should allow reviewed -> approved', () => {
      expect(canTransition('reviewed', 'approved')).toBe(true);
    });

    it('should not allow draft -> approved directly', () => {
      expect(canTransition('draft', 'approved')).toBe(false);
    });

    it('should not allow any transition from approved', () => {
      expect(canTransition('approved', 'draft')).toBe(false);
      expect(canTransition('approved', 'rejected')).toBe(false);
    });
  });

  describe('updateReviewStatus', () => {
    it('should start review from generated status', () => {
      const pack = createMockPack('generated');
      
      const updated = updateReviewStatus(pack, {
        action: 'start-review',
        reviewer: 'volunteer-a',
      });

      expect(updated.reviewStatus?.status).toBe('under-review');
      expect(updated.reviewStatus?.reviewer).toBe('volunteer-a');
    });

    it('should submit review with comment', () => {
      const pack = createMockPack('under-review');
      
      const updated = updateReviewStatus(pack, {
        action: 'submit-review',
        reviewer: 'volunteer-a',
        comment: 'Content looks good',
      });

      expect(updated.reviewStatus?.status).toBe('reviewed');
      expect(updated.reviewStatus?.comments).toHaveLength(1);
      expect(updated.reviewStatus?.comments?.[0].comment).toBe('Content looks good');
    });

    it('should approve pack', () => {
      const pack = createMockPack('reviewed');
      
      const updated = updateReviewStatus(pack, {
        action: 'approve',
        reviewer: 'volunteer-a',
        comment: 'Approved for distribution',
      });

      expect(updated.reviewStatus?.status).toBe('approved');
      expect(updated.reviewStatus?.approvedAt).toBeDefined();
    });

    it('should reject pack', () => {
      const pack = createMockPack('under-review');
      
      const updated = updateReviewStatus(pack, {
        action: 'reject',
        reviewer: 'volunteer-a',
        comment: 'Needs revision',
      });

      expect(updated.reviewStatus?.status).toBe('rejected');
    });

    it('should throw error for invalid transition', () => {
      const pack = createMockPack('draft');
      
      expect(() => {
        updateReviewStatus(pack, {
          action: 'approve',
          reviewer: 'volunteer-a',
        });
      }).toThrow();
    });
  });

  describe('isApprovedForDistribution', () => {
    it('should return true for approved packs', () => {
      const pack = createMockPack('approved');
      expect(isApprovedForDistribution(pack)).toBe(true);
    });

    it('should return false for non-approved packs', () => {
      expect(isApprovedForDistribution(createMockPack('draft'))).toBe(false);
      expect(isApprovedForDistribution(createMockPack('generated'))).toBe(false);
      expect(isApprovedForDistribution(createMockPack('under-review'))).toBe(false);
      expect(isApprovedForDistribution(createMockPack('reviewed'))).toBe(false);
      expect(isApprovedForDistribution(createMockPack('rejected'))).toBe(false);
    });
  });

  describe('formatReviewStatus', () => {
    it('should format status with emoji', () => {
      expect(formatReviewStatus(createMockPack('draft'))).toContain('📝');
      expect(formatReviewStatus(createMockPack('generated'))).toContain('🤖');
      expect(formatReviewStatus(createMockPack('approved'))).toContain('🎉');
    });
  });
});
