/**
 * Export lesson packs to offline formats
 *
 * Reuses OpenMAIC's standalone HTML export capabilities for proper playback
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import type { LessonPack } from './types.js';
import type { GeneratedClassroom } from './generator.js';
import { isApprovedForDistribution } from './review-workflow.js';
import { exportPackToStandaloneHtml, type StandaloneExportOptions } from './standalone-export.js';

export interface ExportOptions {
  /** Output directory for exports */
  outputDir: string;
  /** Export format */
  format: 'maic-zip' | 'standalone-html' | 'usb-bundle';
  /** Include unapproved lessons (for testing only) */
  includeUnapproved?: boolean;
  /** Path to the OpenMAIC workspace root (for standalone HTML export) */
  workspaceRoot?: string;
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
export function canExport(
  pack: LessonPack,
  options: ExportOptions,
): { allowed: boolean; reason?: string } {
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
  const generatedLessons = pack.lessons.filter((l) => l.stageId);
  if (generatedLessons.length === 0) {
    return {
      allowed: false,
      reason: 'No lessons have been generated yet',
    };
  }

  return { allowed: true };
}

/**
 * Export a pack to a USB-ready bundle using OpenMAIC's standalone player
 */
export async function exportToUsbBundle(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  options: ExportOptions,
): Promise<ExportResult> {
  const canExportResult = canExport(pack, options);
  if (!canExportResult.allowed) {
    return {
      success: false,
      error: canExportResult.reason,
      lessonsExported: 0,
    };
  }

  // Determine workspace root (for finding standalone player assets)
  const workspaceRoot = options.workspaceRoot || findWorkspaceRoot();
  if (!workspaceRoot) {
    return {
      success: false,
      error: 'Could not find OpenMAIC workspace root. Specify --workspace-root.',
      lessonsExported: 0,
    };
  }

  try {
    const standaloneOptions: StandaloneExportOptions = {
      workspaceRoot,
      lang: 'zh-CN',
    };

    const result = exportPackToStandaloneHtml(
      pack,
      classrooms,
      options.outputDir,
      standaloneOptions,
    );

    // Update pack export info
    pack.exportInfo = {
      exportedAt: new Date().toISOString(),
      format: 'usb-bundle',
      outputPath: result.outputPath,
    };

    return {
      success: result.success,
      outputPath: result.outputPath,
      lessonsExported: result.lessonsExported,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      lessonsExported: 0,
    };
  }
}

/**
 * Export a pack to .maic.zip files
 */
export async function exportToMaicZip(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  options: ExportOptions,
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

    const classroom = classrooms.find((c) => c.stageId === lesson.stageId);
    if (!classroom) continue;

    const zip = new JSZip();

    // Add manifest in the proper format
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
 * Find the OpenMAIC workspace root by looking for public/vendor/standalone-player
 */
function findWorkspaceRoot(): string | null {
  let dir = process.cwd();

  // Walk up the directory tree looking for the workspace
  for (let i = 0; i < 10; i++) {
    const playerDir = path.join(dir, 'public', 'vendor', 'standalone-player');
    if (fs.existsSync(playerDir)) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Main export function
 */
export async function exportPack(
  pack: LessonPack,
  classrooms: GeneratedClassroom[],
  options: ExportOptions,
): Promise<ExportResult> {
  switch (options.format) {
    case 'usb-bundle':
    case 'standalone-html':
      return exportToUsbBundle(pack, classrooms, options);
    case 'maic-zip':
      return exportToMaicZip(pack, classrooms, options);
    default:
      return {
        success: false,
        error: `Unknown format: ${options.format}`,
        lessonsExported: 0,
      };
  }
}
