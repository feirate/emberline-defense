import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as study from './study.mjs';

const { unitPacks } = JSON.parse(readFileSync(new URL('./kb3-word-packs.json', import.meta.url), 'utf8'));

function questionFor(packId, en, kind) {
  const pack = unitPacks.find(candidate => candidate.id === packId);
  const session = study.createStudySession(0, 0, { packId, entries: pack.entries });
  const index = session.words.findIndex(word => word.en === en);
  return study.createQuestion(session, index, kind);
}

test('英语跟读检查完整词语，接受语音转写的常见拼法', () => {
  const bank = questionFor('kb3-u4', 'bank', 'arc');
  assert.equal(study.checkReadingAnswer(bank, ' ＢＡＮＫ。 '), true);
  for (const answer of ['', '   ', 'ank', 'b a n k', 'not bank', 'bank or market']) {
    assert.equal(study.checkReadingAnswer(bank, answer), false, answer);
  }

  const sportsCentre = questionFor('kb3-u4', 'sports centre', 'arc');
  assert.equal(study.checkReadingAnswer(sportsCentre, 'Sports center.'), true);
  assert.equal(study.checkReadingAnswer(sportsCentre, 'Sports.'), false);
  const stomachAche = questionFor('kb3-u5', 'stomach-ache', 'arc');
  assert.equal(study.checkReadingAnswer(stomachAche, 'stomach ache'), true);
});

test('中文跟读接受教材内其他译法和常用译法，拒绝无关声音对应的文字', () => {
  const pool = questionFor('kb3-u4', 'swimming pool', 'armor');
  assert.equal(study.checkReadingAnswer(pool, '游泳池。'), true);
  assert.equal(study.checkReadingAnswer(pool, '「泳 池」'), true);
  assert.equal(study.checkReadingAnswer(pool, '图书馆'), false);
  assert.equal(study.checkReadingAnswer(pool, '我会读游泳池'), false);
  assert.equal(study.checkReadingAnswer(pool, '泳池或图书馆'), false);
  assert.equal(study.checkReadingAnswer(pool, undefined), false);

  const putOn = questionFor('kb3-u3', 'put on', 'armor');
  assert.equal(study.checkReadingAnswer(putOn, '戴上'), true);
});

test('英语跟读改为填写时用现有单词的拼写空格和判词规则', () => {
  const reading = questionFor('kb3-u4', 'cinema', 'arc');
  const original = JSON.stringify(reading);
  const fallback = study.readingFallbackQuestion(reading);
  const regularSpelling = questionFor('kb3-u4', 'cinema', 'rapid');

  assert.equal(fallback.id, reading.id);
  assert.equal(fallback.targetId, reading.targetId);
  assert.equal(fallback.audio, reading.audio);
  assert.equal(fallback.mode, 'spell');
  assert.deepEqual(fallback.options, []);
  for (const field of ['stem', 'prefix', 'suffix', 'blankCount', 'answers', 'hint']) {
    assert.deepEqual(fallback[field], regularSpelling[field]);
  }
  assert.deepEqual(study.spellingSlots(fallback, 'n'), ['n', '']);
  assert.equal(study.checkAnswer(fallback, ''), false);
  assert.equal(study.checkAnswer(fallback, 'ne'), true);
  assert.equal(study.checkAnswer(fallback, 'cinema'), true);
  assert.equal(study.checkAnswer(fallback, 'no'), false);
  assert.equal(study.checkReadingAnswer(reading, 'ne'), false);
  assert.equal(JSON.stringify(reading), original);
});

test('中文跟读改为填写时保留英文题干及译法，无须复用选择题选项', () => {
  const reading = questionFor('kb3-u3', 'put on', 'armor');
  const fallback = study.readingFallbackQuestion(reading);

  assert.equal(fallback.mode, 'translate');
  assert.equal(fallback.id, reading.id);
  assert.equal(fallback.en, 'put on');
  assert.deepEqual(fallback.options, []);
  assert.equal(study.checkAnswer(fallback, '戴上'), true);
  assert.equal(study.checkAnswer(fallback, 'put on'), false);
  assert.equal(study.checkAnswer(fallback, ''), false);
  assert.equal(study.readingFallbackQuestion(fallback), null);
});
