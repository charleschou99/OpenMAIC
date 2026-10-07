/**
 * Lesson generator - creates OpenMAIC classrooms from lesson definitions
 * 
 * Supports multiple modes:
 * 1. Mock mode: Uses sample fixtures for testing (no API key needed)
 * 2. Real mode: Uses AI providers (DeepSeek, etc.) for actual generation
 * 3. Dry-run mode: Estimates costs without making API calls
 */

import fs from 'fs';
import path from 'path';
import type { Lesson, LessonPack, GenerationInfo } from './types.js';
import { 
  estimateGenerationCost, 
  formatCostEstimate,
  isDeepSeekConfigured,
  getDeepSeekClient,
  type GenerationCostEstimate,
} from './providers/deepseek.js';

export interface GeneratorConfig {
  /** Use mock generation with fixture data */
  mockMode: boolean;
  /** Dry-run mode: estimate costs without making API calls */
  dryRun?: boolean;
  /** Path to fixture classrooms for mock mode (default: pack-builder/test/fixtures/) */
  fixturesPath?: string;
  /** 
   * Output directory for mock-generated classrooms (ignored path).
   * In mock mode, classrooms are written here instead of the curriculum folder.
   */
  mockOutputDir?: string;
  /** Model to use for real generation (e.g., 'deepseek-chat') */
  model?: string;
  /** Provider ID (e.g., 'deepseek') */
  provider?: string;
  /** Base URL for OpenMAIC server (for server-based generation) */
  serverUrl?: string;
  /** Grade level for generation context */
  gradeLevel?: number;
  /** Subject name in Chinese for generation context */
  subjectZh?: string;
  /** Textbook edition for generation context */
  textbookEdition?: string;
}

export { estimateGenerationCost, formatCostEstimate, type GenerationCostEstimate };

export interface GeneratedClassroom {
  stageId: string;
  stage: Record<string, unknown>;
  scenes: Record<string, unknown>[];
}

// Sample fixture stage IDs from the samples folder
const _FIXTURE_STAGES = [
  'stage-aF9YuAXm-V4J', // Dispersion Trade
  'stage-pk-xYPu1_tSM', // OpenMAIC Architecture
];

/**
 * Load a fixture classroom from the test fixtures directory
 */
function loadFixtureClassroom(fixturesPath: string, index: number): GeneratedClassroom | null {
  // Cycle through available fixtures in pack-builder/test/fixtures/
  const sampleDirs = ['dispersion-trade-from-our-lesson', 'openmaic-self-presentation'];
  const sampleDir = sampleDirs[index % sampleDirs.length];
  
  // Try the new fixtures path first (pack-builder/test/fixtures/)
  let stageDir = path.join(fixturesPath, sampleDir!);
  
  // Fall back to samples/generated-classrooms/ if needed
  if (!fs.existsSync(stageDir)) {
    stageDir = path.join(fixturesPath, 'generated-classrooms', sampleDir!);
  }
  
  if (!fs.existsSync(stageDir)) {
    return null;
  }
  
  try {
    const stageJson = JSON.parse(fs.readFileSync(path.join(stageDir, 'stage.json'), 'utf-8'));
    const scenesJson = JSON.parse(fs.readFileSync(path.join(stageDir, 'scenes.json'), 'utf-8'));
    
    return {
      stageId: stageJson.id,
      stage: stageJson.data || stageJson,
      scenes: scenesJson.map((s: { data?: unknown }) => s.data || s),
    };
  } catch (error) {
    console.error(`Error loading fixture from ${stageDir}:`, error);
    return null;
  }
}

/**
 * Adapt a fixture classroom to match a lesson's topic
 * In mock mode, we modify the fixture's title to match the lesson
 */
function adaptFixtureToLesson(
  fixture: GeneratedClassroom,
  lesson: Lesson,
  _lessonIndex: number
): GeneratedClassroom {
  // Create a unique stage ID for this lesson
  const newStageId = `stage-${lesson.id}-${Date.now().toString(36)}`;
  
  const adaptedStage = {
    ...fixture.stage,
    id: newStageId,
    name: lesson.titleZh,
    description: lesson.topic,
  };
  
  // Adapt scene titles if possible
  const adaptedScenes = fixture.scenes.map((scene, idx) => ({
    ...scene,
    id: `scene-${lesson.id}-${idx}`,
  }));
  
  return {
    stageId: newStageId,
    stage: adaptedStage,
    scenes: adaptedScenes,
  };
}

/**
 * Generate a classroom using DeepSeek API directly
 */
async function generateWithDeepSeek(
  lesson: Lesson,
  config: GeneratorConfig
): Promise<GeneratedClassroom> {
  const client = getDeepSeekClient();
  if (!client) {
    throw new Error(
      'DeepSeek API key not configured.\n' +
      'Set DEEPSEEK_API_KEY in .env.local or environment variables.\n' +
      'Get your API key at: https://platform.deepseek.com/'
    );
  }
  
  const gradeLevel = config.gradeLevel ?? 1;
  const subjectZh = config.subjectZh ?? '数学';
  const textbookEdition = config.textbookEdition ?? '人教版';
  
  console.log(`  Generating with DeepSeek (${config.model || 'deepseek-chat'})...`);
  
  const result = await client.generateLesson(lesson, gradeLevel, subjectZh, textbookEdition);
  
  // Create a unique stage ID
  const stageId = `stage-${lesson.id}-${Date.now().toString(36)}`;
  
  return {
    stageId,
    stage: {
      id: stageId,
      name: lesson.titleZh,
      description: lesson.topic,
      ...result.stage,
    },
    scenes: result.scenes,
  };
}

/**
 * Generate a classroom using OpenMAIC's server-based generation pipeline
 * This requires a running OpenMAIC server with configured API keys
 */
async function generateViaServer(
  lesson: Lesson,
  config: GeneratorConfig
): Promise<GeneratedClassroom> {
  const serverUrl = config.serverUrl ?? 'http://127.0.0.1:3000';
  const gradeLevel = config.gradeLevel ?? 1;
  const ageRange = `${gradeLevel + 5}-${gradeLevel + 6}`;
  
  // Build the generation prompt
  const prompt = `
为${gradeLevel}年级小学生创建一节${config.subjectZh ?? '数学'}课：${lesson.titleZh}

主题：${lesson.topic}

要求：
- 语言简单，适合${ageRange}岁儿童
- 多用图片和互动元素
- 语音讲解为主，文字较少
- 包含趣味小测验
- 课程时长约${lesson.durationMinutes ?? 40}分钟
`.trim();

  // Call the generation API
  const response = await fetch(`${serverUrl}/api/generate-classroom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: prompt,
      language: 'zh-CN',
      sceneTypes: lesson.sceneTypes ?? ['slide', 'quiz', 'interactive'],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Generation failed: ${response.status} - ${error}`);
  }
  
  const result = await response.json();
  
  // Poll for completion if async
  if (result.runId) {
    throw new Error('Async generation polling not yet implemented - use --provider deepseek for direct API calls');
  }
  
  return {
    stageId: result.stageId,
    stage: result.stage,
    scenes: result.scenes,
  };
}

/**
 * Generate classroom using the appropriate provider
 */
async function generateRealClassroom(
  lesson: Lesson,
  config: GeneratorConfig
): Promise<GeneratedClassroom> {
  const provider = config.provider ?? 'deepseek';
  
  switch (provider) {
    case 'deepseek':
      return generateWithDeepSeek(lesson, config);
    case 'server':
      return generateViaServer(lesson, config);
    default:
      throw new Error(`Unknown provider: ${provider}. Supported: deepseek, server`);
  }
}

/**
 * Generate classrooms for all lessons in a pack
 */
export async function generatePack(
  pack: LessonPack,
  config: GeneratorConfig,
  onProgress?: (lesson: Lesson, index: number, total: number) => void
): Promise<{
  pack: LessonPack;
  classrooms: GeneratedClassroom[];
  generationInfo: GenerationInfo;
  costEstimate?: GenerationCostEstimate;
}> {
  // Dry-run mode: just estimate costs
  if (config.dryRun) {
    const model = config.model ?? 'deepseek-chat';
    const costEstimate = estimateGenerationCost(pack.lessons, model);
    
    return {
      pack,
      classrooms: [],
      generationInfo: {
        model,
        provider: config.provider ?? 'deepseek',
        generatedAt: new Date().toISOString(),
      },
      costEstimate,
    };
  }
  
  const classrooms: GeneratedClassroom[] = [];
  
  for (let i = 0; i < pack.lessons.length; i++) {
    const lesson = pack.lessons[i]!;
    onProgress?.(lesson, i, pack.lessons.length);
    
    let classroom: GeneratedClassroom;
    
    if (config.mockMode) {
      // Use fixture data
      const fixture = loadFixtureClassroom(
        config.fixturesPath ?? path.join(process.cwd(), 'samples'),
        i
      );
      
      if (!fixture) {
        throw new Error(`No fixture available for lesson ${lesson.id}`);
      }
      
      classroom = adaptFixtureToLesson(fixture, lesson, i);
    } else {
      // Use real generation
      classroom = await generateRealClassroom(lesson, config);
    }
    
    // Update lesson with generated stage ID
    pack.lessons[i] = {
      ...lesson,
      stageId: classroom.stageId,
    };
    
    classrooms.push(classroom);
  }
  
  // Calculate actual cost from tokens used (for real generation)
  const costEstimate = config.mockMode 
    ? undefined 
    : estimateGenerationCost(pack.lessons, config.model ?? 'deepseek-chat');
  
  const generationInfo: GenerationInfo = {
    model: config.mockMode ? 'mock-fixture' : (config.model ?? 'deepseek-chat'),
    provider: config.mockMode ? 'fixture' : (config.provider ?? 'deepseek'),
    generatedAt: new Date().toISOString(),
    cost: costEstimate?.estimatedCostUSD,
  };
  
  // Update pack status to generated
  pack.reviewStatus = {
    ...pack.reviewStatus,
    status: 'generated',
  };
  
  pack.metadata = {
    ...pack.metadata,
    updatedAt: new Date().toISOString(),
    generatedWith: generationInfo,
  };
  
  return {
    pack,
    classrooms,
    generationInfo,
    costEstimate,
  };
}

/**
 * Check if real generation is available (API key configured)
 */
export function isRealGenerationAvailable(): boolean {
  return isDeepSeekConfigured();
}

/**
 * Get available provider information
 */
export function getAvailableProviders(): { id: string; name: string; configured: boolean }[] {
  return [
    {
      id: 'deepseek',
      name: 'DeepSeek',
      configured: isDeepSeekConfigured(),
    },
    {
      id: 'server',
      name: 'OpenMAIC Server',
      configured: false, // Requires running server
    },
  ];
}
