/**
 * Human review workflow for lesson packs
 *
 * Implements the review state machine:
 * draft -> generated -> under-review -> reviewed -> approved
 *                                    -> rejected
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type { LessonPack, ReviewState, ReviewStatus } from './types.js';
import { loadLessonPack } from './manifest-parser.js';

export interface ReviewAction {
  action: 'start-review' | 'submit-review' | 'approve' | 'reject' | 'add-comment';
  reviewer: string;
  comment?: string;
  lessonId?: string;
}

const VALID_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  draft: ['generated'],
  generated: ['under-review'],
  'under-review': ['reviewed', 'rejected'],
  reviewed: ['approved', 'rejected', 'under-review'],
  approved: [], // Terminal state for distribution
  rejected: ['draft', 'under-review'], // Can be reworked
};

export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextValidStates(current: ReviewStatus): ReviewStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export function updateReviewStatus(pack: LessonPack, action: ReviewAction): LessonPack {
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
        comments.push({
          timestamp: now,
          reviewer: action.reviewer,
          comment: action.comment,
          lessonId: action.lessonId,
        });
      }
      break;

    case 'approve':
      if (!canTransition(currentStatus, 'approved')) {
        throw new Error(`Cannot approve from status '${currentStatus}'`);
      }
      newStatus = 'approved';
      if (action.comment) {
        comments.push({
          timestamp: now,
          reviewer: action.reviewer,
          comment: `Approved: ${action.comment}`,
        });
      }
      break;

    case 'reject':
      if (!canTransition(currentStatus, 'rejected')) {
        throw new Error(`Cannot reject from status '${currentStatus}'`);
      }
      newStatus = 'rejected';
      if (action.comment) {
        comments.push({
          timestamp: now,
          reviewer: action.reviewer,
          comment: `Rejected: ${action.comment}`,
        });
      }
      break;

    case 'add-comment':
      comments.push({
        timestamp: now,
        reviewer: action.reviewer,
        comment: action.comment ?? '',
        lessonId: action.lessonId,
      });
      break;
  }

  const reviewState: ReviewState = {
    status: newStatus,
    reviewer: action.reviewer,
    comments,
    ...(newStatus === 'reviewed' ? { reviewedAt: now } : {}),
    ...(newStatus === 'approved' ? { approvedAt: now } : {}),
  };

  return {
    ...pack,
    reviewStatus: reviewState,
    metadata: {
      ...pack.metadata,
      createdAt: pack.metadata?.createdAt ?? now,
      updatedAt: now,
    },
  };
}

export function isApprovedForDistribution(pack: LessonPack): boolean {
  return pack.reviewStatus?.status === 'approved';
}

export function isReadyForReview(pack: LessonPack): boolean {
  const status = pack.reviewStatus?.status ?? 'draft';
  return status === 'generated' || status === 'under-review';
}

export function getReviewQueue(packPaths: string[]): LessonPack[] {
  const queue: LessonPack[] = [];

  for (const packPath of packPaths) {
    try {
      const pack = loadLessonPack(packPath);
      if (isReadyForReview(pack)) {
        queue.push(pack);
      }
    } catch (error) {
      console.error(`Error loading pack ${packPath}:`, error);
    }
  }

  // Sort by creation date (oldest first)
  queue.sort((a, b) => {
    const dateA = a.metadata?.createdAt ?? '';
    const dateB = b.metadata?.createdAt ?? '';
    return dateA.localeCompare(dateB);
  });

  return queue;
}

export function getPacksByStatus(packPaths: string[], statuses: ReviewStatus[]): LessonPack[] {
  const packs: LessonPack[] = [];

  for (const packPath of packPaths) {
    try {
      const pack = loadLessonPack(packPath);
      const status = pack.reviewStatus?.status ?? 'draft';
      if (statuses.includes(status)) {
        packs.push(pack);
      }
    } catch (error) {
      console.error(`Error loading pack ${packPath}:`, error);
    }
  }

  return packs;
}

/**
 * Create a review status file for tracking
 */
export function saveReviewStatus(pack: LessonPack, outputDir: string): void {
  const statusPath = path.join(outputDir, pack.unit.id, 'review-status.yml');

  const statusData = {
    packId: pack.id,
    unitTitle: pack.unit.titleZh,
    status: pack.reviewStatus?.status ?? 'draft',
    reviewer: pack.reviewStatus?.reviewer,
    reviewedAt: pack.reviewStatus?.reviewedAt,
    approvedAt: pack.reviewStatus?.approvedAt,
    commentCount: pack.reviewStatus?.comments?.length ?? 0,
    lastUpdated: pack.metadata?.updatedAt,
  };

  fs.writeFileSync(statusPath, yaml.stringify(statusData), 'utf-8');
}

/**
 * Format review status for display
 */
export function formatReviewStatus(pack: LessonPack): string {
  const status = pack.reviewStatus?.status ?? 'draft';
  const statusEmoji: Record<ReviewStatus, string> = {
    draft: '📝',
    generated: '🤖',
    'under-review': '👀',
    reviewed: '✅',
    approved: '🎉',
    rejected: '❌',
  };

  return `${statusEmoji[status]} ${status.toUpperCase()}`;
}
