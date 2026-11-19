import { readFileSync } from 'node:fs';
import test from 'node:test';
import { strict as assert } from 'node:assert';
import { createBattle, minimumUpgradePerKind, requiredUpgradeCount } from './battle.mjs';
import { buildCourses } from './course-map.mjs';
import { checkAnswer, createQuestion, createStudySession, restoreStudySession,
  serializeStudySession, STUDY_MODES } from './study.mjs';

const { unitPacks } = JSON.parse(readFileSync(new URL('./kb3-word-packs.json', import.meta.url)));

test('the formal KB3 route serves twenty different words and audited audio at each of two stations', () => {
  const course = buildCourses(unitPacks).find(item => item.id === 'kb3-emberline-v1');
  assert.ok(course, 'formal course is available alongside the two preview courses');
  assert.equal(course.title, 'KB3 · 余火主线');
  assert.equal(course.station, '联络货站');
  assert.deepEqual(course.stages.map(({ id, levelId }) => [id, levelId]), [
    ['kb3-emberline-yard-v1', 'formal-yard-v1'], ['kb3-emberline-bridge-v1', 'formal-bridge-v1'],
  ]);
  const entries = course.stages.flatMap(stage => stage.entries);
  assert.equal(new Set(entries.map(entry => entry.id)).size, 40);
  assert.equal(new Set(entries.map(entry => entry.en)).size, 40);
  for (const stage of course.stages) {
    assert.equal(stage.entries.length, 20);
    const battle = createBattle(0, stage.levelId);
    assert.equal(requiredUpgradeCount(battle), stage.entries.length);
    assert.equal(minimumUpgradePerKind(battle) * Object.keys(STUDY_MODES).length, stage.entries.length);
    assert.equal(stage.packId, stage.id);
    assert.ok(stage.story.opening);
    assert.ok(stage.story.victory);
    const session = createStudySession(0, 0, stage);
    assert.deepEqual(restoreStudySession(serializeStudySession(session), stage.entries), session);
    for (const kind of Object.keys(STUDY_MODES)) {
      assert.deepEqual(stage.entries.map(({ id, audio }, index) => {
        const question = createQuestion(session, index, kind);
        assert.equal(question.audio, audio);
        assert.match(audio, /^\.\/assets\/study\/[a-z0-9-]+\.m4a$/);
        assert.ok(checkAnswer(question, question.answers[0]));
        assert.ok(!checkAnswer(question, ''));
        return question.targetId;
      }), stage.entries.map(entry => entry.id));
    }
    for (const entry of stage.entries) {
      const source = unitPacks.find(unit => unit.id === entry.source.unitId);
      const original = source.entries.find(word => word.id === entry.id);
      assert.equal(entry.en, original.en);
      assert.equal(entry.zhHint, original.zhHint);
      assert.equal(entry.source.printedPage, original.printedPage);
      assert.equal(entry.source.pdfPage, original.pdfPage);
    }
  }
});

test('course maps split two eight-word packs into ordered, distinct outings', () => {
  const courses = buildCourses(unitPacks).filter(course => course.id !== 'kb3-emberline-v1');
  assert.deepEqual(courses.map(course => course.id), ['kb3-city', 'yle-starters-animals']);
  for (const course of courses) {
    assert.deepEqual(course.stages.map(stage => stage.id), [`${course.id}-1`, `${course.id}-2`]);
    assert.deepEqual(course.stages.map(stage => stage.levelId), ['map-patrol', 'map-boss']);
    assert.deepEqual(course.stages.map(stage => stage.entries.length), [4, 4]);
    assert.equal(new Set(course.stages.flatMap(stage => stage.entries.map(entry => entry.id))).size, 8);
  }
  const expected = unitPacks.find(pack => pack.id === 'kb3-u4').entries;
  const assigned = courses[0].stages.flatMap(stage => stage.entries);
  assert.deepEqual(new Set(assigned), new Set(expected));
  assert.deepEqual(courses[1].stages.flatMap(stage => stage.entries.map(entry => entry.en)),
    ['cat', 'dog', 'duck', 'fish', 'horse', 'frog', 'tiger', 'zebra']);

  for (const course of buildCourses().filter(course => course.id !== 'kb3-emberline-v1')) {
    for (const stage of course.stages) {
      const sourced = courses.find(candidate => candidate.id === course.id).stages.find(candidate => candidate.id === stage.id);
      const full = createStudySession(0, 0, sourced);
      const fallback = createStudySession(0, 0, stage);
      for (const kind of Object.keys(STUDY_MODES)) {
        assert.deepEqual(stage.entries.map((_, index) => createQuestion(fallback, index, kind)),
          sourced.entries.map((_, index) => createQuestion(full, index, kind)));
      }
    }
  }
});

test('each map outing serves valid questions, local audio and exact session restore', () => {
  for (const course of buildCourses(unitPacks)) {
    for (const { packId, entries } of course.stages) {
      const session = createStudySession(0, 0, { packId, entries, priorityWordIds: [entries[3].id] });
      const snapshot = JSON.parse(JSON.stringify(serializeStudySession(session)));
      assert.equal(snapshot.packId, packId);
      assert.equal(snapshot.wordIds[0], entries[3].id);
      assert.deepEqual(restoreStudySession(snapshot, entries), session);
      assert.equal(restoreStudySession(snapshot, entries.slice(1)), null);
      assert.equal(restoreStudySession(snapshot), null);
      for (const kind of Object.keys(STUDY_MODES)) {
        const questions = entries.map((_, index) => createQuestion(session, index, kind));
        assert.deepEqual(new Set(questions.map(question => question.targetId)), new Set(entries.map(entry => entry.id)));
        for (const question of questions) {
          assert.equal(checkAnswer(question, question.answers[0]), true);
          assert.equal(checkAnswer(question, ''), false);
          if (question.options.length) {
            assert.equal(new Set(question.options).size, 3);
            assert.equal(question.options.filter(option => checkAnswer(question, option)).length, 1);
          }
          const clip = readFileSync(new URL(question.audio, import.meta.url));
          assert.ok(clip.length > 2048, question.audio);
          assert.equal(clip.toString('ascii', 4, 8), 'ftyp');
        }
      }
    }
  }
});
