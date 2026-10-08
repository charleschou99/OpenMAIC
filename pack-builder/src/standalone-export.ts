/**
 * Standalone HTML export using OpenMAIC's existing player pipeline
 *
 * This module integrates with lib/export/standalone-html/ to produce
 * proper offline-playable classrooms with slides, quizzes, and narration.
 */

import fs from 'fs';
import path from 'path';
import type { LessonPack } from './types.js';
import type { GeneratedClassroom } from './generator.js';

// Import types that match the standalone player contract
interface ClassroomManifest {
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  stage: {
    name: string;
    description?: string;
    language?: string;
  };
  agents: Array<{
    name: string;
    role?: string;
  }>;
  scenes: Array<{
    type: string;
    title?: string;
    order: number;
    content: unknown;
  }>;
  mediaIndex: Record<string, unknown>;
}

interface StandalonePlayerStrings {
  previous: string;
  next: string;
  scenes: string;
  fullscreen: string;
  exitFullscreen: string;
  emptyClassroom: string;
  unsupportedScene: string;
  interactiveTitle: string;
  videoUnavailable: string;
  quizSubmit: string;
  quizRetry: string;
  quizScore: string;
  quizCorrect: string;
  quizIncorrect: string;
  quizCorrectAnswer: string;
  quizExplanation: string;
  quizReferenceAnswer: string;
  quizNoReferenceAnswer: string;
  quizAnswerPlaceholder: string;
  quizMultipleHint: string;
  pblScenario: string;
  pblGoal: string;
  pblYourRole: string;
  pblCharacters: string;
  pblLearningObjective: string;
  pblMilestones: string;
  pblOnlineOnly: string;
  pblContinueOnline: string;
}

// Chinese strings for the standalone player UI
const CHINESE_PLAYER_STRINGS: StandalonePlayerStrings = {
  previous: '上一页',
  next: '下一页',
  scenes: '目录',
  fullscreen: '全屏',
  exitFullscreen: '退出全屏',
  emptyClassroom: '暂无内容',
  unsupportedScene: '不支持的场景类型',
  interactiveTitle: '互动环节',
  videoUnavailable: '视频不可用',
  quizSubmit: '提交答案',
  quizRetry: '重新作答',
  quizScore: '得分',
  quizCorrect: '正确',
  quizIncorrect: '错误',
  quizCorrectAnswer: '正确答案',
  quizExplanation: '解析',
  quizReferenceAnswer: '参考答案',
  quizNoReferenceAnswer: '暂无参考答案',
  quizAnswerPlaceholder: '请输入你的答案...',
  quizMultipleHint: '可多选',
  pblScenario: '情境',
  pblGoal: '目标',
  pblYourRole: '你的角色',
  pblCharacters: '角色介绍',
  pblLearningObjective: '学习目标',
  pblMilestones: '里程碑',
  pblOnlineOnly: '此内容需要在线访问',
  pblContinueOnline: '在线继续',
};

// Content Security Policy for the standalone HTML
const STANDALONE_HTML_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' data: blob:",
  "style-src 'unsafe-inline' data:",
  'img-src data: blob:',
  'media-src data: blob:',
  'font-src data:',
  'frame-src data: blob:',
  'worker-src data: blob:',
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export interface StandaloneExportOptions {
  /** Path to the OpenMAIC workspace root (to find public/vendor/standalone-player/) */
  workspaceRoot: string;
  /** Language for the player UI */
  lang?: string;
  /** Custom player strings */
  strings?: StandalonePlayerStrings;
}

/**
 * Load the precompiled standalone player assets from the workspace
 */
function loadPlayerAssets(workspaceRoot: string): {
  playerScript: string;
  playerStyle: string;
  mathFonts: string;
  chartsScript: string;
} {
  const assetDir = path.join(workspaceRoot, 'public', 'vendor', 'standalone-player');

  if (!fs.existsSync(assetDir)) {
    throw new Error(
      `Standalone player assets not found at ${assetDir}. ` +
        `Run 'pnpm build:standalone-player' in the workspace root first.`,
    );
  }

  return {
    playerScript: fs.readFileSync(path.join(assetDir, 'player.min.js'), 'utf-8'),
    playerStyle: fs.readFileSync(path.join(assetDir, 'player.min.css'), 'utf-8'),
    mathFonts: fs.readFileSync(path.join(assetDir, 'katex-fonts.min.css'), 'utf-8'),
    chartsScript: fs.readFileSync(path.join(assetDir, 'player-charts.min.js'), 'utf-8'),
  };
}

/**
 * Convert a GeneratedClassroom to the ClassroomManifest format expected by the player
 */
function classroomToManifest(
  classroom: GeneratedClassroom,
  lessonTitle: string,
): ClassroomManifest {
  const stage = classroom.stage as Record<string, unknown>;
  const scenes = classroom.scenes as Array<Record<string, unknown>>;

  // Extract stage data
  const stageData = (stage.data || stage) as Record<string, unknown>;

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: '1.2.0',
    stage: {
      name: lessonTitle || (stageData.name as string) || 'Lesson',
      description: stageData.description as string | undefined,
      language: 'zh-CN',
    },
    agents: ((stageData.generatedAgentConfigs || []) as Array<Record<string, unknown>>).map(
      (agent) => ({
        name: (agent.name as string) || '教师',
        role: agent.role as string | undefined,
      }),
    ),
    scenes: scenes.map((scene, index) => {
      const sceneData = (scene.data || scene) as Record<string, unknown>;
      return {
        type: (sceneData.type as string) || 'slide',
        title: sceneData.title as string | undefined,
        order: index,
        content: sceneData.content || sceneData,
      };
    }),
    mediaIndex: {},
  };
}

/**
 * Check if a manifest has math content (for KaTeX fonts)
 */
function needsMathFonts(manifest: ClassroomManifest): boolean {
  return manifest.scenes.some((scene) => {
    const content = scene.content as Record<string, unknown>;
    if (content?.type === 'slide') {
      return JSON.stringify(content).includes('katex');
    }
    return false;
  });
}

/**
 * Check if a manifest has chart elements
 */
function needsCharts(manifest: ClassroomManifest): boolean {
  return manifest.scenes.some((scene) => {
    const content = scene.content as Record<string, unknown>;
    if (content?.type === 'slide') {
      const canvas = content.canvas as Record<string, unknown> | undefined;
      const elements = (canvas?.elements || []) as Array<Record<string, unknown>>;
      return elements.some((el) => el.type === 'chart');
    }
    return false;
  });
}

/**
 * Assemble the complete standalone HTML document
 */
function assembleStandaloneHtml(input: {
  manifest: ClassroomManifest;
  config: { strings: StandalonePlayerStrings };
  playerScript: string;
  playerStyle: string;
  extraStyles?: string[];
  extraScripts?: string[];
  lang: string;
}): string {
  const title = input.manifest.stage.name || '课程';
  const styles = [input.playerStyle, ...(input.extraStyles ?? [])]
    .map((css) => `<style>${css}</style>`)
    .join('\n');

  return [
    '<!doctype html>',
    `<html lang="${escapeHtmlText(input.lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${STANDALONE_HTML_CSP}">`,
    '<meta name="referrer" content="no-referrer">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="generator" content="OpenMAIC 义教AI教室">',
    `<title>${escapeHtmlText(title)} - 义教AI教室</title>`,
    styles,
    '</head>',
    '<body>',
    '<div id="openmaic-player"></div>',
    `<script type="application/json" id="openmaic-classroom">${serializeJsonForHtmlScript(input.manifest)}</script>`,
    `<script type="application/json" id="openmaic-player-config">${serializeJsonForHtmlScript(input.config)}</script>`,
    ...(input.extraScripts ?? []).map((js) => `<script>${js}</script>`),
    `<script>${input.playerScript}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/**
 * Build a standalone HTML file for a single lesson using the OpenMAIC player
 */
export function buildStandaloneHtmlForLesson(
  classroom: GeneratedClassroom,
  lessonTitle: string,
  options: StandaloneExportOptions,
): string {
  const assets = loadPlayerAssets(options.workspaceRoot);
  const manifest = classroomToManifest(classroom, lessonTitle);
  const strings = options.strings || CHINESE_PLAYER_STRINGS;

  const extraStyles: string[] = [];
  const extraScripts: string[] = [];

  if (needsMathFonts(manifest)) {
    extraStyles.push(assets.mathFonts);
  }

  if (needsCharts(manifest)) {
    extraScripts.push(assets.chartsScript);
  }

  return assembleStandaloneHtml({
    manifest,
    config: { strings },
    playerScript: assets.playerScript,
    playerStyle: assets.playerStyle,
    extraStyles,
    extraScripts,
    lang: options.lang || 'zh-CN',
  });
}

/**
 * Export a lesson pack to standalone HTML files using OpenMAIC's player
 */
export function exportPackToStandaloneHtml(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  outputDir: string,
  options: StandaloneExportOptions,
): { success: boolean; outputPath: string; lessonsExported: number } {
  const bundleDir = path.join(outputDir, `${pack.id}-bundle`);
  fs.mkdirSync(bundleDir, { recursive: true });

  const lessonsDir = path.join(bundleDir, 'lessons');
  fs.mkdirSync(lessonsDir, { recursive: true });

  let exportedCount = 0;

  for (const lesson of pack.lessons) {
    if (!lesson.stageId) continue;

    const classroom = classrooms.find((c) => c.stageId === lesson.stageId);
    if (!classroom) continue;

    const lessonDir = path.join(lessonsDir, lesson.id);
    fs.mkdirSync(lessonDir, { recursive: true });

    // Build standalone HTML using the real player
    const html = buildStandaloneHtmlForLesson(classroom, lesson.titleZh, options);
    fs.writeFileSync(path.join(lessonDir, 'index.html'), html, 'utf-8');

    exportedCount++;
  }

  // Create bundle index
  const indexHtml = createBundleIndexHtml(pack);
  fs.writeFileSync(path.join(bundleDir, 'index.html'), indexHtml, 'utf-8');

  // Create manifest
  const manifest = {
    bundleVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    pack: {
      id: pack.id,
      version: pack.version,
      unit: {
        number: pack.unit.number,
        title: pack.unit.title,
        titleZh: pack.unit.titleZh,
      },
    },
    lessons: pack.lessons
      .filter((l) => l.stageId)
      .map((l) => ({
        id: l.id,
        order: l.order,
        titleZh: l.titleZh,
      })),
  };
  fs.writeFileSync(
    path.join(bundleDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  return {
    success: true,
    outputPath: bundleDir,
    lessonsExported: exportedCount,
  };
}

function createBundleIndexHtml(pack: LessonPack): string {
  const lessonLinks = pack.lessons
    .filter((l) => l.stageId)
    .map(
      (l) => `
      <a href="lessons/${l.id}/index.html" class="lesson-link">
        <span class="lesson-order">${l.order}</span>
        <span class="lesson-title">${l.titleZh}</span>
      </a>
    `,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pack.unit.titleZh} - 义教AI教室</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; color: white; margin-bottom: 30px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .lessons {
      background: white;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .lesson-link {
      display: flex;
      align-items: center;
      padding: 16px;
      text-decoration: none;
      color: #333;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .lesson-link:hover { background: #f5f5f5; }
    .lesson-order {
      width: 32px; height: 32px;
      background: #667eea;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 12px;
    }
    .lesson-title { font-size: 16px; }
    .footer { text-align: center; color: white; margin-top: 30px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 ${pack.unit.titleZh}</h1>
      <p>第${pack.unit.number}单元 · ${pack.lessons.filter((l) => l.stageId).length}节课</p>
    </div>
    <div class="lessons">${lessonLinks}</div>
    <div class="footer">
      <p>义教AI教室 | 离线课件包</p>
      <p>✅ 无需网络连接</p>
    </div>
  </div>
</body>
</html>`;
}
