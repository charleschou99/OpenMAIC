/**
 * Parse curriculum manifests from YAML files
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import type { Manifest, LessonPack, Lesson } from './types.js';

export function parseManifest(manifestPath: string): Manifest {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  const data = yaml.parse(content);

  if (!data.grade || !data.subject || !data.units) {
    throw new Error(`Invalid manifest: missing required fields (grade, subject, units)`);
  }

  return {
    grade: data.grade,
    subject: data.subject,
    units: data.units,
  };
}

export function manifestToLessonPacks(manifest: Manifest): LessonPack[] {
  const packs: LessonPack[] = [];

  for (const unit of manifest.units) {
    const packId = `pack-${manifest.grade.id}-${manifest.subject.id}-${unit.id}`;

    const lessons: Lesson[] = unit.lessons.map((lesson) => ({
      ...lesson,
      durationMinutes: lesson.durationMinutes ?? manifest.subject.sessionDurationMinutes,
    }));

    packs.push({
      id: packId,
      version: '0.1.0',
      gradeId: manifest.grade.id,
      subjectId: manifest.subject.id,
      unit: {
        ...unit,
        lessons: [], // Stored separately at top level
      },
      lessons,
      reviewStatus: {
        status: 'draft',
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return packs;
}

export function saveLessonPack(pack: LessonPack, outputDir: string): string {
  const packDir = path.join(outputDir, pack.unit.id);
  fs.mkdirSync(packDir, { recursive: true });

  const packPath = path.join(packDir, 'pack.yml');
  pack.metadata = {
    ...pack.metadata,
    createdAt: pack.metadata?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(packPath, yaml.stringify(pack), 'utf-8');
  return packPath;
}

export function loadLessonPack(packPath: string): LessonPack {
  const content = fs.readFileSync(packPath, 'utf-8');
  return yaml.parse(content) as LessonPack;
}

export function findPacksInDirectory(dir: string): string[] {
  const packs: string[] = [];

  if (!fs.existsSync(dir)) {
    return packs;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packPath = path.join(dir, entry.name, 'pack.yml');
      if (fs.existsSync(packPath)) {
        packs.push(packPath);
      }
    }
  }

  return packs;
}
