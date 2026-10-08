/**
 * DeepSeek provider integration for classroom generation
 *
 * DeepSeek offers cost-effective Chinese language models suitable for educational content.
 *
 * Pricing (as of 2024):
 * - deepseek-chat: $0.14/M input, $0.28/M output (8K context)
 * - deepseek-coder: $0.14/M input, $0.28/M output
 *
 * For classroom generation, typical usage per lesson:
 * - Input: ~2000 tokens (prompt + context)
 * - Output: ~8000 tokens (slides, quiz, actions)
 * - Estimated cost: ~$0.003 per lesson (~¥0.02)
 */

import type { Lesson } from '../types.js';

export interface DeepSeekConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerationCostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  estimatedCostCNY: number;
  model: string;
  lessonsCount: number;
}

// Token estimation constants
const TOKENS_PER_CHAR_ZH = 0.5; // Chinese characters
const _TOKENS_PER_CHAR_EN = 0.25; // English characters (reserved for mixed content)
const PROMPT_BASE_TOKENS = 500; // Base prompt tokens
const LESSON_CONTEXT_TOKENS = 200; // Per-lesson context
const OUTPUT_TOKENS_PER_LESSON = 8000; // Estimated output per lesson

// Pricing per million tokens (USD)
const DEEPSEEK_PRICING = {
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-v4-flash': { input: 0.07, output: 0.14 }, // Estimated flash pricing
};

const USD_TO_CNY = 7.2;

/**
 * Estimate the cost of generating a set of lessons
 */
export function estimateGenerationCost(
  lessons: Lesson[],
  model: string = 'deepseek-chat',
): GenerationCostEstimate {
  // Calculate input tokens
  let inputTokens = PROMPT_BASE_TOKENS;
  for (const lesson of lessons) {
    const topicTokens = (lesson.topic?.length ?? 0) * TOKENS_PER_CHAR_ZH;
    inputTokens += LESSON_CONTEXT_TOKENS + topicTokens;
  }

  // Estimate output tokens
  const outputTokens = lessons.length * OUTPUT_TOKENS_PER_LESSON;

  // Calculate cost
  const pricing =
    DEEPSEEK_PRICING[model as keyof typeof DEEPSEEK_PRICING] ?? DEEPSEEK_PRICING['deepseek-chat'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCostUSD = inputCost + outputCost;

  return {
    inputTokens: Math.ceil(inputTokens),
    outputTokens: Math.ceil(outputTokens),
    estimatedCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    estimatedCostCNY: Math.round(totalCostUSD * USD_TO_CNY * 100) / 100,
    model,
    lessonsCount: lessons.length,
  };
}

/**
 * Format cost estimate for display
 */
export function formatCostEstimate(estimate: GenerationCostEstimate): string {
  return [
    `Cost Estimate for ${estimate.lessonsCount} lesson(s):`,
    `  Model: ${estimate.model}`,
    `  Input tokens: ~${estimate.inputTokens.toLocaleString()}`,
    `  Output tokens: ~${estimate.outputTokens.toLocaleString()}`,
    `  Estimated cost: $${estimate.estimatedCostUSD.toFixed(4)} USD (¥${estimate.estimatedCostCNY.toFixed(2)} CNY)`,
    '',
    `Per-lesson average: $${(estimate.estimatedCostUSD / estimate.lessonsCount).toFixed(4)} USD`,
  ].join('\n');
}

/**
 * Build the generation prompt for a lesson
 */
export function buildLessonPrompt(
  lesson: Lesson,
  gradeLevel: number,
  subjectZh: string,
  textbookEdition: string,
): string {
  const ageRange = `${gradeLevel + 5}-${gradeLevel + 6}`;

  return `
你是一位资深的小学${subjectZh}教师，正在为${gradeLevel}年级学生（${ageRange}岁）设计一节课。

## 教材信息
- 年级：${gradeLevel}年级
- 学科：${subjectZh}
- 教材版本：${textbookEdition}
- 课题：${lesson.titleZh}
- 内容：${lesson.topic}

## 要求
1. 生成一个完整的课堂教学设计，包含：
   - 导入（约5分钟）
   - 新授（约20分钟）
   - 练习（约10分钟）
   - 总结（约5分钟）

2. 每个环节需要包含：
   - 幻灯片内容（标题、正文、图片描述）
   - 教师讲解文本
   - 互动提问

3. 必须包含至少3道练习题/测验：
   - 单选题或判断题
   - 难度适合${gradeLevel}年级
   - 包含答案和解析

4. 语言要求：
   - 使用简洁、生动的语言
   - 适合${ageRange}岁儿童理解
   - 多用形象的比喻和例子

请以JSON格式输出课堂设计。
`.trim();
}

/**
 * DeepSeek API client for classroom generation
 */
export class DeepSeekClient {
  private config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = {
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      maxTokens: 8192,
      temperature: 0.7,
      ...config,
    };
  }

  /**
   * Generate classroom content for a lesson
   */
  async generateLesson(
    lesson: Lesson,
    gradeLevel: number,
    subjectZh: string,
    textbookEdition: string,
  ): Promise<{
    stage: Record<string, unknown>;
    scenes: Record<string, unknown>[];
    tokensUsed: number;
  }> {
    const prompt = buildLessonPrompt(lesson, gradeLevel, subjectZh, textbookEdition);

    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的小学教育内容设计师，擅长创建生动有趣的教学课件。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const result = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };

    const content = result.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from DeepSeek API');
    }

    // Parse and validate the generated content. The return type is a promise the
    // callers rely on (they spread `stage` and iterate `scenes`), so refuse
    // anything that is not shaped like a classroom instead of handing back junk.
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`DeepSeek returned JSON that is not an object (lesson ${lesson.id})`);
    }
    const generated = parsed as { stage?: unknown; scenes?: unknown };
    const stage =
      typeof generated.stage === 'object' &&
      generated.stage !== null &&
      !Array.isArray(generated.stage)
        ? (generated.stage as Record<string, unknown>)
        : { name: lesson.titleZh };
    const scenes = Array.isArray(generated.scenes)
      ? generated.scenes.filter(
          (scene): scene is Record<string, unknown> =>
            typeof scene === 'object' && scene !== null && !Array.isArray(scene),
        )
      : [];
    if (scenes.length === 0) {
      throw new Error(`DeepSeek returned no usable scenes for lesson ${lesson.id}`);
    }

    return {
      stage,
      scenes,
      tokensUsed: result.usage?.total_tokens ?? 0,
    };
  }

  /**
   * Validate API key by making a minimal request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Check if DeepSeek API key is configured
 */
export function isDeepSeekConfigured(): boolean {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  return !!apiKey && apiKey.length > 10 && !apiKey.includes('placeholder');
}

/**
 * Get DeepSeek client from environment
 */
export function getDeepSeekClient(): DeepSeekClient | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey.includes('placeholder')) {
    return null;
  }

  return new DeepSeekClient({
    apiKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  });
}
