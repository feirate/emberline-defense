import { strict as assert } from 'node:assert';
import test from 'node:test';
import * as engine from './battle.mjs';

const {
  TRACK_POINTS, cancelUpgrade, confirmUpgrade, createBattle, openUpgrade, startBattle, stepBattle,
} = engine;

const frame = 1 / 60;

function runUntil(battle, condition, seconds = 130) {
  for (let step = 0; step < seconds / frame && !condition(battle); step++) {
    stepBattle(battle, frame);
  }
  assert.ok(condition(battle), `not reached at ${battle.elapsed.toFixed(2)} s in wave ${battle.wave}`);
}

function begin(seed) {
  const battle = createBattle(seed);
  assert.equal(startBattle(battle), true);
  return battle;
}

const canUpgrade = battle => battle.phase === 'running' && battle.cost !== null && battle.stars >= battle.cost;
const over = battle => ['won', 'lost'].includes(battle.phase);

function installChoices(battle, choices, choiceDelay = 0) {
  for (const kind of choices) {
    runUntil(battle, canUpgrade);
    const chooseAt = battle.elapsed + choiceDelay;
    runUntil(battle, state => state.elapsed + 1e-6 >= chooseAt || over(state));
    assert.equal(openUpgrade(battle, kind), true);
    assert.equal(confirmUpgrade(battle), true);
  }
}

const rounds = ['rapid', 'arc', 'shock', 'armor'];
const formalChoices = Array.from({ length: 20 }, (_, index) => rounds[index % rounds.length]);

test('formal routes require a twenty-word run, with five paid upgrades per carriage', () => {
  for (const levelId of ['formal-yard-v1', 'formal-bridge-v1']) {
    for (const order of [rounds, ['shock', 'rapid', 'armor', 'arc']]) {
      const choices = Array.from({ length: 20 }, (_, index) => order[index % order.length]);
      for (const delay of [0, 5, 10]) {
        const battle = createBattle(42, levelId);
        assert.equal(engine.requiredUpgradeCount(battle), 20);
        assert.equal(engine.minimumUpgradePerKind(battle), 5);
        assert.ok(rounds.every(kind => engine.upgradeLimit(battle, kind) === 5));
        startBattle(battle);
        installChoices(battle, choices, delay);
        assert.deepEqual(battle.upgrades, { rapid: 5, arc: 5, shock: 5, armor: 5 });
        assert.equal(battle.cost, null);
        assert.equal(openUpgrade(battle, 'rapid'), false);
        const resumed = engine.restoreBattle(JSON.parse(JSON.stringify(engine.serializeBattle(battle))));
        assert.deepEqual(resumed, { ...battle, events: [] });
        runUntil(resumed, over, 120);
        assert.equal(resumed.phase, 'won', `${levelId}: ${order.join(', ')} with ${delay}s delay`);
        assert.equal(resumed.stars, 20);
        assert.equal(resumed.stars + resumed.upgradeCount * 4, 100);
      }
    }
  }
});

test('formal routes fail at nineteen upgrades even with armor left, and only the bridge has a boss shield', () => {
  const yard = createBattle(42, 'formal-yard-v1');
  const bridge = createBattle(42, 'formal-bridge-v1');
  assert.notDeepEqual(engine.battleArena(yard).points, engine.battleArena(bridge).points);
  for (const [battle, expectedReason] of [[yard, 'mission-preparation'], [bridge, 'boss-preparation']]) {
    startBattle(battle);
    installChoices(battle, formalChoices.slice(0, -1));
    runUntil(battle, state => state.wave === state.waveCount, 120);
    assert.ok(battle.armor > 0);
    if (battle === bridge) {
      stepBattle(battle, frame);
      assert.ok(engine.bossPrepRemaining(battle) > 12);
      const boss = battle.enemies.find(enemy => enemy.kind === 'boss');
      assert.equal(boss.hp, boss.maxHp);
    }
    const resumed = engine.restoreBattle(engine.serializeBattle(battle));
    runUntil(resumed, over, 120);
    assert.equal(resumed.phase, 'lost');
    assert.equal(resumed.lossReason, expectedReason);
  }
});

test('course patrol offers four-word upgrades and one optional upgrade within exactly twenty stars', () => {
  const battle = createBattle(23, 'map-patrol');
  assert.equal(battle.levelId, 'map-patrol');
  assert.equal(battle.waveCount, 5);
  assert.equal(startBattle(battle), true);
  installChoices(battle, ['rapid', 'arc', 'shock', 'armor', 'rapid']);
  assert.equal(battle.stars, 0);
  runUntil(battle, over, 200);
  assert.equal(battle.phase, 'won');
  assert.equal(battle.wave, 5);
  assert.equal(battle.stars, 0);
});

test('missing the boss star requirement fails after a visible preparation window', () => {
  const battle = createBattle(28, 'map-boss');
  assert.equal(startBattle(battle), true);
  installChoices(battle, ['rapid', 'arc', 'shock']);
  runUntil(battle, state => state.wave === 5 && state.enemies.some(enemy => enemy.kind === 'boss'), 140);
  assert.ok(engine.bossPrepRemaining(battle) > 12);
  assert.equal(battle.stars, 8);
  const boss = battle.enemies.find(enemy => enemy.kind === 'boss');
  for (let step = 0; step < 8 / frame; step++) stepBattle(battle, frame);
  assert.equal(battle.phase, 'running');
  assert.equal(boss.hp, boss.maxHp);
  runUntil(battle, over, 14);
  assert.equal(battle.phase, 'lost');
  assert.equal(battle.lossReason, 'boss-preparation');
  assert.deepEqual(battle.events.slice(-2).map(event => event.type), ['boss-prep-fail', 'lose']);
});

test('the boss shield drops after the fourth upgrade and checkpoint replay preserves the battle', () => {
  for (const choices of [['rapid', 'arc', 'shock', 'armor'], ['shock', 'rapid', 'arc', 'rapid']]) {
    const battle = createBattle(42, 'map-boss');
    assert.equal(startBattle(battle), true);
    installChoices(battle, choices.slice(0, 3));
    runUntil(battle, state => state.wave === 5 && state.waveTime > 8, 140);
    assert.equal(openUpgrade(battle, choices[3]), true);
    const checkpoint = engine.serializeBattle(battle);
    const resumed = engine.restoreBattle(JSON.parse(JSON.stringify(checkpoint)));
    assert.deepEqual(resumed, { ...battle, events: [] });
    stepBattle(resumed, 10);
    assert.equal(resumed.waveTime, battle.waveTime);
    assert.equal(confirmUpgrade(resumed), true);
    assert.equal(resumed.stars, 4);
    runUntil(resumed, state => state.events.some(event => event.type === 'boss-start'), 15);
    assert.equal(resumed.phase, 'running');
    assert.ok(resumed.enemies.some(enemy => enemy.kind === 'boss'));
    const fightCheckpoint = engine.serializeBattle(resumed);
    assert.throws(() => engine.restoreBattle({ ...fightCheckpoint, enemies: [] }), RangeError);
    const duringFight = engine.restoreBattle(fightCheckpoint);
    resumed.events.length = 0;
    runUntil(resumed, over, 55);
    runUntil(duringFight, over, 55);
    assert.deepEqual(duringFight, resumed);
    assert.equal(resumed.phase, 'won', choices.join(', '));
    assert.equal(resumed.stars, 4);
  }
});

test('wave two introduces a pair of hounds that crouch before rushing', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(openUpgrade(battle, 'rapid'), true);
  assert.equal(confirmUpgrade(battle), true);
  runUntil(battle, state => state.wave === 2);
  runUntil(battle, state => state.enemies.filter(enemy => enemy.kind === 'hound').length === 2, 4);
  const hound = battle.enemies.find(enemy => enemy.kind === 'hound');
  assert.equal(engine.houndPhase(hound), 'windup');
  const x = hound.x;
  stepBattle(battle, frame);
  assert.equal(hound.x, x);
  runUntil(battle, () => engine.houndPhase(hound) === 'rush', 1);
  const before = [hound.x, hound.y];
  stepBattle(battle, frame);
  assert.ok(Math.hypot(hound.x - before[0], hound.y - before[1]) > 100 * frame);
  assert.deepEqual(engine.restoreBattle(engine.serializeBattle(battle)), { ...battle, events: [] });
});

test('wave three introduces a chimera whose defeat leaves two saveable crawlers', () => {
  const battle = begin();
  for (const kind of ['rapid', 'arc', 'shock']) {
    runUntil(battle, canUpgrade);
    assert.equal(openUpgrade(battle, kind), true);
    assert.equal(confirmUpgrade(battle), true);
  }
  runUntil(battle, state => state.wave === 3);
  runUntil(battle, state => state.enemies.some(enemy => enemy.kind === 'chimera'), 8);
  const chimera = battle.enemies.find(enemy => enemy.kind === 'chimera');
  assert.ok(chimera.x >= 30, 'the introductory chimera enters far enough for its silhouette to be visible');
  const visibleSince = battle.waveTime;
  runUntil(battle, state => state.events.some(event => event.type === 'split'), 15);
  assert.ok(battle.waveTime - visibleSince >= 1, 'the player has time to see the chimera before it splits');
  const crawlers = battle.enemies.filter(enemy => enemy.kind === 'crawler');
  assert.equal(crawlers.length, 2);
  assert.notEqual(crawlers[0].id, crawlers[1].id);
  assert.notEqual(crawlers[0].y, crawlers[1].y);
  assert.ok(crawlers.every(enemy => enemy.hp === 1));
  const checkpoint = JSON.parse(JSON.stringify(engine.serializeBattle(battle)));
  const resumed = engine.restoreBattle(checkpoint);
  assert.deepEqual(resumed, { ...battle, events: [] });
  checkpoint.enemies.find(enemy => enemy.kind === 'crawler').id = -1;
  assert.throws(() => engine.restoreBattle(checkpoint), RangeError);
  battle.events.length = 0;
  stepBattle(battle, frame);
  stepBattle(resumed, frame);
  assert.deepEqual(resumed, battle);
});

test('a chimera that reaches the shelter damages armor without splitting', () => {
  const battle = begin();
  battle.enemies.push({
    id: 1, kind: 'chimera', x: engine.CENTER.x - 37, y: engine.CENTER.y,
    hp: 7, maxHp: 7, hitFlash: 0, chillTime: 0,
  });
  stepBattle(battle, frame);
  assert.equal(battle.armor, 2);
  assert.deepEqual(battle.enemies, []);
  assert.equal(battle.events.some(event => event.type === 'split'), false);
});

test('an active version 2 enemy in a replaced slot can resume without being replaced', () => {
  const battle = begin();
  runUntil(battle, state => state.enemies.filter(enemy => enemy.kind === 'hound').length === 1);
  const checkpoint = engine.serializeBattle(battle);
  checkpoint.version = 2;
  const formerRunner = checkpoint.enemies.find(enemy => enemy.kind === 'hound');
  formerRunner.kind = 'runner';
  delete formerRunner.chargeTime;
  const resumed = engine.restoreBattle(checkpoint);
  assert.deepEqual(resumed.enemies.find(enemy => enemy.id === formerRunner.id), formerRunner);
  const savedAgain = engine.serializeBattle(resumed);
  assert.equal(savedAgain.version, 4);
  assert.equal(savedAgain.seed, null);
  assert.deepEqual(engine.restoreBattle(savedAgain), resumed);
  runUntil(resumed, state => state.enemies.some(enemy => enemy.kind === 'hound'), 1);
  assert.ok(resumed.enemies.some(enemy => enemy.kind === 'runner' && enemy.id === formerRunner.id));
});

test('the train follows a closed track with straight sections and a slower constant speed', () => {
  assert.ok(TRACK_POINTS?.length >= 10);
  const battle = begin();
  const [firstX, firstY] = TRACK_POINTS[0];
  assert.deepEqual([battle.train.x, battle.train.y], [firstX, firstY]);
  const [nextX, nextY] = TRACK_POINTS[1];
  runUntil(battle, state => state.elapsed >= 0.2);
  const { x, y, angle } = battle.train;
  const speed = Math.hypot(x - firstX, y - firstY) / battle.elapsed;
  assert.ok(speed >= 78 && speed <= 84);
  assert.ok(Math.abs(angle - Math.atan2(nextY - firstY, nextX - firstX)) < 0.001);
  runUntil(battle, state => state.elapsed >= 1);
  assert.equal(battle.train.y, nextY);
  assert.ok(battle.train.x > nextX);
  assert.equal(battle.train.angle, 0);
});

test('the first stars enable a choice during an active wave without interrupting it', () => {
  const battle = createBattle();
  stepBattle(battle, frame);
  assert.equal(battle.elapsed, 0);
  assert.equal(openUpgrade(battle, 'rapid'), false);
  assert.equal(startBattle(battle), true);
  assert.equal(openUpgrade(battle, 'arc'), false);
  runUntil(battle, canUpgrade, 25);
  assert.equal(battle.wave, 1);
  assert.equal(battle.cost, 4);
  assert.ok(battle.elapsed >= 12 && battle.elapsed <= 20);
  assert.equal(battle.phase, 'running');
  assert.ok(battle.enemies.length > 0);
  assert.equal(battle.events.filter(event => event.type === 'ready').length, 1);
});

test('the upgrade panel freezes combat and only a confirmed upgrade spends stars', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(openUpgrade(battle, 'not-a-card'), false);
  assert.equal(openUpgrade(battle, 'rapid'), true);
  const frozen = structuredClone(battle);
  stepBattle(battle, frame);
  assert.deepEqual(battle, frozen);
  assert.equal(openUpgrade(battle, 'arc'), false);
  assert.equal(cancelUpgrade(battle), true);
  assert.equal(battle.stars, frozen.stars);
  assert.equal(battle.cars.length, 0);
  assert.equal(openUpgrade(battle, 'arc'), true);
  assert.equal(confirmUpgrade(battle), true);
  assert.equal(confirmUpgrade(battle), false);
  assert.equal(battle.elapsed, frozen.elapsed);
  assert.equal(battle.wave, frozen.wave);
  assert.equal(battle.stars, frozen.stars - 4);
  assert.equal(battle.cost, 6);
  assert.equal(battle.upgradeCount, 1);
  assert.deepEqual(battle.upgrades, { rapid: 0, arc: 1, shock: 0, armor: 0 });
  assert.deepEqual(battle.cars.map(car => car.kind), ['arc']);
  assert.equal(battle.phase, 'running');
  assert.equal(battle.events.filter(event => event.type === 'install').length, 1);
});

test('an unmodified train reaches the upgrade window and eventually loses', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(battle.armor, 3);
  runUntil(battle, over);
  assert.equal(battle.phase, 'lost');
  assert.equal(battle.armor, 0);
  assert.ok(battle.wave > 1);
  const stopped = structuredClone(battle);
  stepBattle(battle, frame);
  assert.deepEqual(battle, stopped);
  assert.equal(battle.events.filter(event => event.type === 'lose').length, 1);
});

test('touching the outside of the shelter consumes armor, then ends battle', () => {
  const battle = begin();
  battle.stars = battle.cost;
  assert.equal(openUpgrade(battle, 'armor'), true);
  assert.equal(confirmUpgrade(battle), true);
  battle.cooldowns.base = 1;
  for (let id = 1; id <= 3; id++) {
    battle.enemies.push({
      id, kind: 'walker', x: engine.CENTER.x - 37, y: engine.CENTER.y, hp: 2, maxHp: 2, hitFlash: 0, chillTime: 0,
    });
    stepBattle(battle, frame);
    assert.equal(battle.armor, 3 - id);
  }
  assert.equal(battle.phase, 'lost');
  assert.equal(battle.enemies.some(enemy => enemy.hp === 0), false);
  assert.equal(battle.events.filter(event => event.type === 'breach').length, 3);
  assert.equal(battle.events.filter(event => event.type === 'lose').length, 1);
});

test('the endurance level keeps offering upgrades and reaches its one hundredth wave', () => {
  assert.equal(engine.WAVE_COUNT, 100);
  let battle = begin();
  const preference = ['rapid', 'arc', 'shock', 'armor'];
  let largestEnemyGroup = 0;
  for (let step = 0; step < 2500 / frame && !over(battle); step++) {
    if (canUpgrade(battle)) {
      const legal = preference.filter(kind => engine.canUpgradeKind(battle, kind));
      const kind = legal.find(candidate =>
        battle.upgrades[candidate] === Math.min(...legal.map(key => battle.upgrades[key])));
      assert.equal(openUpgrade(battle, kind), true);
      assert.equal(confirmUpgrade(battle), true);
    }
    if (battle.upgradeCount === 2) assert.equal(battle.cost, 8);
    stepBattle(battle, frame);
    largestEnemyGroup = Math.max(largestEnemyGroup, battle.enemies.length);
    battle.events.length = 0;
    if (step % 4800 === 0 && !over(battle)) {
      const snapshot = JSON.parse(JSON.stringify(engine.serializeBattle(battle)));
      const next = engine.restoreBattle(snapshot);
      assert.deepEqual(next, battle);
      battle = next;
    }
  }
  assert.equal(battle.phase, 'won', `stopped in wave ${battle.wave}`);
  assert.equal(battle.wave, 100);
  assert.ok(battle.upgradeCount >= 30);
  assert.ok(largestEnemyGroup < 50);
});

test('the higher endurance waves overwhelm a train that stops upgrading near the start', () => {
  const battle = begin();
  const choices = ['rapid', 'arc', 'shock', 'armor', 'rapid', 'arc', 'shock', 'armor'];
  for (const choice of choices) {
    runUntil(battle, canUpgrade);
    assert.equal(openUpgrade(battle, choice), true);
    assert.equal(confirmUpgrade(battle), true);
  }
  runUntil(battle, over, 2100);
  assert.equal(battle.phase, 'lost');
  assert.ok(battle.wave >= 15 && battle.wave < 100);
});

test('an open upgrade checkpoint resumes exactly, without replaying old events', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(openUpgrade(battle, 'arc'), true);
  const checkpoint = JSON.parse(JSON.stringify(engine.serializeBattle(battle)));
  const restored = engine.restoreBattle(checkpoint);
  assert.deepEqual(restored, { ...battle, events: [] });
  assert.equal(confirmUpgrade(restored), true);
  assert.equal(confirmUpgrade(restored), false);
  assert.equal(restored.stars, battle.stars - battle.cost);
  assert.equal(restored.waveTime, battle.waveTime);
  assert.throws(() => engine.restoreBattle({ ...checkpoint, armor: 0 }), RangeError);
});

test('the cooling carriage slows a cluster temporarily and leaves a distant enemy unaffected', () => {
  const battle = begin();
  battle.stars = battle.cost;
  assert.equal(openUpgrade(battle, 'armor'), true);
  assert.equal(confirmUpgrade(battle), true);
  battle.cooldowns.base = 10;
  for (const [index, [x, y]] of [[170, 230], [180, 240], [44, 149]].entries()) {
    battle.enemies.push({ id: index + 20, kind: 'walker', x, y, hp: 2, maxHp: 2, hitFlash: 0, chillTime: 0 });
  }
  stepBattle(battle, frame);
  const [first, second, distant] = battle.enemies;
  assert.ok(first.chillTime > 0 && second.chillTime > 0);
  assert.equal(distant.chillTime, 0);
  assert.deepEqual(battle.enemies.map(enemy => enemy.hp), [2, 2, 2]);
  const pulse = battle.events.find(event => event.type === 'chill');
  assert.equal(pulse.kind, 'armor');
  assert.equal(pulse.targets, 2);
  assert.ok(pulse.radius > 0);

  const xBefore = first.x;
  const yBefore = first.y;
  stepBattle(battle, frame);
  assert.ok(Math.hypot(first.x - xBefore, first.y - yBefore) < 30 * frame * 0.7);
  battle.cooldowns.armor = 10;
  runUntil(battle, () => first.chillTime === 0, 4);
  assert.equal(battle.events.filter(event => event.type === 'chill').length, 1);
});

test('a checkpoint retains active cooling and the carriage cooldown after resuming', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(openUpgrade(battle, 'armor'), true);
  assert.equal(confirmUpgrade(battle), true);
  runUntil(battle, state => state.enemies.some(enemy => enemy.chillTime > 0));
  assert.ok(battle.cooldowns.armor > 0);

  const checkpoint = JSON.parse(JSON.stringify(engine.serializeBattle(battle)));
  const restored = engine.restoreBattle(checkpoint);
  battle.events.length = 0;
  assert.deepEqual(restored, battle);
  stepBattle(battle, frame);
  stepBattle(restored, frame);
  assert.deepEqual(restored, battle);
});

test('version 1 shields migrate to cooling carriages without changing the active run or pending card', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(openUpgrade(battle, 'armor'), true);
  assert.equal(confirmUpgrade(battle), true);
  runUntil(battle, state => canUpgrade(state) && state.enemies.every(enemy => enemy.kind !== 'hound'));
  assert.equal(openUpgrade(battle, 'armor'), true);

  const legacy = engine.serializeBattle(battle);
  legacy.version = 1;
  legacy.shield = 1;
  delete legacy.cooldowns.armor;
  for (const enemy of legacy.enemies) delete enemy.chillTime;
  const restored = engine.restoreBattle(legacy);
  assert.equal(restored.phase, 'upgrade');
  assert.equal(restored.pendingUpgrade, 'armor');
  assert.equal(restored.upgrades.armor, 1);
  assert.equal(restored.stars, legacy.stars);
  assert.equal(restored.armor, legacy.armor);
  assert.equal(restored.waveTime, legacy.waveTime);
  assert.equal(restored.cooldowns.armor, 0);
  assert.equal(restored.shield, undefined);
  assert.ok(restored.enemies.every(enemy => enemy.chillTime === 0));
  assert.equal(engine.serializeBattle(restored).version, 4);
  assert.equal(confirmUpgrade(restored), true);
  assert.equal(restored.upgrades.armor, 2);
});

test('a shock carriage emits splash effects and damages multiple enemies', () => {
  const battle = begin();
  runUntil(battle, canUpgrade);
  assert.equal(openUpgrade(battle, 'shock'), true);
  assert.equal(confirmUpgrade(battle), true);
  runUntil(battle, state => state.events.some(event => event.type === 'blast' && event.targets > 1));
  assert.ok(battle.events.some(event => event.type === 'shot' && event.kind === 'shock'));
});

test('one offensive upgrade cannot reach wave eight across the configured assault routes', () => {
  for (const seed of [0, 1, 2, 3, 11, 31, 4294967295]) {
    for (const choice of ['rapid', 'arc', 'shock']) {
      const battle = createBattle(seed);
      startBattle(battle);
      runUntil(battle, canUpgrade);
      assert.equal(openUpgrade(battle, choice), true);
      assert.equal(confirmUpgrade(battle), true);
      runUntil(battle, state => over(state) || state.wave >= 8, 300);
      assert.equal(battle.phase, 'lost', `${choice} reached wave ${battle.wave} with seed ${seed}`);
    }
  }
});

test('two complementary early builds can each reach wave ten', () => {
  for (const choices of [['rapid', 'arc'], ['shock', 'rapid']]) {
    const battle = begin();
    installChoices(battle, choices);
    runUntil(battle, state => state.wave === 10 || over(state), 260);
    assert.equal(battle.wave, 10, choices.join(' then '));
    assert.equal(battle.upgradeCount, 2);
  }
});

test('new runs keep fixed onboarding, vary a later flank, and replay the same seed on resume', () => {
  const first = begin(0);
  const second = begin(0xffffffff);
  const builds = [first, second];
  for (const battle of builds) {
    installChoices(battle, ['rapid', 'arc', 'shock', 'armor']);
    runUntil(battle, state => state.wave === 3 && state.waveTime >= 9);
  }
  assert.deepEqual(first.enemies, second.enemies);
  for (const battle of builds) {
    runUntil(battle, state => state.wave === 12 && state.spawnIndex === 13, 260);
    assert.ok(battle.enemies.length > 0);
  }
  assert.equal(first.waveTime, second.waveTime);
  assert.deepEqual(first.enemies.slice(0, -1), second.enemies.slice(0, -1));
  assert.equal(first.enemies.at(-1).kind, second.enemies.at(-1).kind);
  assert.notEqual(first.enemies.at(-1).y, second.enemies.at(-1).y);

  first.events.length = 0;
  const snapshot = JSON.parse(JSON.stringify(engine.serializeBattle(first)));
  assert.equal(snapshot.seed, 0);
  assert.throws(() => engine.restoreBattle({ ...snapshot, seed: -1 }), RangeError);
  const reopened = engine.restoreBattle(snapshot);
  for (let step = 0; step < 12 / frame; step++) {
    stepBattle(first, frame);
    stepBattle(reopened, frame);
  }
  assert.deepEqual(reopened, first);
});

test('saving an existing version 3 run preserves its original pressure after resuming', () => {
  const fresh = begin(11);
  installChoices(fresh, ['rapid', 'arc']);
  runUntil(fresh, state => state.wave === 4);
  const { seed, ...checkpoint } = engine.serializeBattle(fresh);
  const legacy = engine.restoreBattle({ ...checkpoint, version: 3 });
  assert.equal(legacy.seed, null);
  assert.equal(legacy.stars, fresh.stars);
  assert.equal(legacy.armor, fresh.armor);
  for (const battle of [legacy, fresh]) runUntil(battle, state => state.spawnIndex === 1, 3);
  assert.equal(legacy.enemies[0].maxHp, 2);
  assert.equal(fresh.enemies[0].maxHp, 3);
  const savedAgain = engine.serializeBattle(legacy);
  assert.equal(savedAgain.seed, null);
  assert.deepEqual(engine.restoreBattle(savedAgain), { ...legacy, events: [] });
});

test('a cooling carriage followed by rapid fire can hold the opening three waves', () => {
  const battle = begin();
  for (const choice of ['armor', 'rapid']) {
    runUntil(battle, canUpgrade);
    assert.equal(openUpgrade(battle, choice), true);
    assert.equal(confirmUpgrade(battle), true);
  }
  runUntil(battle, state => state.wave >= 4);
  assert.ok(battle.armor > 0);
  assert.ok(battle.events.some(event => event.type === 'chill'));
});

for (const choices of [['rapid', 'arc'], ['arc', 'rapid'], ['rapid', 'shock']]) {
  test(`${choices.join(' then ')} can clear the opening three waves`, () => {
    const battle = begin();
    for (const choice of choices) {
      runUntil(battle, canUpgrade);
      assert.equal(openUpgrade(battle, choice), true);
      assert.equal(confirmUpgrade(battle), true);
    }
    assert.deepEqual(battle.cars.map(car => car.kind), choices);
    assert.equal(battle.cost, 8);
    runUntil(battle, state => state.wave >= 4);
    assert.equal(battle.phase, 'running');
    assert.ok(battle.armor > 0);
    assert.ok(battle.events.some(event => event.type === 'shot' && event.kind === 'rapid'));
    assert.ok(battle.events.some(event => event.type === (choices.includes('arc') ? 'arc' : 'blast')));
  });
}

test('a second copy reinforces the same car and does not add another car', () => {
  const battle = begin();
  for (let level = 1; level <= 2; level++) {
    runUntil(battle, canUpgrade);
    assert.equal(openUpgrade(battle, 'rapid'), true);
    assert.equal(confirmUpgrade(battle), true);
    assert.equal(battle.upgrades.rapid, level);
    assert.equal(battle.cars.length, 1);
  }
  assert.equal(battle.cost, 8);
  runUntil(battle, state => state.wave >= 4);
  assert.ok(battle.armor > 0);
});

test('changing tactics after the first breach can still save the station', () => {
  const battle = begin();
  runUntil(battle, state => state.armor === 2 && canUpgrade(state));
  for (const choice of ['arc', 'rapid']) {
    runUntil(battle, canUpgrade);
    assert.equal(openUpgrade(battle, choice), true);
    assert.equal(confirmUpgrade(battle), true);
  }
  runUntil(battle, state => state.wave >= 4);
  assert.ok(battle.armor >= 1 && battle.armor <= 2);
});
