export const STORAGE_KEY = 'emberline:captains:v1';
const APP = 'emberline';
const VERSION = 1;
const COMPACT_VERSION = 2;
const MAX_PROFILES = 3;
const MAX_TEXT = 1_000_000;
const RECENT_STUDY_EVENTS = 64;
const STUDY_MODES = ['spell', 'repeat-en', 'translate', 'repeat-zh'];
const COUNTERS = ['attempts', 'correct', 'assisted', 'wrong', 'timeouts', 'read', 'last'];
const COMPACT_COUNTERS = COUNTERS.slice(1);
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);

const isObject = value => value !== null && typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const isId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,95}$/.test(value) &&
  !BAD_KEY.has(value);
const isEventId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_:-]{0,191}$/.test(value);

function assert(value) {
  if (!value) throw new Error('无效的存档数据。');
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '';
  if (!name || Array.from(name).length > 20 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new Error('请输入 1 到 20 个字符的车长昵称。');
  }
  return name;
}

function newProfile(name) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const id = `p_${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`;
  return {
    id, name, revision: 0, packId: 'kb3-u4', muted: false, study: {},
    campaign: { bestWave: 0, wins: 0, losses: 0, lastResult: null }, run: null,
  };
}

function checkJson(value, depth = 0) {
  assert(depth <= 24);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    assert(Number.isFinite(value));
  } else if (Array.isArray(value)) {
    for (const item of value) checkJson(item, depth + 1);
  } else {
    assert(isObject(value));
    for (const [key, item] of Object.entries(value)) {
      assert(!BAD_KEY.has(key));
      checkJson(item, depth + 1);
    }
  }
}

function validRun(run) {
  return run === null || (isObject(run) && isId(run.id) && isObject(run.battle) &&
    isObject(run.lesson) && isObject(run.desk));
}

function validateMapProgress(map) {
  if (map === undefined) return;
  assert(isObject(map) && (map.activeStageId === null || isId(map.activeStageId)) && isObject(map.stages));
  for (const [id, stage] of Object.entries(map.stages)) {
    assert(isId(id) && isObject(stage) && typeof stage.won === 'boolean' && validRun(stage.run) &&
      Array.isArray(stage.wordIds) && stage.wordIds.every(isId) && new Set(stage.wordIds).size === stage.wordIds.length);
  }
}

function validateProfile(profile) {
  assert(isObject(profile) && isId(profile.id) && cleanName(profile.name) === profile.name &&
    isCount(profile.revision) && isId(profile.packId) && typeof profile.muted === 'boolean');
  assert(isObject(profile.study));
  const recentEvents = profile.studyEvents ?? [];
  assert(Array.isArray(recentEvents) && recentEvents.length <= RECENT_STUDY_EVENTS &&
    recentEvents.every(isEventId) && new Set(recentEvents).size === recentEvents.length);
  for (const [wordId, skills] of Object.entries(profile.study)) {
    assert(isId(wordId) && isObject(skills));
    for (const [mode, stats] of Object.entries(skills)) {
      assert(STUDY_MODES.includes(mode) && isObject(stats) && COUNTERS.every(key => isCount(stats[key])));
      assert(stats.assisted <= stats.correct &&
        stats.attempts === stats.correct + stats.wrong + stats.timeouts);
    }
  }
  const { campaign, run } = profile;
  assert(isObject(campaign) && isCount(campaign.bestWave) && isCount(campaign.wins) && isCount(campaign.losses));
  const result = campaign.lastResult;
  assert(result === null || (isObject(result) && isId(result.runId) && typeof result.won === 'boolean' &&
    isCount(result.wave) && result.wave > 0 && result.wave <= campaign.bestWave));
  assert(validRun(run));
  validateMapProgress(profile.map);
  checkJson(profile);
}

function validateRegistry(data) {
  assert(isObject(data) && data.version === VERSION && isCount(data.revision) &&
    Array.isArray(data.profiles) && data.profiles.length <= MAX_PROFILES && isObject(data.backups));
  data.profiles.forEach(validateProfile);
  const ids = new Set(data.profiles.map(profile => profile.id));
  assert(ids.size === data.profiles.length &&
    new Set(data.profiles.map(profile => profile.name.toLowerCase())).size === data.profiles.length);
  assert(data.profiles.length ? ids.has(data.activeId) : data.activeId === null);
  for (const [id, backup] of Object.entries(data.backups)) {
    assert(ids.has(id) && backup?.id === id);
    validateProfile(backup);
  }
}

function encodeProfile(profile) {
  const study = Object.fromEntries(Object.entries(profile.study).map(([wordId, skills]) => {
    const packed = [];
    for (const [mode, stats] of Object.entries(skills)) {
      // Retain extra fields from imported archives even when the records cannot be packed.
      packed[STUDY_MODES.indexOf(mode)] = Object.keys(stats).length === COUNTERS.length
        ? COMPACT_COUNTERS.map(key => stats[key]) : stats;
    }
    return [wordId, packed];
  }));
  return { ...profile, study };
}

function decodeProfile(profile) {
  assert(isObject(profile) && isObject(profile.study));
  const study = Object.fromEntries(Object.entries(profile.study).map(([wordId, packed]) => {
    assert(Array.isArray(packed) && packed.length <= STUDY_MODES.length);
    const skills = {};
    for (const [index, entry] of packed.entries()) {
      if (entry === null) continue;
      const mode = STUDY_MODES[index];
      if (isObject(entry)) {
        skills[mode] = entry;
        continue;
      }
      assert(Array.isArray(entry) && entry.length === COMPACT_COUNTERS.length && entry.every(isCount));
      const [correct, assisted, wrong, timeouts, read, last] = entry;
      skills[mode] = { attempts: correct + wrong + timeouts, correct, assisted, wrong, timeouts, read, last };
    }
    return [wordId, skills];
  }));
  return { ...profile, study };
}

function convertRegistry(data, version, convertProfile) {
  assert(isObject(data) && Array.isArray(data.profiles) && isObject(data.backups));
  return {
    ...data,
    version,
    profiles: data.profiles.map(convertProfile),
    backups: Object.fromEntries(Object.entries(data.backups).map(([id, profile]) => [id, convertProfile(profile)])),
  };
}

function findProfile(data, id) {
  const profile = data.profiles.find(item => item.id === id);
  if (!profile) throw new Error('找不到这位车长的本机档案。');
  return profile;
}

function availableName(data, name, exceptId) {
  return data.profiles.every(profile => profile.id === exceptId ||
    profile.name.toLowerCase() !== name.toLowerCase());
}

function importedName(data, name) {
  if (availableName(data, name)) return name;
  const base = Array.from(name).slice(0, 16).join('');
  let suffix = 2;
  while (!availableName(data, `${base} (${suffix})`)) suffix++;
  return `${base} (${suffix})`;
}

function parseBackup(text) {
  try {
    assert(typeof text === 'string' && text.length <= MAX_TEXT);
    const envelope = JSON.parse(text);
    assert(envelope?.app === APP && [VERSION, COMPACT_VERSION].includes(envelope.version) &&
      typeof envelope.exportedAt === 'string' && Number.isFinite(Date.parse(envelope.exportedAt)));
    if (envelope.version === COMPACT_VERSION) envelope.profile = decodeProfile(envelope.profile);
    validateProfile(envelope.profile);
    return envelope;
  } catch {
    throw new Error('备份无法读取，请选择余火列车导出的有效存档文件。');
  }
}

export function recordStudy(profile, { targetId, mode, status, eventId, at = Date.now() }) {
  assert(isId(targetId) && STUDY_MODES.includes(mode) && isCount(at));
  assert(['correct', 'assisted', 'wrong', 'timeout', 'read'].includes(status));
  if (eventId !== undefined) {
    assert(isEventId(eventId));
    const recent = profile.studyEvents ??= [];
    if (recent.includes(eventId)) return false;
    recent.push(eventId);
    if (recent.length > RECENT_STUDY_EVENTS) recent.shift();
  }
  const skills = profile.study[targetId] ??= {};
  const count = skills[mode] ??= {
    attempts: 0, correct: 0, assisted: 0, wrong: 0, timeouts: 0, read: 0, last: 0,
  };
  count.last = Math.max(count.last, at);
  if (status === 'read') {
    count.read++;
    return true;
  }
  count.attempts++;
  if (status === 'timeout') count.timeouts++;
  if (status === 'wrong') count.wrong++;
  if (status === 'correct' || status === 'assisted') count.correct++;
  if (status === 'assisted') count.assisted++;
  return true;
}

export function recordResult(profile, { runId, won, wave }) {
  assert(isId(runId) && typeof won === 'boolean' && isCount(wave) && wave > 0);
  if (profile.run?.id !== runId) return false;
  const campaign = profile.campaign;
  campaign.bestWave = Math.max(campaign.bestWave, wave);
  campaign[won ? 'wins' : 'losses']++;
  campaign.lastResult = { runId, won, wave };
  profile.run = null;
  return true;
}

function ensureMap(profile) {
  return profile.map ??= { activeStageId: null, stages: {} };
}

export function mapStageProgress(profile, stageId) {
  return profile?.map?.stages?.[stageId] ?? { wordIds: [], won: false, run: null };
}

export function setActiveMapStage(profile, stageId) {
  assert(stageId === null || isId(stageId));
  ensureMap(profile).activeStageId = stageId;
}

export function saveMapStage(profile, stageId, { wordIds = [], run, won = false }) {
  assert(isId(stageId));
  const prior = mapStageProgress(profile, stageId);
  ensureMap(profile).stages[stageId] = {
    wordIds: [...new Set([...prior.wordIds, ...wordIds])], won: prior.won || won, run,
  };
}

export function createProgressStore(storage, key = STORAGE_KEY) {
  const backing = () => storage ?? globalThis.localStorage;

  function readText() {
    try {
      return backing().getItem(key);
    } catch {
      throw new Error('无法读取本机存档，请检查浏览器是否允许本地存储。');
    }
  }

  function readSnapshot() {
    const text = readText();
    if (text === null) {
      return { text, data: { version: VERSION, profiles: [], activeId: null, revision: 0, backups: {} } };
    }
    try {
      assert(text.length <= MAX_TEXT);
      const stored = JSON.parse(text);
      const data = stored?.version === COMPACT_VERSION ? convertRegistry(stored, VERSION, decodeProfile) : stored;
      validateRegistry(data);
      return { text, data };
    } catch {
      throw new Error('本机存档已损坏或版本不兼容，已保留原记录。');
    }
  }

  function read() {
    return readSnapshot().data;
  }

  function commit(data, previousText) {
    data.revision++;
    validateRegistry(data);
    const text = JSON.stringify(convertRegistry(data, COMPACT_VERSION, encodeProfile));
    if (text.length > MAX_TEXT) throw new Error('存档过大，无法保存。');
    // Another page can save while this page prepares and encodes its update.
    if (readText() !== previousText) throw new Error('另一页面已更新档案，请重新打开存档。');
    try {
      backing().setItem(key, text);
    } catch {
      throw new Error('无法保存本机存档，请检查浏览器存储权限或可用空间。');
    }
  }

  function add(data, previousText, profile) {
    if (data.profiles.length >= MAX_PROFILES) throw new Error('当前浏览器最多保存 3 个车长档案。');
    data.profiles.push(profile);
    data.activeId = profile.id;
    commit(data, previousText);
    return profile;
  }

  function replace(data, previousText, previous, imported) {
    const restored = {
      ...imported, id: previous.id, name: previous.name, revision: previous.revision + 1,
    };
    data.backups[previous.id] = previous;
    data.profiles[data.profiles.indexOf(previous)] = restored;
    data.activeId = restored.id;
    commit(data, previousText);
    return restored;
  }

  function update(id, updater, { expectedRevision } = {}) {
    const { text, data } = readSnapshot();
    const previous = findProfile(data, id);
    if (expectedRevision !== undefined && previous.revision !== expectedRevision) {
      throw new Error('这位车长已在另一页面保存，请重新打开档案。');
    }
    const draft = JSON.parse(JSON.stringify(previous));
    const result = updater(draft);
    if (result?.then) throw new Error('存档更新须在同一次操作内完成。');
    const profile = isObject(result) ? result : draft;
    assert(profile.id === id);
    profile.name = cleanName(profile.name);
    if (!availableName(data, profile.name, id)) throw new Error('已有同名车长，请换一个昵称。');
    profile.revision = previous.revision + 1;
    data.profiles[data.profiles.indexOf(previous)] = profile;
    commit(data, text);
    return profile;
  }

  return {
    read,
    create(name) {
      const { text, data } = readSnapshot();
      const normalized = cleanName(name);
      if (!availableName(data, normalized)) throw new Error('已有同名车长，请换一个昵称。');
      return add(data, text, newProfile(normalized));
    },
    select(id) {
      const { text, data } = readSnapshot();
      const profile = findProfile(data, id);
      if (data.activeId !== id) {
        data.activeId = id;
        commit(data, text);
      }
      return profile;
    },
    update,
    rename(id, name) {
      return update(id, profile => { profile.name = cleanName(name); });
    },
    exportProfile(id) {
      const profile = findProfile(read(), id);
      const envelope = { app: APP, version: VERSION, exportedAt: new Date().toISOString(), profile };
      const readable = JSON.stringify(envelope, null, 2);
      return new TextEncoder().encode(readable).byteLength <= MAX_TEXT ? readable
        : JSON.stringify({ ...envelope, version: COMPACT_VERSION, profile: encodeProfile(profile) });
    },
    previewImport(text) {
      const { profile, exportedAt } = parseBackup(text);
      const { name, packId, campaign, study, run } = profile;
      return {
        name, packId, exportedAt, bestWave: campaign.bestWave, wins: campaign.wins,
        losses: campaign.losses, words: Object.keys(study).length,
        hasRun: run !== null || Object.values(profile.map?.stages ?? {}).some(stage => stage.run !== null),
      };
    },
    importProfile(text, { replaceId } = {}) {
      const { profile: imported } = parseBackup(text);
      const { text: previousText, data } = readSnapshot();
      if (replaceId !== undefined) return replace(data, previousText, findProfile(data, replaceId), imported);
      const identity = newProfile(importedName(data, imported.name));
      return add(data, previousText, { ...imported, id: identity.id, name: identity.name, revision: 0 });
    },
    restoreBackup(id) {
      const { text, data } = readSnapshot();
      const profile = findProfile(data, id);
      if (!data.backups[id]) throw new Error('这个档案没有可恢复的导入前备份。');
      return replace(data, text, profile, data.backups[id]);
    },
    deleteProfile(id) {
      const { text, data } = readSnapshot();
      const remaining = data.profiles.filter(profile => profile.id !== id);
      if (remaining.length === data.profiles.length) return false;
      data.profiles = remaining;
      delete data.backups[id];
      if (data.activeId === id) data.activeId = remaining[0]?.id ?? null;
      commit(data, text);
      return true;
    },
  };
}
