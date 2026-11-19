export const WIDTH = 480;
export const HEIGHT = 600;
export const CENTER = Object.freeze({ x: 240, y: 294 });
export const SHELTER = Object.freeze({ halfWidth: 32, halfHeight: 24, contactPadding: 6 });
export const LEVEL_ID = 'endurance-yard';
export const WAVE_COUNT = 100;
export const MAP_STAR_BUDGET = 20;
const COURSE_UPGRADE_COST = 4;
export const BOSS_REQUIRED_UPGRADES = Math.ceil(0.8 * MAP_STAR_BUDGET / COURSE_UPGRADE_COST);
export const TRACK_POINTS = Object.freeze([
  [126, 184], [165, 144], [291, 144], [322, 176],
  [322, 259], [347, 283], [347, 377], [306, 418],
  [191, 418], [157, 384], [157, 324], [121, 290],
].map(point => Object.freeze(point)));

const BRIDGE_TRACK_POINTS = Object.freeze([
  [294, 130.5], [323, 161.5], [323, 427.5], [294, 458.5],
  [186, 458.5], [157, 427.5], [157, 161.5], [186, 130.5],
].map(point => Object.freeze(point)));

export const UPGRADES = Object.freeze({
  rapid: { id: 'rapid', name: '速射车厢', description: '高速连发，截住冲刺的怪物。', maxRank: 12 },
  arc: { id: 'arc', name: '电弧车厢', description: '电流跃到附近的怪物身上。', maxRank: 12 },
  shock: { id: 'shock', name: '震荡车厢', description: '爆震弹能击中聚集的怪物。', maxRank: 12 },
  armor: { id: 'armor', name: '低温车厢', description: '让一群怪物暂时减速，升级后范围更大、减速更强。', maxRank: 3 },
});

const UPGRADE_KINDS = Object.keys(UPGRADES);
const MAX_ARMOR = 3;
const SNAPSHOT_VERSION = 4;
const MAX_SEED = 0xffffffff;
const TUTORIAL_WAVES = 3;
const FLANK_WAVE_END = 9;
const VARIATION_WAVE_START = 12;
const VARIATION_WAVE_END = 48;
const COURSE_STAR_CAPS = [6, 12, 16, MAP_STAR_BUDGET];
const FORMAL_STAR_CAPS = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 90, 100];
const FORMAL_RANK_LIMIT = 5;
const FORMAL_REQUIRED_UPGRADES = Math.ceil(0.8 * FORMAL_STAR_CAPS.at(-1) / COURSE_UPGRADE_COST);
const BOSS_PREP_SECONDS = 14;
const BOSS_START_POSITION = [240, 95];
const TRAIN_SPEED = 79;
const CAR_SPACING = 37;
const FIRE_INTERVALS = {
  base: [0.42, 0.42], rapid: [0.18, 0.11], arc: [0.38, 0.26], shock: [0.67, 0.39], armor: [1.25, 1.15],
};
const FIRE_RANGES = { base: 158, rapid: 180, arc: 194, shock: 184, armor: 194 };
const COOLING_LEVELS = [
  { radius: 85, duration: 2.5, slowdown: 0.55 },
  { radius: 95, duration: 2.8, slowdown: 0.72 },
  { radius: 105, duration: 3.2, slowdown: 0.93 },
  { radius: 115, duration: 3.45, slowdown: 0.93 },
  { radius: 126, duration: 3.7, slowdown: 0.93 },
];
const ENEMIES = {
  walker: { hp: 2, speed: 30 },
  runner: { hp: 2, speed: 59 },
  brute: { hp: 7, speed: 27 },
  hound: { hp: 2 },
  chimera: { hp: 7, speed: 25 },
  crawler: { hp: 1, speed: 41 },
  boss: { hp: 48, speed: 17 },
};
const HOUND_WINDUP = 0.7;
const HOUND_RUSH_END = 1.65;
const HOUND_CYCLE = 2.6;
const HOUND_SPEEDS = { windup: 0, rush: 117, recover: 37 };

export function houndPhase(unit) {
  if (unit.chargeTime < HOUND_WINDUP) return 'windup';
  if (unit.chargeTime < HOUND_RUSH_END) return 'rush';
  return 'recover';
}

const WEST = [9, 288];
const EAST = [471, 266];
const NORTH = [217, 11];
const SOUTH = [256, 589];
const WEST_GROUP = [9, 255];
const WEST_LOW = [9, 320];
const EAST_GROUP = [471, 300];
const EAST_LOW = [471, 333];
const NORTH_GROUP = [256, 11];
const SOUTH_GROUP = [217, 589];

const WAVES = [
  {
    duration: 30,
    spawns: [
      [1.8, 'walker', WEST], [4.5, 'walker', NORTH], [7.5, 'walker', EAST],
      [10.7, 'walker', SOUTH], [12.4, 'walker', SOUTH_GROUP],
      [17.6, 'runner', WEST], [20.7, 'walker', EAST], [21.4, 'walker', EAST_GROUP],
      [24.8, 'runner', NORTH],
    ],
  },
  {
    duration: 32,
    spawns: [
      [1.6, 'hound', EAST], [1.85, 'hound', EAST_GROUP], [5.9, 'walker', WEST_GROUP],
      [6.0, 'walker', WEST], [6.1, 'brute', WEST_LOW],
      [8.5, 'runner', SOUTH], [9.4, 'runner', SOUTH_GROUP],
      [12.2, 'brute', WEST], [14.7, 'runner', NORTH_GROUP], [16.8, 'runner', EAST],
      [17.1, 'walker', EAST_GROUP], [20.1, 'runner', SOUTH], [20.6, 'walker', SOUTH_GROUP],
      [23, 'runner', WEST], [23.4, 'walker', WEST_GROUP], [26.1, 'brute', EAST],
    ],
  },
  {
    duration: 34,
    spawns: [
      [1.5, 'runner', SOUTH], [3.6, 'walker', WEST], [3.85, 'walker', WEST_GROUP],
      [4.2, 'brute', WEST], [4.4, 'brute', WEST_LOW], [6.1, 'chimera', [31, 288]], [8.3, 'runner', EAST],
      [8.55, 'walker', EAST_GROUP], [8.7, 'brute', EAST_LOW], [9, 'walker', EAST],
      [9.2, 'runner', EAST_GROUP], [11.4, 'runner', SOUTH_GROUP],
      [12.7, 'runner', WEST], [15, 'runner', NORTH_GROUP], [16.4, 'walker', SOUTH],
      [16.7, 'walker', SOUTH_GROUP], [17.1, 'runner', NORTH_GROUP],
      [17.2, 'brute', SOUTH], [17.4, 'brute', SOUTH_GROUP], [17.5, 'brute', [185, 589]],
      [17.7, 'walker', [291, 589]], [18.2, 'brute', [324, 589]], [19.1, 'runner', EAST],
      [20.4, 'runner', NORTH], [21.6, 'walker', WEST_GROUP], [22, 'brute', WEST],
      [24.5, 'runner', SOUTH], [25, 'walker', SOUTH_GROUP], [26, 'brute', EAST],
      [26.2, 'brute', EAST_GROUP], [26.4, 'brute', EAST_LOW], [26.8, 'brute', [471, 365]],
      [27.5, 'brute', NORTH], [27.6, 'runner', NORTH_GROUP], [27.8, 'brute', NORTH_GROUP],
    ],
  },
];

const APPROACHES = [
  [WEST_GROUP, WEST, WEST_LOW], [NORTH, NORTH_GROUP, [295, 11]],
  [EAST, EAST_GROUP, EAST_LOW], [SOUTH_GROUP, SOUTH, [295, 589]],
];

function isFlankWave(wave) {
  return wave > TUTORIAL_WAVES && wave <= FLANK_WAVE_END;
}

function enduranceWave(wave, variant = null) {
  const surge = wave % 10 === 0;
  const count = 14 + Math.floor((wave - 4) / 7) + (surge ? 4 : 0);
  const groupSize = Math.ceil(count / 4);
  const reinforcement = variant !== null && isFlankWave(wave);
  const turn = reinforcement ? 2 : [0, 1, 2, 1][wave % 4];
  const spacing = reinforcement ? 3.5 : 4.4;
  const spawns = Array.from({ length: count }, (_, slot) => {
    const group = Math.floor(slot / groupSize);
    const lastFlank = turn === 0 && group === 3 ? 2 + (variant ?? 0) : 0;
    const lane = APPROACHES[(wave + group * turn + lastFlank) % 4];
    const member = slot % groupSize;
    let kind = (slot + wave) % (surge ? 4 : 6) === 0 ? 'brute'
      : (slot + wave) % 3 === 0 ? 'runner' : 'walker';
    if (wave % 3 === 0 && group === 1 && member < 2) kind = 'hound';
    if (wave % 4 === 0 && group === 2 && member === 0) kind = 'chimera';
    return [1.25 + group * spacing + member * 0.23, kind, lane[slot % lane.length]];
  });
  return { duration: surge ? 21 : 19, spawns };
}

for (let wave = WAVES.length + 1; wave <= WAVE_COUNT; wave++) WAVES.push(enduranceWave(wave));

function variantFor(seed, wave) {
  const mixed = Math.imul(seed ^ (wave * 0x9e3779b9), 0x45d9f3b);
  return (mixed ^ (mixed >>> 16)) >>> 31;
}

const BOSS_WAVE = { duration: BOSS_PREP_SECONDS, spawns: [[0, 'boss', BOSS_START_POSITION]] };
const formalWaves = [...WAVES.slice(0, 3), ...Array.from({ length: FORMAL_STAR_CAPS.length - 3 }, (_, index) => ({
  ...enduranceWave(index + 4, 0), duration: 27,
}))];
const formalRules = {
  starCaps: FORMAL_STAR_CAPS, upgradeLimit: FORMAL_RANK_LIMIT, requiredUpgrades: FORMAL_REQUIRED_UPGRADES, reinforced: true,
};
const COURSE_LEVELS = {
  'map-patrol': { waves: WAVES.slice(0, 5), starCaps: COURSE_STAR_CAPS },
  'map-boss': { waves: [...WAVES.slice(0, 4), BOSS_WAVE], starCaps: COURSE_STAR_CAPS,
    requiredUpgrades: BOSS_REQUIRED_UPGRADES, boss: true },
  'formal-yard-v1': { ...formalRules, waves: [...formalWaves, { ...enduranceWave(13, 0), duration: 24 }] },
  'formal-bridge-v1': { ...formalRules, waves: [...formalWaves, BOSS_WAVE], boss: true, bridge: true },
};

function courseLevel(levelId) {
  return Object.hasOwn(COURSE_LEVELS, levelId) ? COURSE_LEVELS[levelId] : undefined;
}

function waveCountFor(levelId) {
  if (typeof levelId !== 'string') return 0;
  return levelId === LEVEL_ID ? WAVE_COUNT : courseLevel(levelId)?.waves.length ?? 0;
}

function wavePlan(wave, seed, levelId) {
  if (levelId !== LEVEL_ID) return courseLevel(levelId).waves[wave - 1];
  if (seed === null) return WAVES[wave - 1];
  return WAVE_VARIANTS[variantFor(seed, wave)][wave - 1];
}

const REBALANCED_WAVES = WAVES.map((plan, index) => isFlankWave(index + 1) ? enduranceWave(index + 1, 0) : plan);
const WAVE_VARIANTS = [REBALANCED_WAVES, REBALANCED_WAVES.map((plan, index) => {
  const wave = index + 1;
  // The optional last group comes from the next side, with identical timing and roster.
  return wave >= VARIATION_WAVE_START && wave <= VARIATION_WAVE_END && wave % 4 === 0 ? enduranceWave(wave, 1) : plan;
})];

function makeArena(theme, points) {
  const segments = points.map(([x, y], index) => {
    const [endX, endY] = points[(index + 1) % points.length];
    const dx = endX - x;
    const dy = endY - y;
    return { x, y, dx, dy, length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
  });
  return { theme, points, segments, length: segments.reduce((sum, segment) => sum + segment.length, 0) };
}

const YARD_ARENA = makeArena('yard', TRACK_POINTS);
const BRIDGE_ARENA = makeArena('bridge', BRIDGE_TRACK_POINTS);

function arenaFor(levelId) {
  return courseLevel(levelId)?.bridge ? BRIDGE_ARENA : YARD_ARENA;
}

export function battleArena(battle) {
  return arenaFor(battle.levelId);
}

function positionAt(distance, arena) {
  let offset = (distance % arena.length + arena.length) % arena.length;
  for (const segment of arena.segments) {
    if (offset < segment.length) {
      const fraction = offset / segment.length;
      return { x: segment.x + segment.dx * fraction, y: segment.y + segment.dy * fraction, angle: segment.angle };
    }
    offset -= segment.length;
  }
  const [x, y] = arena.points[0];
  return { x, y, angle: arena.segments[0].angle };
}

export function createBattle(seed = 0, levelId = LEVEL_ID) {
  if (!integerWithin(seed, 0, MAX_SEED)) throw new RangeError('无效的战斗种子。');
  const waveCount = waveCountFor(levelId);
  if (!waveCount) throw new RangeError('无效的战斗关卡。');
  return {
    levelId, waveCount, seed, phase: 'ready', wave: 1, elapsed: 0, waveTime: 0, waveDuration: wavePlan(1, seed, levelId).duration,
    stars: 0, armor: MAX_ARMOR, upgradeCount: 0, cost: upgradeCost(0, levelId), pendingUpgrade: null,
    train: positionAt(0, arenaFor(levelId)), cars: [], enemies: [], drops: [], events: [],
    upgrades: { rapid: 0, arc: 0, shock: 0, armor: 0 }, cooldowns: { base: 0, rapid: 0, arc: 0, shock: 0, armor: 0 },
    nextEnemyId: 1, spawnIndex: 0,
  };
}

export function serializeBattle(battle) {
  if (battle.phase !== 'running' && battle.phase !== 'upgrade') throw invalidCheckpoint();
  const { levelId, seed, phase, wave, elapsed, waveTime, stars, armor, upgradeCount, pendingUpgrade,
    upgrades, cooldowns, nextEnemyId, spawnIndex } = battle;
  return {
    version: SNAPSHOT_VERSION, levelId, seed, phase, wave, elapsed, waveTime, stars, armor,
    upgradeCount, pendingUpgrade, upgrades: { ...upgrades }, cooldowns: { ...cooldowns },
    nextEnemyId, spawnIndex, carOrder: battle.cars.map(car => car.kind),
    enemies: battle.enemies.map(enemy => ({ ...enemy })),
    drops: battle.drops.map(drop => ({ ...drop })),
  };
}

const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const integerWithin = (n, min, max) => Number.isInteger(n) && within(n, min, max);
const validPosition = (entry) => entry && within(entry.x, 0, WIDTH) && within(entry.y, 0, HEIGHT);
const invalidCheckpoint = () => new RangeError('本局战况存档格式无效。');

export function restoreBattle(snapshot) {
  const legacy = snapshot?.version === 1;
  const priorRoster = legacy || snapshot?.version === 2;
  const levelId = snapshot?.levelId;
  const waveCount = waveCountFor(levelId);
  if (!snapshot || !integerWithin(snapshot.version, 1, SNAPSHOT_VERSION) || !waveCount ||
      (levelId !== LEVEL_ID && snapshot.version !== SNAPSHOT_VERSION) ||
      !integerWithin(snapshot.wave, 1, waveCount)) throw invalidCheckpoint();
  const seed = snapshot.version === SNAPSHOT_VERSION ? snapshot.seed : null;
  if ((seed !== null || levelId !== LEVEL_ID) && !integerWithin(seed, 0, MAX_SEED)) throw invalidCheckpoint();
  const { phase, wave, elapsed, waveTime, stars, armor, upgradeCount, pendingUpgrade,
    upgrades, cooldowns, nextEnemyId, spawnIndex, carOrder, enemies, drops } = snapshot;
  const plan = wavePlan(wave, seed, levelId);
  let scheduledEnemies = 0;
  for (let previous = 1; previous < wave; previous++) scheduledEnemies += wavePlan(previous, seed, levelId).spawns.length;
  if (!['running', 'upgrade'].includes(phase) || !within(elapsed, 0, waveCount * 60) ||
      !within(waveTime, 0, Math.min(60, elapsed)) || !integerWithin(stars, 0, 6000) ||
      !integerWithin(armor, 1, MAX_ARMOR) || !upgrades || !cooldowns ||
      (legacy && !integerWithin(snapshot.shield, 0, upgrades.armor)) || !integerWithin(spawnIndex, 0, plan.spawns.length) ||
      nextEnemyId !== 1 + spawnIndex + scheduledEnemies ||
      !UPGRADE_KINDS.every(kind => integerWithin(upgrades[kind], 0, upgradeLimitFor(levelId, kind))) ||
      upgradeCount !== UPGRADE_KINDS.reduce((total, kind) => total + upgrades[kind], 0) ||
      !Object.keys(FIRE_INTERVALS).every(kind =>
        (legacy && kind === 'armor') || within(cooldowns[kind], 0, FIRE_INTERVALS[kind][0]))) {
    throw invalidCheckpoint();
  }
  const owned = UPGRADE_KINDS.filter(kind => upgrades[kind] > 0);
  const maxChillDuration = COOLING_LEVELS[upgrades.armor - 1]?.duration ?? 0;
  const cost = UPGRADE_KINDS.some(kind => upgrades[kind] < upgradeLimitFor(levelId, kind)) ? upgradeCost(upgradeCount, levelId) : null;
  if (phase === 'upgrade' ? (!Object.hasOwn(UPGRADES, pendingUpgrade) ||
      upgrades[pendingUpgrade] >= upgradeLimitFor(levelId, pendingUpgrade) || cost === null || stars < cost)
      : pendingUpgrade !== null) throw invalidCheckpoint();
  if (!Array.isArray(enemies)) throw invalidCheckpoint();
  const firstEnemyId = nextEnemyId - spawnIndex;
  const aliveIds = new Set(enemies.map(enemy => enemy?.id));
  const scheduledKind = id => integerWithin(id, firstEnemyId, nextEnemyId - 1)
    ? plan.spawns[id - firstEnemyId][1] : null;
  function validEnemySpawn(enemy) {
    if (enemy.kind === 'crawler') {
      const parentId = Math.floor(-enemy.id / 2);
      return !priorRoster && Number.isInteger(enemy.id) && scheduledKind(parentId) === 'chimera' && !aliveIds.has(parentId);
    }
    const planned = scheduledKind(enemy.id);
    if (levelId !== LEVEL_ID || enemy.kind === 'boss') return planned === enemy.kind;
    if (enemy.kind === 'hound' || enemy.kind === 'chimera') return !priorRoster && planned === enemy.kind;
    // Older checkpoints may already have spawned a normal enemy in a replaced slot.
    return planned !== null;
  }
  if (!Array.isArray(carOrder) || carOrder.length !== owned.length ||
      new Set(carOrder).size !== carOrder.length || !carOrder.every(kind => owned.includes(kind)) ||
      !Array.isArray(drops) || drops.length > 60 ||
      !drops.every(drop => validPosition(drop) && within(drop.age, 0, 1.35)) ||
      aliveIds.size !== enemies.length ||
      !enemies.every(enemy => validPosition(enemy) && Object.hasOwn(ENEMIES, enemy.kind) &&
        validEnemySpawn(enemy) && (enemy.kind !== 'hound' ||
          (within(enemy.chargeTime, 0, HOUND_CYCLE) && enemy.chargeTime < HOUND_CYCLE)) &&
        enemy.maxHp === enemyHealth(enemy.kind, wave, seed, levelId) && integerWithin(enemy.hp, 1, enemy.maxHp) &&
        within(enemy.hitFlash, 0, 0.16) && (legacy || within(enemy.chillTime, 0, maxChillDuration)))) throw invalidCheckpoint();

  const arena = arenaFor(levelId);
  const battle = {
    levelId, waveCount, seed, phase, wave, elapsed, waveTime, waveDuration: plan.duration, stars, armor,
    upgradeCount, cost, pendingUpgrade, nextEnemyId, spawnIndex, events: [],
    upgrades: Object.fromEntries(UPGRADE_KINDS.map(kind => [kind, upgrades[kind]])),
    cooldowns: Object.fromEntries(Object.keys(FIRE_INTERVALS).map(kind =>
      [kind, legacy && kind === 'armor' ? 0 : cooldowns[kind]])),
    train: positionAt(elapsed * TRAIN_SPEED, arena),
    cars: carOrder.map((kind, idx) => ({ kind, ...positionAt(elapsed * TRAIN_SPEED - (idx + 1) * CAR_SPACING, arena) })),
    enemies: enemies.map(({ id, kind, x, y, hp, maxHp, hitFlash, chillTime, chargeTime }) =>
      ({ id, kind, x, y, hp, maxHp, hitFlash, chillTime: legacy ? 0 : chillTime,
        ...(kind === 'hound' ? { chargeTime } : {}) })),
    drops: drops.map(({ x, y, age }) => ({ x, y, age })),
  };
  if (levelId !== LEVEL_ID && courseStarsIssued(battle) > courseStarCap(battle)) throw invalidCheckpoint();
  if (isBossWave(battle) && (enemies.length !== (waveTime === 0 ? 0 : 1) || enemies.length !== spawnIndex ||
      courseStarsIssued(battle) !== courseStarCap(battle) || drops.length !== 0 ||
      (waveTime >= BOSS_PREP_SECONDS && upgradeCount < requiredUpgradeCount(battle)))) throw invalidCheckpoint();
  return battle;
}

export function startBattle(battle) {
  if (battle.phase !== 'ready') return false;
  battle.phase = 'running';
  battle.events.push({ type: 'wave', wave: battle.wave });
  return true;
}

function canUpgrade(battle) {
  return battle.cost !== null && battle.stars >= battle.cost;
}

function upgradeCost(count, levelId) {
  if (levelId !== LEVEL_ID) return COURSE_UPGRADE_COST;
  return 4 + Math.min(count, 4) * 2 + Math.max(0, count - 4);
}

function courseStarCap(battle) {
  const caps = courseLevel(battle.levelId).starCaps;
  return caps[battle.wave - 1] ?? caps.at(-1);
}

function courseStarsIssued(battle) {
  return battle.stars + battle.upgradeCount * COURSE_UPGRADE_COST + battle.drops.length;
}

function isBossWave(battle) {
  return battle.wave === battle.waveCount && courseLevel(battle.levelId)?.boss === true;
}

export function bossPrepRemaining(battle) {
  return isBossWave(battle) ? Math.max(0, BOSS_PREP_SECONDS - battle.waveTime) : 0;
}

export function canUpgradeKind(battle, kind) {
  return Object.hasOwn(UPGRADES, kind) && battle.upgrades[kind] < upgradeLimit(battle, kind);
}

function upgradeLimitFor(levelId, kind) {
  return courseLevel(levelId)?.upgradeLimit ?? UPGRADES[kind].maxRank;
}

export function upgradeLimit(battle, kind) {
  return Object.hasOwn(UPGRADES, kind) ? upgradeLimitFor(battle.levelId, kind) : 0;
}

export function requiredUpgradeCount(battle) {
  return courseLevel(battle.levelId)?.requiredUpgrades ?? 0;
}

export function minimumUpgradePerKind(battle) {
  return courseLevel(battle.levelId)?.upgradeLimit ?? 0;
}

export function openUpgrade(battle, kind) {
  if (battle.phase !== 'running' || !canUpgradeKind(battle, kind) || !canUpgrade(battle)) return false;
  battle.pendingUpgrade = kind;
  battle.phase = 'upgrade';
  return true;
}

export function cancelUpgrade(battle) {
  if (battle.phase !== 'upgrade') return false;
  battle.pendingUpgrade = null;
  battle.phase = 'running';
  return true;
}

export function confirmUpgrade(battle) {
  if (battle.phase !== 'upgrade' || !canUpgrade(battle) || !canUpgradeKind(battle, battle.pendingUpgrade)) return false;
  const kind = battle.pendingUpgrade;
  battle.stars -= battle.cost;
  battle.upgradeCount++;
  battle.upgrades[kind]++;
  battle.cost = UPGRADE_KINDS.some(key => canUpgradeKind(battle, key)) ? upgradeCost(battle.upgradeCount, battle.levelId) : null;
  if (battle.upgrades[kind] === 1) {
    battle.cars.push({ kind, ...positionAt(battle.elapsed * TRAIN_SPEED - CAR_SPACING * (battle.cars.length + 1), battleArena(battle)) });
  }
  battle.cooldowns[kind] = 0;
  const car = battle.cars.find(candidate => candidate.kind === kind);
  battle.events.push({ type: 'install', kind, x: car.x, y: car.y });
  if (canUpgrade(battle)) battle.events.push({ type: 'ready' });
  cancelUpgrade(battle);
  return true;
}

function moveTrain(battle) {
  const distance = battle.elapsed * TRAIN_SPEED;
  const arena = battleArena(battle);
  Object.assign(battle.train, positionAt(distance, arena));
  for (const [index, car] of battle.cars.entries()) {
    Object.assign(car, positionAt(distance - CAR_SPACING * (index + 1), arena));
  }
}

function enemyHealth(kind, wave, seed, levelId) {
  if (kind === 'crawler') return ENEMIES.crawler.hp + Math.floor((wave - 1) / 20);
  const latePressure = Math.floor(Math.max(0, wave - 25) / 3);
  const formal = courseLevel(levelId)?.reinforced;
  const reinforcement = (formal || (levelId === LEVEL_ID && seed !== null)) && isFlankWave(wave) ? 1 : 0;
  const heavy = kind === 'brute' || kind === 'chimera';
  const nimble = kind === 'runner' || kind === 'hound';
  const coursePressure = formal ? (kind === 'boss' ? 42 : Math.max(0, wave - 7)) : 0;
  return ENEMIES[kind].hp + reinforcement + coursePressure + Math.floor((wave - 1) / (heavy ? 6 : 10)) + latePressure * (nimble ? 1 : 2);
}

function spawnEnemies(battle, spawns) {
  while (battle.spawnIndex < spawns.length && spawns[battle.spawnIndex][0] <= battle.waveTime) {
    const [, kind, [x, y]] = spawns[battle.spawnIndex++];
    const hp = enemyHealth(kind, battle.wave, battle.seed, battle.levelId);
    const enemy = { id: battle.nextEnemyId++, kind, x, y, hp, maxHp: hp, hitFlash: 0, chillTime: 0 };
    if (kind === 'hound') enemy.chargeTime = 0;
    battle.enemies.push(enemy);
  }
}

function moveEnemies(battle, seconds) {
  const slowdown = COOLING_LEVELS[battle.upgrades.armor - 1]?.slowdown ?? 0;
  for (const enemy of battle.enemies) {
    const dx = CENTER.x - enemy.x;
    const dy = CENTER.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const movingTime = seconds - Math.min(seconds, enemy.chillTime) * slowdown;
    let speed = ENEMIES[enemy.kind].speed;
    if (enemy.kind === 'hound') {
      speed = HOUND_SPEEDS[houndPhase(enemy)];
      enemy.chargeTime = (enemy.chargeTime + seconds) % HOUND_CYCLE;
    }
    const travel = speed * (1 + Math.min(0.27, (battle.wave - 1) / 300)) * movingTime;
    enemy.chillTime = Math.max(0, enemy.chillTime - seconds);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - seconds);
    const edge = Math.min(1, (SHELTER.halfWidth + SHELTER.contactPadding) / Math.abs(dx),
      (SHELTER.halfHeight + SHELTER.contactPadding) / Math.abs(dy));
    if (distance - travel > distance * edge) {
      enemy.x += dx * travel / distance;
      enemy.y += dy * travel / distance;
      continue;
    }
    enemy.hp = 0;
    const x = CENTER.x - dx * edge;
    const y = CENTER.y - dy * edge;
    if (enemy.kind === 'boss') {
      battle.armor = 0;
      battle.lossReason = 'boss-impact';
    } else {
      battle.armor--;
    }
    battle.events.push({ type: 'breach', kind: enemy.kind, x, y });
    if (battle.armor === 0) {
      battle.phase = 'lost';
      battle.events.push({ type: 'lose' });
      break;
    }
  }
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function targetInRange(enemies, origin, radius, nearestTo, visited = []) {
  let target = null;
  let closest = Infinity;
  for (const enemy of enemies) {
    if (enemy.hp <= 0 || visited.includes(enemy.id) || distanceSquared(enemy, origin) > radius ** 2) continue;
    const distance = distanceSquared(enemy, nearestTo);
    if (distance < closest) {
      closest = distance;
      target = enemy;
    }
  }
  return target;
}

function hit(battle, enemy, damage = 1) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.hitFlash = 0.16;
  battle.events.push({ type: 'hit', x: enemy.x, y: enemy.y, kind: enemy.kind });
  if (enemy.hp === 0) {
    if (enemy.kind !== 'crawler' && (battle.levelId === LEVEL_ID || courseStarsIssued(battle) < courseStarCap(battle))) {
      battle.drops.push({ x: enemy.x, y: enemy.y, age: 0 });
    }
    if (enemy.kind === 'chimera') enemy.split = true;
    battle.events.push({ type: 'kill', x: enemy.x, y: enemy.y, kind: enemy.kind });
  }
}

function splitChimera(battle, parent) {
  const dx = parent.x - CENTER.x;
  const dy = parent.y - CENTER.y;
  const distance = Math.hypot(dx, dy);
  const hp = enemyHealth('crawler', battle.wave, battle.seed, battle.levelId);
  for (const [slot, side] of [-13, 13].entries()) {
    const x = Math.max(0, Math.min(WIDTH, parent.x + (dx * 12 - dy * side) / distance));
    const y = Math.max(0, Math.min(HEIGHT, parent.y + (dy * 12 + dx * side) / distance));
    // Child IDs occupy a separate range to keep the scheduled spawn counter compatible with old saves.
    battle.enemies.push({ id: -(parent.id * 2 + slot), kind: 'crawler', x, y, hp, maxHp: hp,
      hitFlash: 0, chillTime: parent.chillTime });
  }
  battle.events.push({ type: 'split', x: parent.x, y: parent.y, kind: 'chimera' });
}

function blast(battle, target, level) {
  const radius = 49 + Math.min(23, (level - 1) * 5);
  let targets = 1;
  hit(battle, target, 2 + Math.floor((level - 1) / 2));
  for (const enemy of battle.enemies) {
    if (enemy.id !== target.id && enemy.hp > 0 && distanceSquared(target, enemy) <= radius ** 2) {
      hit(battle, enemy, 1 + Math.floor(level / 2));
      targets++;
    }
  }
  battle.events.push({ type: 'blast', kind: 'shock', x: target.x, y: target.y, radius, targets });
}

function chill(battle, target, level) {
  const { radius, duration } = COOLING_LEVELS[level - 1];
  let targets = 0;
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0 || distanceSquared(target, enemy) > radius ** 2) continue;
    enemy.chillTime = duration;
    targets++;
  }
  battle.events.push({ type: 'chill', kind: 'armor', x: target.x, y: target.y, radius, targets });
}

function fire(battle, mount, kind, seconds) {
  battle.cooldowns[kind] = Math.max(0, battle.cooldowns[kind] - seconds);
  if (battle.cooldowns[kind] > 0) return;
  const target = targetInRange(battle.enemies, mount, FIRE_RANGES[kind], CENTER);
  if (!target) return;

  const level = battle.upgrades[kind] ?? 1;
  const [baseInterval, fastestInterval] = FIRE_INTERVALS[kind];
  battle.cooldowns[kind] = Math.max(fastestInterval, baseInterval - (level - 1) * 0.034);
  battle.events.push({ type: 'shot', kind, fromX: mount.x, fromY: mount.y, x: target.x, y: target.y });
  if (kind === 'shock') {
    blast(battle, target, level);
    return;
  }
  if (kind === 'armor') {
    chill(battle, target, level);
    return;
  }
  const damage = 1 + Math.floor((level - 1) / 2);
  hit(battle, target, damage);
  if (kind !== 'arc') return;

  let previous = target;
  const visited = [target.id];
  for (let jump = 0; jump < Math.min(4, level); jump++) {
    const next = targetInRange(battle.enemies, previous, 60, previous, visited);
    if (!next) break;
    battle.events.push({ type: 'arc', kind, fromX: previous.x, fromY: previous.y, x: next.x, y: next.y });
    hit(battle, next, damage);
    visited.push(next.id);
    previous = next;
  }
}

function collectDrops(battle, seconds) {
  const wasReady = canUpgrade(battle);
  const remaining = [];
  for (const drop of battle.drops) {
    drop.age += seconds;
    const dx = battle.train.x - drop.x;
    const dy = battle.train.y - drop.y;
    const distance = Math.hypot(dx, dy);
    const travel = Math.min(10, 4 + drop.age * 10) * seconds * distance;
    if (distance <= 13 || drop.age >= 1.35) {
      battle.stars++;
      battle.events.push({ type: 'star', x: battle.train.x, y: battle.train.y, fromX: drop.x, fromY: drop.y });
    } else {
      if (drop.age >= 0.13) {
        drop.x += dx * travel / distance;
        drop.y += dy * travel / distance;
      }
      remaining.push(drop);
    }
  }
  battle.drops = remaining;
  if (!wasReady && canUpgrade(battle)) battle.events.push({ type: 'ready' });
}

function advanceWave(battle) {
  if (battle.levelId !== LEVEL_ID) {
    const wasReady = canUpgrade(battle);
    const supply = courseStarCap(battle) - courseStarsIssued(battle) + battle.drops.length;
    battle.stars += supply;
    battle.drops = [];
    if (supply > 0) battle.events.push({ type: 'star', x: battle.train.x, y: battle.train.y, fromX: CENTER.x, fromY: CENTER.y });
    if (!wasReady && canUpgrade(battle)) battle.events.push({ type: 'ready' });
  }
  if (battle.wave === battle.waveCount) {
    if (battle.upgradeCount < requiredUpgradeCount(battle)) {
      battle.phase = 'lost';
      battle.lossReason = 'mission-preparation';
      battle.events.push({ type: 'lose' });
      return;
    }
    battle.phase = 'won';
    battle.events.push({ type: 'win' });
    return;
  }
  battle.wave++;
  battle.waveTime = 0;
  battle.waveDuration = wavePlan(battle.wave, battle.seed, battle.levelId).duration;
  battle.spawnIndex = 0;
  battle.events.push({ type: 'wave', wave: battle.wave });
  if (isBossWave(battle)) battle.events.push({ type: 'boss-prep' });
}

export function stepBattle(battle, seconds) {
  if (battle.phase !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return;
  const wasPreparing = bossPrepRemaining(battle) > 0;
  battle.elapsed += seconds;
  battle.waveTime += seconds;
  const { duration, spawns } = wavePlan(battle.wave, battle.seed, battle.levelId);
  moveTrain(battle);
  spawnEnemies(battle, spawns);
  if (wasPreparing) {
    if (bossPrepRemaining(battle) > 0) return;
    if (battle.upgradeCount < requiredUpgradeCount(battle)) {
      battle.armor = 0;
      battle.phase = 'lost';
      battle.lossReason = 'boss-preparation';
      battle.events.push({ type: 'boss-prep-fail', kind: 'boss', x: CENTER.x, y: CENTER.y });
      battle.events.push({ type: 'lose' });
      return;
    }
    const [x, y] = BOSS_START_POSITION;
    battle.events.push({ type: 'boss-start', kind: 'boss', x, y });
  }
  moveEnemies(battle, seconds);
  if (battle.phase !== 'running') {
    battle.enemies = battle.enemies.filter(enemy => enemy.hp > 0);
    return;
  }
  fire(battle, battle.train, 'base', seconds);
  for (const car of battle.cars) {
    fire(battle, car, car.kind, seconds);
  }
  for (const enemy of battle.enemies) {
    if (enemy.split) splitChimera(battle, enemy);
  }
  battle.enemies = battle.enemies.filter(enemy => enemy.hp > 0);
  collectDrops(battle, seconds);
  if (battle.waveTime >= duration && battle.enemies.length === 0) advanceWave(battle);
}
