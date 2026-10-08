#!/usr/bin/env node
/**
 * Pack Builder CLI
 *
 * Command-line tool for managing lesson packs for the OpenMAIC charity project.
 *
 * Commands:
 *   init <manifest>     Parse manifest and create lesson packs
 *   generate <pack>     Generate classrooms for a pack (mock or real)
 *   safety <pack>       Run content safety checks
 *   review <pack>       Manage review workflow
 *   export <pack>       Export pack to offline format
 *   status [dir]        Show status of all packs in directory
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';

import {
  parseManifest,
  manifestToLessonPacks,
  saveLessonPack,
  loadLessonPack,
  findPacksInDirectory,
} from './manifest-parser.js';
import {
  generatePack,
  isRealGenerationAvailable,
  isServerReachable,
  formatCostEstimate,
  type GeneratorConfig,
  type GeneratedClassroom,
} from './generator.js';
import { checkContentSafety, summarizeSafetyCheck } from './content-safety.js';
import {
  updateReviewStatus,
  formatReviewStatus,
  getReviewQueue,
  isApprovedForDistribution,
} from './review-workflow.js';
import { exportPack, canExport, type ExportOptions } from './exporter.js';
import type { ReviewAction } from './types.js';

const program = new Command();

program
  .name('pack-builder')
  .description('CLI tool for managing lesson packs for 义教AI教室')
  .version('0.1.0');

// Initialize packs from manifest
program
  .command('init')
  .description('Parse a curriculum manifest and create lesson pack files')
  .argument('<manifest>', 'Path to manifest YAML file')
  .option('-o, --output <dir>', 'Output directory for packs', './curriculum')
  .action(async (manifestPath: string, options: { output: string }) => {
    const spinner = ora('Parsing manifest...').start();

    try {
      const manifest = parseManifest(manifestPath);
      spinner.text = `Found ${manifest.units.length} units`;

      const packs = manifestToLessonPacks(manifest);

      // Determine output directory based on manifest location
      const manifestDir = path.dirname(manifestPath);
      const outputDir = options.output === './curriculum' ? manifestDir : options.output;

      for (const pack of packs) {
        const packPath = saveLessonPack(pack, outputDir);
        spinner.text = `Created: ${packPath}`;
      }

      spinner.succeed(`Created ${packs.length} lesson packs`);

      console.log('\n' + chalk.cyan('Next steps:'));
      console.log('  1. Generate classrooms: ' + chalk.yellow(`pack-builder generate <pack-dir>`));
      console.log('  2. Run safety check:    ' + chalk.yellow(`pack-builder safety <pack-dir>`));
      console.log(
        '  3. Review and approve:  ' + chalk.yellow(`pack-builder review <pack-dir> --approve`),
      );
      console.log('  4. Export for offline:  ' + chalk.yellow(`pack-builder export <pack-dir>`));
    } catch (error) {
      spinner.fail(`Failed to parse manifest: ${error}`);
      process.exit(1);
    }
  });

// Generate classrooms
program
  .command('generate')
  .description('Generate classrooms for a lesson pack')
  .argument('<pack>', 'Path to pack directory or pack.yml file')
  .option('--mock', 'Use mock generation with fixture data', true)
  .option('--real', 'Use real generation with configured API')
  .option('--dry-run', 'Estimate costs without generating')
  .option('--provider <name>', 'AI provider: deepseek, server', 'deepseek')
  .option(
    '--server-url <url>',
    'OpenMAIC server URL for --provider server',
    'http://127.0.0.1:3000',
  )
  .option('--model <name>', 'Model to use (e.g., deepseek-chat)', 'deepseek-chat')
  .option('--fixtures <path>', 'Path to fixture samples (default: pack-builder/test/fixtures/)')
  .option('--mock-output <dir>', 'Output directory for mock-generated classrooms', '.mock-output')
  .action(
    async (
      packPath: string,
      options: {
        mock: boolean;
        real: boolean;
        dryRun?: boolean;
        provider: string;
        serverUrl: string;
        model: string;
        fixtures?: string;
        mockOutput: string;
      },
    ) => {
      const spinner = ora('Loading pack...').start();

      try {
        // Resolve pack path
        let packFile = packPath;
        if (fs.statSync(packPath).isDirectory()) {
          packFile = path.join(packPath, 'pack.yml');
        }

        const pack = loadLessonPack(packFile);
        const useMock = options.real ? false : options.dryRun ? false : options.mock;
        const isDryRun = options.dryRun ?? false;
        const provider = options.provider === 'server' ? 'server' : 'deepseek';
        const serverUrl = (options.serverUrl ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');

        // Availability depends on the provider: `deepseek` needs a local key, while
        // `server` holds its keys server-side and only needs the server to be up.
        if (!useMock && !isDryRun) {
          if (provider === 'server') {
            const reachable = await isServerReachable(serverUrl);
            if (!reachable.ok) {
              spinner.warn(`OpenMAIC server not usable: ${reachable.reason}`);
              console.log(chalk.yellow('\nThe server provider needs a running OpenMAIC instance:'));
              console.log('  1. Start it:  pnpm dev   (or pnpm build && pnpm start)');
              console.log('  2. Confirm:   curl ' + serverUrl + '/api/health');
              console.log(
                '  3. Or point at another instance: pack-builder generate <pack> --real --provider server --server-url <url>\n',
              );
              console.log(
                chalk.cyan(
                  'Provider keys live on the server, so no DEEPSEEK_API_KEY is needed here.',
                ),
              );
              process.exit(1);
            }
            spinner.info(`Using OpenMAIC server ${serverUrl} (v${reachable.version ?? '?'})`);
          } else if (!isRealGenerationAvailable()) {
            spinner.warn('No API key found.');
            console.log(chalk.yellow('\nTo generate with DeepSeek:'));
            console.log('  1. Get API key: https://platform.deepseek.com/');
            console.log('  2. Set DEEPSEEK_API_KEY in .env.local or environment');
            console.log('  3. Run: pack-builder generate <pack> --real --provider deepseek\n');
            console.log(chalk.cyan('Or use --mock for testing with fixture data'));
            console.log(chalk.cyan('Or use --dry-run to estimate costs without API key'));
            process.exit(1);
          }
        }

        // Determine fixtures path - default to pack-builder/test/fixtures/
        const cliDir = path.dirname(new URL(import.meta.url).pathname);
        const defaultFixturesPath = path.resolve(cliDir, '..', 'test', 'fixtures');
        const fixturesPath = options.fixtures
          ? path.resolve(options.fixtures)
          : defaultFixturesPath;

        // Extract grade/subject info from pack path for generation context
        const packDirForContext = path.dirname(packFile);
        const pathParts = packDirForContext.split(path.sep);
        const gradeMatch = pathParts.find((p) => /^[一二三四五六]年级$/.test(p));
        const gradeLevel = gradeMatch
          ? ['一', '二', '三', '四', '五', '六'].indexOf(gradeMatch[0]!) + 1
          : 1;
        const subjectZh =
          pathParts.find((p) => ['语文', '数学', '英语', '道德与法治', '科学'].includes(p)) ??
          '数学';

        const config: GeneratorConfig = {
          mockMode: useMock,
          dryRun: isDryRun,
          fixturesPath,
          mockOutputDir: useMock ? path.resolve(options.mockOutput) : undefined,
          provider: options.provider,
          serverUrl,
          model: options.model,
          gradeLevel,
          subjectZh,
          textbookEdition:
            subjectZh === '语文' || subjectZh === '道德与法治'
              ? '统编版'
              : subjectZh === '数学'
                ? '人教版'
                : subjectZh === '英语'
                  ? '人教版 PEP'
                  : '教科版',
        };

        if (isDryRun) {
          spinner.text = 'Estimating generation costs...';
        } else {
          spinner.text = `Generating ${pack.lessons.length} lessons (${useMock ? 'mock' : options.provider} mode)...`;
        }

        const result = await generatePack(pack, config, (lesson, index, total) => {
          if (!isDryRun) {
            spinner.text = `Generating lesson ${index + 1}/${total}: ${lesson.titleZh}`;
          }
        });

        // Dry-run: just show cost estimate
        if (isDryRun) {
          spinner.stop();
          console.log('\n' + chalk.bold('📊 Cost Estimate (Dry Run)\n'));
          if (result.costEstimate) {
            console.log(formatCostEstimate(result.costEstimate));
          }
          console.log(chalk.cyan('\nTo generate for real:'));
          console.log(`  pack-builder generate ${packPath} --real --provider ${options.provider}`);
          return;
        }

        // Save updated pack
        const packDir = path.dirname(packFile);
        saveLessonPack(result.pack, path.dirname(packDir));

        // In mock mode, save classrooms to the mock output directory (ignored)
        // In real mode, save to the curriculum folder
        const classroomsDir = useMock
          ? path.join(path.resolve(options.mockOutput), pack.unit.id, 'classrooms')
          : path.join(packDir, 'classrooms');
        fs.mkdirSync(classroomsDir, { recursive: true });

        for (const classroom of result.classrooms) {
          const classroomDir = path.join(classroomsDir, classroom.stageId);
          fs.mkdirSync(classroomDir, { recursive: true });

          fs.writeFileSync(
            path.join(classroomDir, 'stage.json'),
            JSON.stringify(classroom.stage, null, 2),
          );
          fs.writeFileSync(
            path.join(classroomDir, 'scenes.json'),
            JSON.stringify(classroom.scenes, null, 2),
          );
        }

        spinner.succeed(`Generated ${result.classrooms.length} classrooms`);

        // Show cost info for real generation
        if (!useMock && result.costEstimate) {
          console.log(
            chalk.dim(
              `\n💰 Estimated cost: $${result.costEstimate.estimatedCostUSD.toFixed(4)} USD (¥${result.costEstimate.estimatedCostCNY.toFixed(2)} CNY)`,
            ),
          );
        }

        if (useMock) {
          console.log(chalk.yellow('\n⚠️  Mock mode: classrooms use fixture data'));
          console.log('   To generate real content:');
          console.log('   1. Set DEEPSEEK_API_KEY in .env.local');
          console.log(`   2. Run: pack-builder generate ${packPath} --real --provider deepseek`);
        }
      } catch (error) {
        spinner.fail(`Generation failed: ${error}`);
        process.exit(1);
      }
    },
  );

// Safety check
program
  .command('safety')
  .description('Run content safety checks on a pack')
  .argument('<pack>', 'Path to pack directory or pack.yml file')
  .option('--strict', 'Block on warnings (default: only errors)')
  .action(async (packPath: string, options: { strict: boolean }) => {
    const spinner = ora('Loading pack...').start();

    try {
      let packFile = packPath;
      if (fs.statSync(packPath).isDirectory()) {
        packFile = path.join(packPath, 'pack.yml');
      }

      const pack = loadLessonPack(packFile);
      spinner.text = 'Running safety checks...';

      // Load classroom data if available
      const classroomsDir = path.join(path.dirname(packFile), 'classrooms');
      let stageData: Record<string, unknown> | undefined;

      if (fs.existsSync(classroomsDir)) {
        const stageDirs = fs.readdirSync(classroomsDir);
        for (const stageDir of stageDirs) {
          const stagePath = path.join(classroomsDir, stageDir, 'stage.json');
          if (fs.existsSync(stagePath)) {
            const stage = JSON.parse(fs.readFileSync(stagePath, 'utf-8'));
            stageData = { ...stageData, ...stage };
          }
        }
      }

      const result = await checkContentSafety(pack, stageData, {
        blockOnWarnings: options.strict,
      });

      // Update pack with safety check result
      pack.safetyCheck = result;
      saveLessonPack(pack, path.dirname(path.dirname(packFile)));

      spinner.stop();

      console.log('\n' + chalk.bold('Safety Check Results:'));
      console.log(summarizeSafetyCheck(result));

      if (result.issues.length > 0) {
        console.log('\n' + chalk.bold('Issues found:'));
        for (const issue of result.issues) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          console.log(`  ${icon} [${issue.lessonId}] ${issue.message}`);
          if (issue.matchedTerm) {
            console.log(`     Matched: "${issue.matchedTerm}"`);
          }
        }
      }

      if (!result.passed) {
        console.log('\n' + chalk.red('Safety check failed. Pack cannot be exported.'));
        process.exit(1);
      } else {
        console.log('\n' + chalk.green('Safety check passed. Pack can proceed to review.'));
      }
    } catch (error) {
      spinner.fail(`Safety check failed: ${error}`);
      process.exit(1);
    }
  });

// Review workflow
program
  .command('review')
  .description('Manage the review workflow for a pack')
  .argument('<pack>', 'Path to pack directory or pack.yml file')
  .option('--start', 'Start review process')
  .option('--submit', 'Submit review')
  .option('--approve', 'Approve pack for distribution')
  .option('--reject', 'Reject pack')
  .option('-r, --reviewer <name>', 'Reviewer identifier', 'anonymous-reviewer')
  .option('-c, --comment <text>', 'Add a comment')
  .action(
    async (
      packPath: string,
      options: {
        start?: boolean;
        submit?: boolean;
        approve?: boolean;
        reject?: boolean;
        reviewer: string;
        comment?: string;
      },
    ) => {
      try {
        let packFile = packPath;
        if (fs.statSync(packPath).isDirectory()) {
          packFile = path.join(packPath, 'pack.yml');
        }

        let pack = loadLessonPack(packFile);

        console.log(chalk.bold(`\nPack: ${pack.unit.titleZh}`));
        console.log(`Current status: ${formatReviewStatus(pack)}`);

        let action: ReviewAction | null = null;

        if (options.start) {
          action = { action: 'start-review', reviewer: options.reviewer };
        } else if (options.submit) {
          action = {
            action: 'submit-review',
            reviewer: options.reviewer,
            comment: options.comment,
          };
        } else if (options.approve) {
          action = { action: 'approve', reviewer: options.reviewer, comment: options.comment };
        } else if (options.reject) {
          action = { action: 'reject', reviewer: options.reviewer, comment: options.comment };
        } else if (options.comment) {
          action = { action: 'add-comment', reviewer: options.reviewer, comment: options.comment };
        }

        if (action) {
          pack = updateReviewStatus(pack, action);
          saveLessonPack(pack, path.dirname(path.dirname(packFile)));
          console.log(`New status: ${formatReviewStatus(pack)}`);
        }

        // Show recent comments
        const comments = pack.reviewStatus?.comments ?? [];
        if (comments.length > 0) {
          console.log('\n' + chalk.bold('Recent comments:'));
          for (const c of comments.slice(-3)) {
            console.log(`  [${c.timestamp.slice(0, 10)}] ${c.reviewer}: ${c.comment}`);
          }
        }

        if (isApprovedForDistribution(pack)) {
          console.log('\n' + chalk.green('✅ Pack is approved for distribution'));
        }
      } catch (error) {
        console.error(chalk.red(`Review action failed: ${error}`));
        process.exit(1);
      }
    },
  );

// Export
program
  .command('export')
  .description('Export a pack to offline format')
  .argument('<pack>', 'Path to pack directory or pack.yml file')
  .option('-o, --output <dir>', 'Output directory', './exports')
  .option('-f, --format <type>', 'Export format (usb-bundle, maic-zip)', 'usb-bundle')
  .option('--force', 'Export even if not approved (for testing)')
  .option('--workspace-root <path>', 'Path to OpenMAIC workspace root')
  .action(
    async (
      packPath: string,
      options: {
        output: string;
        format: string;
        force?: boolean;
        workspaceRoot?: string;
      },
    ) => {
      const spinner = ora('Loading pack...').start();

      try {
        let packFile = packPath;
        if (fs.statSync(packPath).isDirectory()) {
          packFile = path.join(packPath, 'pack.yml');
        }

        const pack = loadLessonPack(packFile);

        // Load classrooms - check both mock output and curriculum folder
        const packUnitId = pack.unit.id;
        const packDir = path.dirname(packFile);

        // Find workspace root by looking for package.json with openmaic
        let workspaceRoot = packDir;
        for (let i = 0; i < 10; i++) {
          const pkgPath = path.join(workspaceRoot, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.name === 'openmaic' || pkg.name?.includes('openmaic')) {
              break;
            }
          }
          const parent = path.dirname(workspaceRoot);
          if (parent === workspaceRoot) break;
          workspaceRoot = parent;
        }

        const mockClassroomsDir = path.join(
          workspaceRoot,
          '.mock-output',
          packUnitId,
          'classrooms',
        );
        const curriculumClassroomsDir = path.join(packDir, 'classrooms');

        // Prefer mock output if it exists, otherwise use curriculum folder
        const classroomsDir = fs.existsSync(mockClassroomsDir)
          ? mockClassroomsDir
          : curriculumClassroomsDir;
        const classrooms: GeneratedClassroom[] = [];

        if (fs.existsSync(classroomsDir)) {
          const stageDirs = fs.readdirSync(classroomsDir);
          for (const stageDir of stageDirs) {
            const stagePath = path.join(classroomsDir, stageDir, 'stage.json');
            const scenesPath = path.join(classroomsDir, stageDir, 'scenes.json');

            if (fs.existsSync(stagePath) && fs.existsSync(scenesPath)) {
              // These files come off disk, so check the shape rather than trusting it:
              // a stage that is not an object, or a scene list with no usable entries,
              // would otherwise reach the exporter and fail there with a worse message.
              const stage: unknown = JSON.parse(fs.readFileSync(stagePath, 'utf-8'));
              const scenes: unknown = JSON.parse(fs.readFileSync(scenesPath, 'utf-8'));
              const usableScenes = Array.isArray(scenes)
                ? scenes.filter(
                    (scene): scene is Record<string, unknown> =>
                      typeof scene === 'object' && scene !== null && !Array.isArray(scene),
                  )
                : [];
              if (
                typeof stage === 'object' &&
                stage !== null &&
                !Array.isArray(stage) &&
                usableScenes.length > 0
              ) {
                classrooms.push({
                  stageId: stageDir,
                  stage: stage as Record<string, unknown>,
                  scenes: usableScenes,
                });
              } else {
                console.log(chalk.yellow(`Skipping ${stageDir}: not shaped like a classroom`));
              }
            }
          }
        }

        const exportOptions: ExportOptions = {
          outputDir: path.resolve(options.output),
          format: options.format as 'usb-bundle' | 'maic-zip',
          includeUnapproved: options.force,
          workspaceRoot: options.workspaceRoot,
        };

        // Check if export is allowed
        const canExportResult = canExport(pack, exportOptions);
        if (!canExportResult.allowed && !options.force) {
          spinner.fail(`Cannot export: ${canExportResult.reason}`);
          console.log(chalk.yellow('Use --force to export anyway (for testing only)'));
          process.exit(1);
        }

        spinner.text = 'Exporting...';

        const result = await exportPack(pack, classrooms, exportOptions);

        if (result.success) {
          // Save updated pack with export info
          saveLessonPack(pack, path.dirname(path.dirname(packFile)));

          spinner.succeed(`Exported ${result.lessonsExported} lessons to ${result.outputPath}`);

          console.log('\n' + chalk.cyan('Bundle contents:'));
          console.log(`  ${result.outputPath}/`);
          console.log('  ├── index.html          (lesson list)');
          console.log('  ├── manifest.json       (pack metadata)');
          console.log('  └── lessons/');
          for (const lesson of pack.lessons.filter((l) => l.stageId)) {
            console.log(`      └── ${lesson.id}/index.html`);
          }

          console.log('\n' + chalk.green('✅ Offline bundle ready for USB/SD card distribution'));
        } else {
          spinner.fail(`Export failed: ${result.error}`);
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(`Export failed: ${error}`);
        process.exit(1);
      }
    },
  );

// Status overview
program
  .command('status')
  .description('Show status of all packs in a directory')
  .argument('[dir]', 'Directory to scan', './curriculum')
  .action(async (dir: string) => {
    const packPaths = findPacksInDirectory(path.resolve(dir));

    if (packPaths.length === 0) {
      console.log(chalk.yellow('No packs found in ' + dir));
      console.log('Run: pack-builder init <manifest.yml>');
      return;
    }

    console.log(chalk.bold(`\nLesson Packs in ${dir}:\n`));

    const statusCounts: Record<string, number> = {};

    for (const packPath of packPaths) {
      try {
        const pack = loadLessonPack(packPath);
        const status = pack.reviewStatus?.status ?? 'draft';
        statusCounts[status] = (statusCounts[status] ?? 0) + 1;

        const safetyIcon = pack.safetyCheck?.passed ? '✅' : pack.safetyCheck ? '❌' : '⚪';
        const genCount = pack.lessons.filter((l) => l.stageId).length;

        console.log(
          `  ${formatReviewStatus(pack)} ${safetyIcon} ` +
            chalk.bold(pack.unit.titleZh) +
            ` (${genCount}/${pack.lessons.length} generated)`,
        );
      } catch (_error) {
        console.log(chalk.red(`  ❓ Error loading ${packPath}`));
      }
    }

    console.log('\n' + chalk.bold('Summary:'));
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  ${status}: ${count}`);
    }

    // Show review queue
    const reviewQueue = getReviewQueue(packPaths);
    if (reviewQueue.length > 0) {
      console.log(
        '\n' + chalk.cyan(`📋 Review queue: ${reviewQueue.length} pack(s) awaiting review`),
      );
    }
  });

program.parse();
