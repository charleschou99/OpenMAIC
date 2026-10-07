/**
 * Lesson generator - creates OpenMAIC classrooms from lesson definitions
 * 
 * Supports two modes:
 * 1. Mock mode: Uses sample fixtures for testing (no API key needed)
 * 2. Real mode: Uses OpenMAIC's generation pipeline with configured models
 */

import fs from 'fs';
import path from 'path';
import type { Lesson, LessonPack, GenerationInfo } from './types.js';

export interface GeneratorConfig {
  /** Use mock generation with fixture data */
  mockMode: boolean;
  /** Path to fixture classrooms for mock mode */
  fixturesPath?: string;
  /** Model to use for real generation (e.g., 'deepseek:deepseek-v4-flash') */
  model?: string;
  /** Provider ID */
  provider?: string;
  /** Base URL for OpenMAIC server */
  serverUrl?: string;
}

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
 * Load a fixture classroom from the samples directory
 */
function loadFixtureClassroom(fixturesPath: string, index: number): GeneratedClassroom | null {
  // Cycle through available fixtures
  const sampleDirs = ['dispersion-trade-from-our-lesson', 'openmaic-self-presentation'];
  const sampleDir = sampleDirs[index % sampleDirs.length];
  
  const stageDir = path.join(fixturesPath, 'generated-classrooms', sampleDir!);
  
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
 * Generate a classroom using OpenMAIC's real generation pipeline
 * This requires a running OpenMAIC server with configured API keys
 */
async function generateRealClassroom(
  lesson: Lesson,
  config: GeneratorConfig
): Promise<GeneratedClassroom> {
  const serverUrl = config.serverUrl ?? 'http://127.0.0.1:3000';
  
  // Build the generation prompt
  const prompt = `
为一年级小学生创建一节数学课：${lesson.titleZh}

主题：${lesson.topic}

要求：
- 语言简单，适合6-7岁儿童
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
    // This would poll the generation run status
    // For now, throw an error indicating real generation needs implementation
    throw new Error('Async generation polling not yet implemented - use mock mode for testing');
  }
  
  return {
    stageId: result.stageId,
    stage: result.stage,
    scenes: result.scenes,
  };
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
}> {
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
  
  const generationInfo: GenerationInfo = {
    model: config.mockMode ? 'mock-fixture' : config.model,
    provider: config.mockMode ? 'fixture' : config.provider,
    generatedAt: new Date().toISOString(),
    cost: config.mockMode ? 0 : undefined, // Would calculate from API response
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
  };
}

/**
 * Check if real generation is available (API key configured)
 */
export function isRealGenerationAvailable(): boolean {
  // Check for common Chinese model API keys
  const apiKeys = [
    process.env.DEEPSEEK_API_KEY,
    process.env.QWEN_API_KEY,
    process.env.GLM_API_KEY,
    process.env.OPENAI_API_KEY,
  ];
  
  return apiKeys.some(key => key && !key.includes('placeholder'));
}
