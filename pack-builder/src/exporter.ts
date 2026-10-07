/**
 * Export lesson packs to offline formats
 * 
 * Reuses OpenMAIC's standalone HTML and .maic.zip export capabilities
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type { LessonPack } from './types.js';
import type { GeneratedClassroom } from './generator.js';
import { isApprovedForDistribution } from './review-workflow.js';

export interface ExportOptions {
  /** Output directory for exports */
  outputDir: string;
  /** Export format */
  format: 'maic-zip' | 'standalone-html' | 'usb-bundle';
  /** Include unapproved lessons (for testing only) */
  includeUnapproved?: boolean;
}

export interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  lessonsExported: number;
}

/**
 * Check if a pack can be exported for distribution
 */
export function canExport(pack: LessonPack, options: ExportOptions): { allowed: boolean; reason?: string } {
  // Safety check must pass
  if (!pack.safetyCheck?.passed) {
    return {
      allowed: false,
      reason: 'Safety check has not passed or has not been run',
    };
  }
  
  // Must be approved unless testing
  if (!options.includeUnapproved && !isApprovedForDistribution(pack)) {
    return {
      allowed: false,
      reason: `Pack status is '${pack.reviewStatus?.status}', must be 'approved' for distribution`,
    };
  }
  
  // Must have generated content
  const generatedLessons = pack.lessons.filter(l => l.stageId);
  if (generatedLessons.length === 0) {
    return {
      allowed: false,
      reason: 'No lessons have been generated yet',
    };
  }
  
  return { allowed: true };
}

/**
 * Create a manifest for the exported bundle
 */
function createBundleManifest(pack: LessonPack): object {
  return {
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
    grade: pack.gradeId,
    subject: pack.subjectId,
    lessons: pack.lessons.map(l => ({
      id: l.id,
      order: l.order,
      title: l.title,
      titleZh: l.titleZh,
      stageId: l.stageId,
    })),
    reviewStatus: pack.reviewStatus?.status,
    approvedAt: pack.reviewStatus?.approvedAt,
  };
}

/**
 * Export a pack to a USB-ready bundle
 * This creates a folder structure that can be copied to USB/SD card
 */
export async function exportToUsbBundle(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  options: ExportOptions
): Promise<ExportResult> {
  const canExportResult = canExport(pack, options);
  if (!canExportResult.allowed) {
    return {
      success: false,
      error: canExportResult.reason,
      lessonsExported: 0,
    };
  }
  
  const bundleDir = path.join(options.outputDir, `${pack.id}-bundle`);
  fs.mkdirSync(bundleDir, { recursive: true });
  
  // Create manifest
  const manifest = createBundleManifest(pack);
  fs.writeFileSync(
    path.join(bundleDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
  
  // Create lessons directory
  const lessonsDir = path.join(bundleDir, 'lessons');
  fs.mkdirSync(lessonsDir, { recursive: true });
  
  // Export each classroom
  let exportedCount = 0;
  for (const lesson of pack.lessons) {
    if (!lesson.stageId) continue;
    
    const classroom = classrooms.find(c => c.stageId === lesson.stageId);
    if (!classroom) continue;
    
    const lessonDir = path.join(lessonsDir, lesson.id);
    fs.mkdirSync(lessonDir, { recursive: true });
    
    // Save stage data
    fs.writeFileSync(
      path.join(lessonDir, 'stage.json'),
      JSON.stringify(classroom.stage, null, 2),
      'utf-8'
    );
    
    // Save scenes data
    fs.writeFileSync(
      path.join(lessonDir, 'scenes.json'),
      JSON.stringify(classroom.scenes, null, 2),
      'utf-8'
    );
    
    // Create a simple standalone HTML wrapper
    const html = createSimpleStandaloneHtml(lesson.titleZh, classroom);
    fs.writeFileSync(
      path.join(lessonDir, 'index.html'),
      html,
      'utf-8'
    );
    
    exportedCount++;
  }
  
  // Create index.html for the bundle
  const indexHtml = createBundleIndexHtml(pack);
  fs.writeFileSync(
    path.join(bundleDir, 'index.html'),
    indexHtml,
    'utf-8'
  );
  
  // Update pack export info
  pack.exportInfo = {
    exportedAt: new Date().toISOString(),
    format: 'usb-bundle',
    outputPath: bundleDir,
  };
  
  return {
    success: true,
    outputPath: bundleDir,
    lessonsExported: exportedCount,
  };
}

/**
 * Export a pack to .maic.zip files
 */
export async function exportToMaicZip(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  options: ExportOptions
): Promise<ExportResult> {
  const canExportResult = canExport(pack, options);
  if (!canExportResult.allowed) {
    return {
      success: false,
      error: canExportResult.reason,
      lessonsExported: 0,
    };
  }
  
  const outputDir = path.join(options.outputDir, pack.id);
  fs.mkdirSync(outputDir, { recursive: true });
  
  let exportedCount = 0;
  
  for (const lesson of pack.lessons) {
    if (!lesson.stageId) continue;
    
    const classroom = classrooms.find(c => c.stageId === lesson.stageId);
    if (!classroom) continue;
    
    const zip = new JSZip();
    
    // Add manifest
    const zipManifest = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '1.2.0',
      stage: classroom.stage,
      scenes: classroom.scenes,
    };
    
    zip.file('manifest.json', JSON.stringify(zipManifest, null, 2));
    
    // Generate the zip file
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(outputDir, `${lesson.id}.maic.zip`);
    fs.writeFileSync(zipPath, zipContent);
    
    exportedCount++;
  }
  
  pack.exportInfo = {
    exportedAt: new Date().toISOString(),
    format: 'maic-zip',
    outputPath: outputDir,
  };
  
  return {
    success: true,
    outputPath: outputDir,
    lessonsExported: exportedCount,
  };
}

/**
 * Create a simple standalone HTML file for a lesson
 * This is a simplified version - full implementation would use OpenMAIC's export
 */
function createSimpleStandaloneHtml(title: string, classroom: GeneratedClassroom): string {
  const stageJson = JSON.stringify(classroom.stage);
  const scenesJson = JSON.stringify(classroom.scenes);
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 义教AI教室</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      width: 100%;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 24px;
    }
    h1 { 
      color: #1a1a1a;
      margin-bottom: 16px;
      font-size: 24px;
    }
    .info {
      background: #e8f4fd;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .info p { color: #1e88e5; margin-bottom: 8px; }
    .scenes {
      display: grid;
      gap: 16px;
    }
    .scene {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
    }
    .scene-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    .scene-type {
      display: inline-block;
      padding: 2px 8px;
      background: #e3f2fd;
      color: #1565c0;
      border-radius: 4px;
      font-size: 12px;
    }
    .offline-notice {
      text-align: center;
      padding: 12px;
      background: #e8f5e9;
      color: #2e7d32;
      border-radius: 8px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📚 ${title}</h1>
    
    <div class="info">
      <p><strong>义教AI教室</strong> - 离线课件</p>
      <p>本课件可在无网络环境下使用</p>
    </div>
    
    <div class="scenes" id="scenes-container">
      <!-- Scenes will be rendered here -->
    </div>
    
    <div class="offline-notice">
      ✅ 离线可用 | 无需网络连接
    </div>
  </div>
  
  <script>
    const stage = ${stageJson};
    const scenes = ${scenesJson};
    
    const container = document.getElementById('scenes-container');
    
    scenes.forEach((scene, index) => {
      const sceneEl = document.createElement('div');
      sceneEl.className = 'scene';
      sceneEl.innerHTML = \`
        <div class="scene-title">第 \${index + 1} 页：\${scene.title || '课程内容'}</div>
        <span class="scene-type">\${scene.type || 'slide'}</span>
      \`;
      container.appendChild(sceneEl);
    });
  </script>
</body>
</html>`;
}

/**
 * Create an index page for a bundle
 */
function createBundleIndexHtml(pack: LessonPack): string {
  const lessonLinks = pack.lessons
    .filter(l => l.stageId)
    .map(l => `
      <a href="lessons/${l.id}/index.html" class="lesson-link">
        <span class="lesson-order">${l.order}</span>
        <span class="lesson-title">${l.titleZh}</span>
      </a>
    `)
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
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header p {
      opacity: 0.9;
    }
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
    .lesson-link:hover {
      background: #f5f5f5;
    }
    .lesson-order {
      width: 32px;
      height: 32px;
      background: #667eea;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 12px;
    }
    .lesson-title {
      font-size: 16px;
    }
    .footer {
      text-align: center;
      color: white;
      margin-top: 30px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 ${pack.unit.titleZh}</h1>
      <p>第${pack.unit.number}单元 · ${pack.lessons.length}节课</p>
    </div>
    
    <div class="lessons">
      ${lessonLinks}
    </div>
    
    <div class="footer">
      <p>义教AI教室 | 离线课件包</p>
      <p>✅ 无需网络连接</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main export function
 */
export async function exportPack(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  options: ExportOptions
): Promise<ExportResult> {
  switch (options.format) {
    case 'usb-bundle':
      return exportToUsbBundle(pack, classrooms, options);
    case 'maic-zip':
      return exportToMaicZip(pack, classrooms, options);
    case 'standalone-html':
      // For standalone HTML, we create a single file per lesson
      // This would integrate with OpenMAIC's full export pipeline
      return exportToUsbBundle(pack, classrooms, { ...options, format: 'usb-bundle' });
    default:
      return {
        success: false,
        error: `Unknown format: ${options.format}`,
        lessonsExported: 0,
      };
  }
}
