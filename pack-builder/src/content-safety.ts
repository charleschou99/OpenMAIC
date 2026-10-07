/**
 * Content safety filter for lesson packs
 * 
 * Implements checks aligned with 未成年人保护法 (Minors Protection Law) and
 * general child-safety requirements for educational content.
 */

import type { LessonPack, SafetyCheckResult, SafetyIssue } from './types.js';

// Blocklist categories for child safety
// These are example terms - a real deployment would have a more comprehensive list
const BLOCKLIST = {
  // Violence-related terms
  violence: [
    '杀', '死亡', '血腥', '暴力', '武器', '枪', '刀', '打架',
    'kill', 'death', 'blood', 'violence', 'weapon', 'gun', 'knife', 'fight',
  ],
  
  // Adult content indicators (use specific phrases to avoid false positives)
  adult: [
    '成人内容', '成人网站', '色情', '裸体', '性行为', '性爱',
    'adult content', 'adult website', 'porn', 'nude', 'sexual',
  ],
  
  // Harmful substances
  substances: [
    '毒品', '吸毒', '酒精', '香烟', '赌博',
    'drugs', 'alcohol', 'cigarette', 'gambling',
  ],
  
  // Politically sensitive (for educational neutrality)
  political: [
    // Note: This is intentionally minimal - actual content should align with
    // official textbook content for 道德与法治
  ],
  
  // Scary/disturbing for young children
  scary: [
    '鬼', '恐怖', '噩梦', '怪物',
    'ghost', 'horror', 'nightmare', 'monster',
  ],
  
  // Discrimination
  discrimination: [
    '歧视', '种族', '侮辱',
    'discriminat', 'racist', 'insult',
  ],
};

// Age-appropriate complexity warnings (not errors)
const COMPLEXITY_PATTERNS = {
  // Complex vocabulary that may be too advanced for Grade 1
  advancedVocabulary: [
    /抽象/, /理论/, /概念性/, /假设/,
    /abstract/, /theoretical/, /conceptual/, /hypothesis/,
  ],
  
  // Long sentences (may be hard for young readers)
  longSentences: /[^。！？.!?]{60,}/,
};

export interface SafetyFilterOptions {
  /** Skip LLM-based classification (use only blocklist) */
  blocklistOnly?: boolean;
  /** Custom blocklist terms to add */
  additionalBlocklist?: string[];
  /** Severity threshold for blocking export */
  blockOnWarnings?: boolean;
}

function extractTextContent(obj: unknown, texts: string[] = []): string[] {
  if (typeof obj === 'string') {
    texts.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      extractTextContent(item, texts);
    }
  } else if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      extractTextContent(value, texts);
    }
  }
  return texts;
}

function checkBlocklist(
  text: string,
  lessonId: string,
  additionalTerms: string[] = []
): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  const lowerText = text.toLowerCase();
  
  // Check all blocklist categories
  for (const [category, terms] of Object.entries(BLOCKLIST)) {
    for (const term of terms) {
      if (lowerText.includes(term.toLowerCase())) {
        issues.push({
          lessonId,
          severity: 'error',
          message: `Content contains blocked term in category '${category}'`,
          matchedTerm: term,
        });
      }
    }
  }
  
  // Check additional custom terms
  for (const term of additionalTerms) {
    if (lowerText.includes(term.toLowerCase())) {
      issues.push({
        lessonId,
        severity: 'error',
        message: `Content contains custom blocked term`,
        matchedTerm: term,
      });
    }
  }
  
  return issues;
}

function checkComplexity(text: string, lessonId: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  
  // Check for advanced vocabulary
  for (const pattern of COMPLEXITY_PATTERNS.advancedVocabulary) {
    if (pattern.test(text)) {
      issues.push({
        lessonId,
        severity: 'warning',
        message: `Content may contain vocabulary too advanced for young learners`,
        location: text.substring(0, 50) + '...',
      });
      break; // Only one warning per lesson
    }
  }
  
  // Check for long sentences
  if (COMPLEXITY_PATTERNS.longSentences.test(text)) {
    issues.push({
      lessonId,
      severity: 'warning',
      message: `Content contains very long sentences that may be hard for young readers`,
    });
  }
  
  return issues;
}

/**
 * Run content safety checks on a lesson pack
 */
export async function checkContentSafety(
  pack: LessonPack,
  stageData?: Record<string, unknown>,
  options: SafetyFilterOptions = {}
): Promise<SafetyCheckResult> {
  const issues: SafetyIssue[] = [];
  const additionalTerms = options.additionalBlocklist ?? [];
  
  // Check lesson metadata
  for (const lesson of pack.lessons) {
    const lessonTexts = [
      lesson.title,
      lesson.titleZh,
      lesson.topic,
    ].filter(Boolean);
    
    for (const text of lessonTexts) {
      issues.push(...checkBlocklist(text, lesson.id, additionalTerms));
      issues.push(...checkComplexity(text, lesson.id));
    }
  }
  
  // Check unit metadata
  const unitTexts = [
    pack.unit.title,
    pack.unit.titleZh,
    ...(pack.unit.objectives ?? []),
  ].filter(Boolean);
  
  for (const text of unitTexts) {
    issues.push(...checkBlocklist(text, 'unit-metadata', additionalTerms));
  }
  
  // Check generated stage data if provided
  if (stageData) {
    const allTexts = extractTextContent(stageData);
    for (const text of allTexts) {
      // Associate with 'generated-content' since we don't know exact lesson
      issues.push(...checkBlocklist(text, 'generated-content', additionalTerms));
      issues.push(...checkComplexity(text, 'generated-content'));
    }
  }
  
  // Determine if check passed
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');
  const passed = !hasErrors && (!options.blockOnWarnings || !hasWarnings);
  
  return {
    passed,
    checkedAt: new Date().toISOString(),
    issues,
  };
}

/**
 * Placeholder for LLM-based content classification
 * This would call a content safety API when available
 */
export async function classifyWithLLM(
  text: string,
  _options?: { model?: string; apiKey?: string }
): Promise<{ safe: boolean; reason?: string }> {
  // TODO: Implement LLM-based classification when API key is available
  // For now, return safe if blocklist check passes
  const issues = checkBlocklist(text, 'llm-check');
  return {
    safe: issues.length === 0,
    reason: issues.length > 0 ? `Blocklist match: ${issues[0]?.matchedTerm}` : undefined,
  };
}

/**
 * Get a summary of safety check results
 */
export function summarizeSafetyCheck(result: SafetyCheckResult): string {
  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;
  
  if (result.passed && errorCount === 0 && warningCount === 0) {
    return '✅ All safety checks passed';
  }
  
  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(`❌ ${errorCount} error(s)`);
  }
  if (warningCount > 0) {
    parts.push(`⚠️ ${warningCount} warning(s)`);
  }
  
  return parts.join(', ') + (result.passed ? ' (passed)' : ' (blocked)');
}
