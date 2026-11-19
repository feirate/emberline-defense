import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isStudyAudioPath } from '../study.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CSV_COLUMNS = ['id', 'en', 'zhHint', 'audio', 'book', 'unitId', 'chapter', 'printedPage', 'pdfPage'];

function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}

const validId = id => typeof id === 'string' && id.length <= 96 && ID.test(id);
const present = value => typeof value === 'string' && value.trim().length > 0;
const validPage = value => Number.isSafeInteger(value) && value > 0;

export function parseCsvCatalog(raw) {
  const text = raw.replace(/^\ufeff/, '');
  const field = /("(?:[^"]|"")*"|[^",\r\n]*)(,|\r\n|[\r\n]|$)/gy;
  const rows = [];
  let row = [];
  let next = 0;
  let separator;
  do {
    field.lastIndex = next;
    const match = field.exec(text);
    requireValid(match, `CSV 格式错误，位置 ${next}。`);
    const quoted = match[1].startsWith('"');
    row.push(quoted ? match[1].slice(1, -1).replaceAll('""', '"') : match[1]);
    next = field.lastIndex;
    separator = match[2];
    if (separator !== ',') {
      if (row.length > 1 || row[0].trim()) rows.push(row);
      row = [];
    }
  } while (next < text.length || separator === ',');

  const header = rows.shift()?.map(name => name.trim());
  requireValid(header && new Set(header).size === header.length && CSV_COLUMNS.every(name => header.includes(name)),
    `CSV 表头应包含 ${CSV_COLUMNS.join(', ')}。`);
  return rows.map((values, index) => {
    requireValid(values.length === header.length, `CSV 第 ${index + 2} 条记录列数不匹配。`);
    const { id, en, zhHint, audio, book, unitId, chapter, printedPage, pdfPage } = Object.fromEntries(
      header.map((name, column) => [name, values[column].trim()]),
    );
    return { id, en, zhHint, audio, source: { book, unitId, chapter, printedPage: Number(printedPage), pdfPage: Number(pdfPage) } };
  });
}

function catalogWords(catalog) {
  if (Array.isArray(catalog)) return catalog;
  if (Array.isArray(catalog?.words)) return catalog.words;
  requireValid(Array.isArray(catalog?.unitPacks), '词表 JSON 需提供 words 或 unitPacks。');
  return catalog.unitPacks.flatMap(unit => {
    requireValid(validId(unit?.id) && Array.isArray(unit.entries), '词表的单元格式不正确。');
    return unit.entries.map(entry => {
      requireValid(typeof entry?.id === 'string' && entry.id.startsWith(`${unit.id}-`), `词条 ID 与单元 ${unit.id} 不匹配。`);
      const slug = entry.id.slice(unit.id.length + 1);
      return {
        id: entry.id, en: entry.en, zhHint: entry.zhHint, audio: `./assets/study/${slug}.m4a`,
        source: {
          book: catalog.book, unitId: unit.id, chapter: unit.title, printedPage: entry.printedPage,
          pdfPage: entry.pdfPage, glossaryEntryIds: entry.glossaryEntryIds,
        },
      };
    });
  });
}

function verifyEntry(entry, assetRoot) {
  const { id, en, zhHint, audio, source } = entry;
  requireValid(present(en) && /[a-z]/i.test(en) && present(zhHint), `词条 ${id} 缺少可出题的英文或中文词义。`);
  requireValid(isStudyAudioPath(audio), `词条 ${id} 音频路径无效。`);
  const { book, unitId, chapter, printedPage, pdfPage, glossaryEntryIds } = source ?? {};
  requireValid(present(book) && validId(unitId) && present(chapter) &&
    validPage(printedPage) && validPage(pdfPage), `词条 ${id} 缺少教材出处或页码。`);
  requireValid(glossaryEntryIds === undefined || (Array.isArray(glossaryEntryIds) && glossaryEntryIds.every(validId)),
    `词条 ${id} 的附录词表引用无效。`);
  let clip;
  try { clip = readFileSync(resolve(assetRoot, audio)); } catch {
    throw new Error(`词条 ${id} 的音频文件不可读取。`);
  }
  requireValid(clip.length > 2048 && clip.toString('ascii', 4, 8) === 'ftyp', `词条 ${id} 的音频文件无效。`);
  return { id, en: en.trim(), zhHint: zhHint.trim(), audio,
    source: { book, unitId, chapter, printedPage, pdfPage, ...(glossaryEntryIds ? { glossaryEntryIds } : {}) },
  };
}

export function buildManifest(catalog, plan, assetRoot = ROOT) {
  requireValid(plan?.version === 1 && Array.isArray(plan.courses) && plan.courses.length, '课程计划格式不正确。');
  const words = new Map();
  for (const entry of catalogWords(catalog)) {
    requireValid(validId(entry?.id) && !words.has(entry.id), `词表 ID 不正确或重复 ${entry?.id ?? ''}。`);
    words.set(entry.id, entry);
  }

  const courseIds = new Set();
  const stageIds = new Set();
  return plan.courses.map(course => {
    const { id, title, subtitle, station, stages } = course ?? {};
    requireValid(validId(id) && !courseIds.has(id) && present(title) && present(subtitle) && present(station) &&
      Array.isArray(stages) && stages.length, `课程 ${id} 格式错误或 ID 重复。`);
    courseIds.add(id);
    const wordIds = new Set();
    const spellings = new Set();
    const generatedStages = stages.map(stage => {
      const { id, title, levelId, wordCount, wordIds: targets, story } = stage ?? {};
      requireValid(validId(id) && !stageIds.has(id) && present(title) && validId(levelId), `关卡 ${id} 格式错误或 ID 重复。`);
      stageIds.add(id);
      requireValid(Number.isSafeInteger(wordCount) && wordCount > 0 && Array.isArray(targets) && targets.length === wordCount,
        `关卡 ${id} 需要 ${wordCount} 个词条。`);
      const entries = targets.map(wordId => {
        requireValid(words.has(wordId), `关卡 ${id} 缺少词条 ${wordId}。`);
        const entry = verifyEntry(words.get(wordId), assetRoot);
        const spelling = entry.en.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
        requireValid(!wordIds.has(wordId) && !spellings.has(spelling), `关卡 ${id} 的课程主线词条重复 ${wordId}。`);
        wordIds.add(wordId);
        spellings.add(spelling);
        return entry;
      });
      requireValid(story === undefined || (present(story?.opening) && present(story.victory)), `关卡 ${id} 的电台对白不完整。`);
      return { id, title, levelId, packId: id, entries,
        ...(story ? { story: { opening: story.opening.trim(), victory: story.victory.trim() } } : {}),
      };
    });
    return { id, title, subtitle, station, stages: generatedStages };
  });
}

export function renderModule(courses) {
  return '// Generated by tools/generate-courses.mjs.\nexport default ' + JSON.stringify(courses, null, 2) + ';\n';
}

function main(args) {
  const usage = '用法 node tools/generate-courses.mjs [--check] [词表.csv|词表.json 课程计划.json 输出.mjs]\n' +
    `CSV 字段 ${CSV_COLUMNS.join(', ')}。JSON 支持教材 unitPacks 或包含 source 对象的 words 数组。\n` +
    '课程计划示例见 data/formal-course-plan.json。已发布的课包要保留旧关卡 ID 和词条，改动时新增版本。\n';
  if (args.includes('--help')) {
    process.stdout.write(usage);
    return;
  }
  const paths = args.filter(arg => arg !== '--check');
  requireValid(paths.length === 0 || paths.length === 3, usage.trim());
  const [catalogPath, planPath, outputPath] = paths.length ? paths.map(path => resolve(path)) : [
    resolve(ROOT, 'kb3-word-packs.json'), resolve(ROOT, 'data/formal-course-plan.json'),
    resolve(ROOT, 'data/formal-courses.generated.mjs'),
  ];
  requireValid(outputPath !== catalogPath && outputPath !== planPath && extname(outputPath) === '.mjs', '输出需为独立的 .mjs 文件。');
  const catalogText = readFileSync(catalogPath, 'utf8');
  const catalog = extname(catalogPath).toLowerCase() === '.csv' ? parseCsvCatalog(catalogText) : JSON.parse(catalogText);
  const courses = buildManifest(catalog, JSON.parse(readFileSync(planPath, 'utf8')));
  const output = renderModule(courses);
  if (args.includes('--check')) {
    requireValid(output === readFileSync(outputPath, 'utf8'), '生成结果与现有课包不一致，请重新生成。');
  } else {
    writeFileSync(outputPath, output);
  }
  for (const course of courses) {
    const count = course.stages.reduce((sum, stage) => sum + stage.entries.length, 0);
    process.stdout.write(`${course.title} · ${course.stages.length} 关 · ${count} 词\n`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { main(process.argv.slice(2)); } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
