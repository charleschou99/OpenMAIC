import { describe, it, expect } from 'vitest';
import { checkContentSafety, summarizeSafetyCheck } from '../src/content-safety.js';
import type { LessonPack } from '../src/types.js';

const createMockPack = (
  lessons: { id: string; title: string; titleZh: string; topic: string }[],
): LessonPack => ({
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
  lessons: lessons.map((l, i) => ({
    ...l,
    order: i + 1,
  })),
});

describe('Content Safety Filter', () => {
  describe('checkContentSafety', () => {
    it('should pass for safe content', async () => {
      const pack = createMockPack([
        { id: 'lesson-1', title: 'Counting', titleZh: '数一数', topic: '学习数数1到5' },
        { id: 'lesson-2', title: 'Shapes', titleZh: '认识图形', topic: '认识正方形和圆形' },
      ]);

      const result = await checkContentSafety(pack);

      expect(result.passed).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect blocked terms in lesson content', async () => {
      const pack = createMockPack([
        { id: 'lesson-1', title: 'Bad Lesson', titleZh: '暴力内容', topic: '这是关于暴力的课程' },
      ]);

      const result = await checkContentSafety(pack);

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
      expect(result.issues.some((i) => i.matchedTerm === '暴力')).toBe(true);
    });

    it('should warn about complex vocabulary', async () => {
      const pack = createMockPack([
        { id: 'lesson-1', title: 'Abstract Math', titleZh: '抽象数学', topic: '学习抽象概念' },
      ]);

      const result = await checkContentSafety(pack);

      expect(result.issues.some((i) => i.severity === 'warning')).toBe(true);
    });

    it('should check generated stage data', async () => {
      const pack = createMockPack([
        { id: 'lesson-1', title: 'Good Lesson', titleZh: '好课程', topic: '正常内容' },
      ]);

      const stageData = {
        name: 'Test Stage',
        scenes: [{ title: '暴力场景', content: 'bad content with violence' }],
      };

      const result = await checkContentSafety(pack, stageData);

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.matchedTerm === '暴力')).toBe(true);
    });

    it('should support custom blocklist terms', async () => {
      const pack = createMockPack([
        { id: 'lesson-1', title: 'Custom Bad', titleZh: '自定义词汇', topic: '包含自定义敏感词' },
      ]);

      const result = await checkContentSafety(pack, undefined, {
        additionalBlocklist: ['自定义敏感词'],
      });

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.matchedTerm === '自定义敏感词')).toBe(true);
    });
  });

  describe('summarizeSafetyCheck', () => {
    it('should summarize passed check', () => {
      const result = {
        passed: true,
        checkedAt: new Date().toISOString(),
        issues: [],
      };

      const summary = summarizeSafetyCheck(result);
      expect(summary).toContain('✅');
    });

    it('should summarize failed check with errors', () => {
      const result = {
        passed: false,
        checkedAt: new Date().toISOString(),
        issues: [{ lessonId: 'lesson-1', severity: 'error' as const, message: 'Bad content' }],
      };

      const summary = summarizeSafetyCheck(result);
      expect(summary).toContain('❌');
      expect(summary).toContain('1 error');
    });
  });
});
