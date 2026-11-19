import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildManifest, parseCsvCatalog, renderModule } from './tools/generate-courses.mjs';

const json = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const catalog = json('./kb3-word-packs.json');
const plan = json('./data/formal-course-plan.json');

test('the offline generator matches the runtime module and ignores input catalog order', () => {
  const expected = readFileSync(new URL('./data/formal-courses.generated.mjs', import.meta.url), 'utf8');
  const shuffled = { ...catalog, unitPacks: [...catalog.unitPacks].reverse() };
  const manifest = renderModule(buildManifest(catalog, plan));
  assert.equal(manifest, renderModule(buildManifest(shuffled, plan)));
  assert.equal(manifest, expected);
});

test('the generator rejects incomplete, duplicate and unsafe course content', () => {
  const mutatePlan = change => {
    const copy = structuredClone(plan);
    change(copy.courses[0].stages);
    return copy;
  };
  assert.throws(() => buildManifest(catalog, mutatePlan(stages => stages[0].wordIds.pop())), /20/);
  assert.throws(() => buildManifest(catalog, mutatePlan(stages => { stages[1].wordIds[0] = 'kb3-u4-bank'; })), /重复/);
  assert.throws(() => buildManifest(catalog, mutatePlan(stages => { stages[1].wordIds[0] = 'kb3-missing'; })), /缺少/);
  assert.throws(() => buildManifest(catalog, mutatePlan(stages => { stages[1].id = stages[0].id; })), /重复/);
  const asset = buildManifest(catalog, plan)[0].stages[0].entries[0];
  const singleWord = mutatePlan(stages => {
    stages.splice(1);
    stages[0].wordCount = 1;
    stages[0].wordIds = [asset.id];
  });
  assert.throws(() => buildManifest([{ ...asset, audio: './assets/study/../bank.m4a' }], singleWord), /音频路径/);
  assert.throws(() => buildManifest([{ ...asset, audio: './assets/study/unused-word.m4a' }], singleWord), /音频文件/);
});

test('CSV supports quoted Chinese glosses, BOM and Windows line endings', () => {
  const text = '\ufeffid,en,zhHint,audio,book,unitId,chapter,printedPage,pdfPage\r\n' +
    'kb3-u4-bank,bank,"在街上,可以取钱的地方",./assets/study/bank.m4a,KB3,kb3-u4,"In the ""city""",34,41\r\n';
  const [row] = parseCsvCatalog(text);
  assert.equal(row.zhHint, '在街上,可以取钱的地方');
  assert.deepEqual(row.source, { book: 'KB3', unitId: 'kb3-u4', chapter: 'In the "city"', printedPage: 34, pdfPage: 41 });
  assert.throws(() => parseCsvCatalog(text + 'bad,row'), /列/);
});
