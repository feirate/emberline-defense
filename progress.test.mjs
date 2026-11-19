import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as progress from './progress.mjs';
import {
  createProgressStore, recordResult, recordStudy, STORAGE_KEY,
} from './progress.mjs';

function makeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function sampleRun(id = 'test-run') {
  return {
    id,
    battle: { wave: 23, armor: 2, stars: 11, phase: 'upgrade' },
    lesson: { packId: 'kb3-u4', optionOffset: 2 },
    desk: { attempts: [{ id: 'question', left: 23.5, repeat: true }] },
  };
}

test('map word credit and paused routes survive retries and leave the endurance checkpoint independent', () => {
  const storage = makeStorage();
  const store = createProgressStore(storage);
  const first = store.create('地图测试');
  store.update(first.id, profile => {
    profile.run = sampleRun();
    progress.setActiveMapStage(profile, 'kb3-city-patrol');
    progress.saveMapStage(profile, 'kb3-city-patrol', { wordIds: ['bank', 'bank'], run: sampleRun('map-run-a') });
    progress.saveMapStage(profile, 'kb3-city-patrol', { wordIds: ['bank', 'market'], run: null, won: true });
    progress.setActiveMapStage(profile, 'yle-animals-patrol');
    progress.saveMapStage(profile, 'yle-animals-patrol', { wordIds: ['cat'], run: sampleRun('map-run-b') });
  });
  const saved = createProgressStore(storage).read().profiles[0];
  assert.equal(saved.map.activeStageId, 'yle-animals-patrol');
  assert.deepEqual(progress.mapStageProgress(saved, 'kb3-city-patrol'), { wordIds: ['bank', 'market'], won: true, run: null });
  assert.deepEqual(progress.mapStageProgress(saved, 'yle-animals-patrol'), { wordIds: ['cat'], won: false, run: sampleRun('map-run-b') });
  assert.deepEqual(saved.run, sampleRun());
  assert.deepEqual(store.importProfile(store.exportProfile(first.id)).map, saved.map);
});

test('profiles survive a reload and isolate names, settings, results and an interrupted run', () => {
  const storage = makeStorage();
  const firstView = createProgressStore(storage);
  assert.deepEqual(firstView.read().profiles, []);
  const pilot = firstView.create('  小明  ');
  const sibling = firstView.create('小雨');
  const updated = firstView.update(pilot.id, profile => {
    profile.muted = true;
    profile.packId = 'kb3-u3';
    profile.run = sampleRun();
    recordStudy(profile, { targetId: 'kb3-u3-milk', mode: 'spell', status: 'correct', at: 10 });
  });
  firstView.rename(pilot.id, '列车长');
  const nextView = createProgressStore(storage);
  assert.equal(nextView.read().activeId, sibling.id);
  const resumed = nextView.select(pilot.id);
  assert.equal(resumed.name, '列车长');
  assert.equal(resumed.id, pilot.id);
  assert.equal(resumed.packId, 'kb3-u3');
  assert.deepEqual(resumed.run, updated.run);
  assert.deepEqual(resumed.study, updated.study);
  assert.equal(resumed.muted, true);
  assert.equal(nextView.select(sibling.id).run, null);
  assert.deepEqual(nextView.select(sibling.id).study, {});
});

test('rejects duplicate names, a fourth profile, and stale writes from a second page', () => {
  const storage = makeStorage();
  const a = createProgressStore(storage);
  const b = createProgressStore(storage);
  const name = a.create('Captain');
  assert.throws(() => a.create('ＣＡＰＴＡＩＮ'), /同名/);
  b.update(name.id, saved => { saved.packId = 'kb3-u2'; });
  assert.throws(() => a.update(name.id, saved => {
    saved.packId = 'kb3-u8';
  }, { expectedRevision: name.revision }), /另一/);
  const beforeRace = a.select(name.id);
  assert.equal(beforeRace.packId, 'kb3-u2');
  assert.throws(() => a.update(name.id, saved => {
    b.update(name.id, winner => { winner.packId = 'kb3-u4'; });
    saved.packId = 'kb3-u8';
  }, { expectedRevision: beforeRace.revision }), /另一/);
  assert.equal(a.select(name.id).packId, 'kb3-u4');
  a.create('小陈');
  a.create('小孙');
  assert.throws(() => a.create('小柳'), /3/);
});

test('tracks wrong, timed out, assisted and spoken practice separately and settles each run once', () => {
  const store = createProgressStore(makeStorage());
  const pilot = store.create('测试');
  const saved = store.update(pilot.id, profile => {
    for (const status of ['wrong', 'timeout', 'assisted', 'read']) {
      recordStudy(profile, { targetId: 'kb3-u4-bank', mode: 'repeat-en', status, at: 1 });
    }
    profile.run = sampleRun('run-1');
    assert.equal(recordResult(profile, { runId: 'run-1', won: false, wave: 24 }), true);
    assert.equal(recordResult(profile, { runId: 'run-1', won: false, wave: 24 }), false);
    profile.run = sampleRun('run-2');
    assert.equal(recordResult(profile, { runId: 'run-1', won: true, wave: 100 }), false);
    assert.equal(recordResult(profile, { runId: 'run-2', won: true, wave: 100 }), true);
  });
  assert.deepEqual(saved.study['kb3-u4-bank']['repeat-en'], {
    attempts: 3, correct: 1, assisted: 1, wrong: 1, timeouts: 1, read: 1, last: 1,
  });
  assert.deepEqual(saved.campaign, {
    bestWave: 100, wins: 1, losses: 1, lastResult: { runId: 'run-2', won: true, wave: 100 },
  });
  assert.equal(saved.run, null);
});

test('a backup can become a separate profile or replace one with an undo snapshot', () => {
  const store = createProgressStore(makeStorage());
  const pilot = store.create('小一');
  store.update(pilot.id, entry => { entry.run = sampleRun(); });
  const backup = store.exportProfile(pilot.id);
  const preview = store.previewImport(backup);
  assert.equal(preview.name, '小一');
  assert.equal(preview.packId, 'kb3-u4');
  assert.equal(preview.bestWave, 0);
  assert.equal(preview.hasRun, true);
  assert.equal(store.read().profiles.length, 1);
  const imported = store.importProfile(backup);
  assert.notEqual(imported.id, pilot.id);
  assert.notEqual(imported.name, pilot.name);
  assert.deepEqual(imported.run, sampleRun());
  const target = store.create('小二');
  const changed = store.importProfile(backup, { replaceId: target.id });
  assert.equal(changed.name, '小二');
  assert.deepEqual(changed.run, sampleRun());
  assert.equal(store.restoreBackup(target.id).run, null);
});

test('three full KB3 and Starters profiles keep all four skills, checkpoints, and undo backups within the storage cap', () => {
  const storage = makeStorage();
  const store = createProgressStore(storage);
  const wordIds = [
    ...Array.from({ length: 473 }, (_, index) => `kb3-wl-${index + 1}`),
    ...Array.from({ length: 343 }, (_, index) => `yle-starters-word-${index + 1}`),
  ];
  const profiles = ['一号车长', '二号车长', '三号车长'].map(name => store.create(name));
  for (const { id } of profiles) {
    store.update(id, profile => {
      for (const targetId of wordIds) {
        for (const mode of ['spell', 'repeat-en', 'translate', 'repeat-zh']) {
          for (const status of ['correct', 'wrong', 'assisted', 'timeout', 'read']) {
            recordStudy(profile, { targetId, mode, status, at: 1_794_792_333_444 });
          }
        }
      }
      for (let index = 0; index < wordIds.length; index += 20) {
        const stageId = `stage-${index / 20 + 1}`;
        progress.saveMapStage(profile, stageId, { wordIds: wordIds.slice(index, index + 20), run: null, won: true });
      }
      profile.run = sampleRun();
      progress.setActiveMapStage(profile, 'special-stage');
      progress.saveMapStage(profile, 'special-stage', { wordIds: wordIds.slice(0, 4), run: sampleRun('map-run') });
    });
  }
  const before = store.read();
  for (const { id } of profiles) {
    const exported = store.exportProfile(id);
    assert.ok(Buffer.byteLength(exported) <= 1_000_000, 'the export fits the file picker limit');
    assert.equal(store.previewImport(exported).words, 816);
    store.importProfile(exported, { replaceId: id });
  }
  const after = createProgressStore(storage).read();
  assert.equal(after.profiles.length, 3);
  assert.equal(Object.keys(after.backups).length, 3);
  for (const profile of after.profiles) {
    const original = before.profiles.find(item => item.id === profile.id);
    assert.deepEqual(profile.study, original.study);
    assert.deepEqual(profile.map, original.map);
    assert.deepEqual(profile.run, original.run);
    assert.deepEqual(after.backups[profile.id], original);
  }
  assert.ok(storage.getItem(STORAGE_KEY).length <= 1_000_000);
  assert.deepEqual(store.restoreBackup(profiles[0].id).study, before.profiles[0].study);
});

test('a version 1 local registry is readable and packs on the next save without changing its profile data', () => {
  const storage = makeStorage();
  const store = createProgressStore(storage);
  const { id } = store.create('原档案');
  store.update(id, profile => {
    recordStudy(profile, { targetId: 'kb3-u4-bank', mode: 'repeat-zh', status: 'assisted', at: 1_794_792_333_444 });
    profile.study['kb3-u4-bank']['repeat-zh'].extra = '历史注记';
    profile.run = sampleRun();
    progress.saveMapStage(profile, 'original-stage', { wordIds: ['bank'], run: sampleRun('original-map') });
  });
  store.importProfile(store.exportProfile(id), { replaceId: id });
  const legacy = store.read();
  assert.equal(legacy.version, 1);
  const original = JSON.stringify(legacy);
  storage.setItem(STORAGE_KEY, original);
  const upgraded = createProgressStore(storage);
  assert.deepEqual(upgraded.read(), legacy);
  assert.equal(storage.getItem(STORAGE_KEY), original);
  upgraded.rename(id, '新档案');
  const result = upgraded.read();
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 2);
  assert.deepEqual(result.backups, legacy.backups);
  assert.deepEqual(result.profiles[0], { ...legacy.profiles[0], name: '新档案', revision: legacy.profiles[0].revision + 1 });
});

test('a profile whose expanded backup would exceed the importer limit exports portable compact JSON', () => {
  const store = createProgressStore(makeStorage());
  const { id } = store.create('全课程');
  const saved = store.update(id, profile => {
    for (let index = 0; index < 1_600; index++) {
      for (const mode of ['spell', 'repeat-en', 'translate', 'repeat-zh']) {
        recordStudy(profile, { targetId: `word-${index}`, mode, status: 'correct', at: 1_794_792_333_444 });
      }
    }
  });
  const backup = store.exportProfile(id);
  assert.equal(JSON.parse(backup).version, 2);
  assert.ok(Buffer.byteLength(backup) <= 1_000_000);
  assert.equal(store.previewImport(backup).words, 1_600);
  const loaded = store.importProfile(backup, { replaceId: id });
  assert.deepEqual(loaded.study, saved.study);
});

test('a retried answer event does not double-count a learning outcome', () => {
  const store = createProgressStore(makeStorage());
  const pilot = store.create('测试');
  const event = { targetId: 'kb3-u4-bank', mode: 'spell', status: 'correct', eventId: 'run-1:answer-1' };
  store.update(pilot.id, profile => recordStudy(profile, event));
  const result = store.update(pilot.id, profile => recordStudy(profile, event));
  assert.equal(result.study['kb3-u4-bank'].spell.correct, 1);
});

test('corrupt data and failed writes leave old saves untouched', () => {
  const storage = makeStorage();
  const store = createProgressStore(storage);
  const pilot = store.create('测试');
  const original = storage.getItem(STORAGE_KEY);
  assert.throws(() => store.importProfile('{"app":"word-island"}'), /备份/);
  assert.equal(storage.getItem(STORAGE_KEY), original);
  const quota = createProgressStore({
    getItem: storage.getItem,
    setItem() { throw new Error('quota exceeded'); },
  });
  assert.throws(() => quota.rename(pilot.id, '新名字'), /无法保存/);
  assert.equal(storage.getItem(STORAGE_KEY), original);

  storage.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => store.create('小明'), /损坏/);
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});

test('delete removes only the target and its recovery backup', () => {
  const store = createProgressStore(makeStorage());
  const pilot = store.create('小一');
  const sibling = store.create('小二');
  store.importProfile(store.exportProfile(sibling.id), { replaceId: pilot.id });
  assert.ok(store.read().backups[pilot.id]);
  assert.equal(store.deleteProfile(pilot.id), true);
  assert.equal(store.deleteProfile(pilot.id), false);
  assert.ok(!store.read().backups[pilot.id]);
  assert.deepEqual(store.read().profiles.map(entry => entry.id), [sibling.id]);
  assert.equal(store.read().activeId, sibling.id);
});
